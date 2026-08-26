/**
 * Cloudflare R2 client wiring. R2 is S3-compatible, so it's reached through
 * the standard `@aws-sdk/client-s3` `S3Client` pointed at R2's S3 endpoint
 * instead of AWS — there is no separate R2 SDK.
 *
 * Server-only — reads `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` /
 * `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` and holds R2 credentials. Never
 * import this from a client component.
 *
 * This module is SDK wiring, presigned-upload-URL generation, and public-URL
 * building only: no route or server action lives here. `POST /api/uploads`
 * is what calls it — see that route for the HTTP surface.
 *
 * The feature shape this module is built for: `/api/uploads` gets a presigned
 * **PUT** URL from `createUploadUrl`, the browser PUTs the file straight to R2
 * against that URL, and `/create-guide`'s publish flow then sends
 * `createUploadUrl`'s returned `publicUrl` (built by `r2PublicUrl`) to
 * `POST /api/guides` to be stored in Mongo — never the presigned URL itself.
 * See `r2PublicUrl`'s doc comment
 * for why those two URLs must never be confused: one is upload-only and
 * expires in minutes, the other is what gets persisted and must stay valid
 * indefinitely.
 *
 * CORS: a direct browser PUT against a presigned URL is a cross-origin
 * request from whatever origin the app is served from, and R2 buckets have
 * no CORS policy by default — without one, the preflight (or the PUT itself)
 * fails even though the presigned URL is valid. This has to be configured on
 * the bucket (R2 → bucket → Settings → CORS Policy, or `r2 bucket cors put`
 * via Wrangler), not in this module. Per Cloudflare's docs
 * (https://developers.cloudflare.com/r2/buckets/cors/) the rule needs at
 * minimum `AllowedOrigins` (the app's origin(s)), `AllowedMethods: ["PUT"]`,
 * and `AllowedHeaders: ["Content-Type"]` (since `createUploadUrl` signs
 * `ContentType`, the browser's PUT must send that header); `ExposeHeaders:
 * ["ETag"]` is recommended so client JS can read the upload's ETag back, and
 * a `MaxAgeSeconds` avoids a preflight on every upload. Not configuring this
 * is the most likely reason a first real upload attempt fails.
 *
 * Checksums: aws-sdk-js-v3 defaults `requestChecksumCalculation` to
 * `WHEN_SUPPORTED`, which folds an `x-amz-checksum-crc32` header into every
 * request (R2 now supports it as of 2025-02-03, so a server-side
 * `PutObjectCommand` works fine either way). The setting is what makes the
 * presigned browser PUT above actually work: `WHEN_SUPPORTED` would sign the
 * checksum header into the URL, but a plain `fetch(url, { method: "PUT",
 * body })` from a browser never sends it, so the signature wouldn't match
 * and R2 would reject the upload with a 403. `WHEN_REQUIRED` below avoids
 * that without changing behavior for any server-side call this module makes
 * directly.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import {
  GUIDE_PHOTO_CONTENT_TYPES,
  type GuidePhotoContentType,
} from "@/lib/validation/guide";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

declare global {
  // See `src/lib/mongodb.ts` for why this is cached on `globalThis`: reuse
  // across hot reloads in dev and warm serverless invocations in prod.
  var r2Client: S3Client | undefined;
}

/**
 * Reads and validates the R2 env vars, throwing a single error naming every
 * variable that's missing rather than failing opaquely on the first one.
 */
function readR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  // Written as one `if` over the four values rather than a `missing.length`
  // check so TypeScript narrows them to `string` here — the alternative needs
  // a cast, which would hide a genuinely wrong shape later.
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    const missing = [
      !accountId && "R2_ACCOUNT_ID",
      !accessKeyId && "R2_ACCESS_KEY_ID",
      !secretAccessKey && "R2_SECRET_ACCESS_KEY",
      !bucketName && "R2_BUCKET_NAME",
    ].filter((name): name is string => Boolean(name));

    throw new Error(
      `Missing R2 environment variable(s): ${missing.join(", ")}. See .env.example.`,
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

/**
 * Builds the **stable, permanent** public URL for an object key — this is
 * the value a guide document should store in Mongo for a photo, once a
 * guide model exists to store one.
 *
 * The base is `R2_PUBLIC_BASE_URL`, today the bucket's managed
 * `https://pub-<hash>.r2.dev` subdomain (R2 → bucket → Settings → Public
 * access → enable, which is what mints that hostname). r2.dev is rate-limited
 * and Cloudflare-documented as development-only — an accepted trade-off
 * here, not an oversight, because a custom domain isn't available. Kept
 * behind this one function (and this one env var) specifically so the
 * trade-off is cheap to revisit: pointing `R2_PUBLIC_BASE_URL` at a custom
 * domain later is a config change, nothing here has to change.
 *
 * **Never confuse this with a presigned GET URL.** A presigned URL
 * (`createUploadUrl` generates the PUT variant; nothing here generates a GET
 * one) has a rotating signature and expires — R2's cap is 7 days — so it
 * would silently rot if persisted. This function's output has no signature
 * and no expiry; it's what makes storing a permanent link correct at all.
 *
 * Deliberately reads `R2_PUBLIC_BASE_URL` on its own rather than folding it
 * into `readR2Config()`'s required set: the four vars there are the
 * credentials needed to *write* to R2, while this one only describes where
 * objects are *read* back from, and a page rendering stored photo URLs needs
 * this without needing those. Note `createUploadUrl` ends up requiring both,
 * since it returns the public URL alongside the presigned one — that's
 * deliberate, so a missing base URL fails at presign time rather than after
 * a file has already been uploaded to a key nobody can build a link to.
 *
 * Deliberately not `NEXT_PUBLIC_`: every consumer of this (guide pages,
 * stop photos) renders server-side, so the URL is built here and shipped to
 * the client as a plain string prop, never as code that reads the env var in
 * the browser. Keeping it server-only means the domain can change without a
 * client rebuild.
 *
 * Trade-off worth flagging: storing this function's *output* (an absolute
 * URL) in Mongo, rather than storing the bare key and rebuilding the URL on
 * read, means a future move to a custom domain needs a data migration over
 * every stored photo URL, not just a config change — accepted here because
 * the user wants URLs in Mongo, not keys.
 */
export function r2PublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;

  if (!base) {
    throw new Error(
      "Missing R2 environment variable: R2_PUBLIC_BASE_URL. See .env.example.",
    );
  }

  // Tolerate a trailing slash on the base and a leading slash on the key so
  // callers can pass either shape without producing a doubled `//`.
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

/**
 * Non-throwing probe for callers that want to degrade gracefully (e.g. a
 * future upload route returning 503 instead of 500) instead of catching a
 * thrown config error, mirroring how `unsplash.ts` checks for its key.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
  );
}

/**
 * Returns the configured R2 bucket name, throwing the same actionable error
 * as `getR2Client` if it's unset.
 */
export function r2Bucket(): string {
  return readR2Config().bucketName;
}

/**
 * Returns a cached `S3Client` wired to this account's R2 endpoint, creating
 * one on first call. Env vars are read here — at call time, not module
 * evaluation time — so a build without R2 configured doesn't crash before
 * this is ever invoked.
 */
export function getR2Client(): S3Client {
  if (global.r2Client) {
    return global.r2Client;
  }

  const config = readR2Config();

  const client = new S3Client({
    // Required by the SDK's types; R2 ignores it — requests are routed by
    // the endpoint below, not by region.
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // See the module doc-comment above: this is what keeps `createUploadUrl`'s
    // presigned browser PUT working, without changing behavior for any
    // server-side call this module makes directly.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  global.r2Client = client;

  return client;
}

/** Seconds. R2 accepts anywhere from 1 second to 7 days (604800s) for a presigned URL. */
const MIN_UPLOAD_URL_EXPIRY_SECONDS = 1;
const MAX_UPLOAD_URL_EXPIRY_SECONDS = 604_800;

/**
 * A presigned upload URL only needs to survive the one PUT it's generated
 * for — a user picking a photo and their browser sending it. Minutes, not
 * R2's 7-day max: the longer the window, the longer a leaked or logged URL
 * stays exploitable (anyone holding it can overwrite that key until it
 * expires, since `ContentType` is the only thing the signature restricts).
 */
const DEFAULT_UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;

/** A collision-free prefix + `randomUUID()` + preserved extension, e.g. `guide-photos/…uuid….jpg`. */
const GUIDE_PHOTO_KEY_PREFIX = "guide-photos/";

/**
 * The accepted content types live in `lib/validation/guide.ts`, not here:
 * `components/create-guide/imageUpload.ts` screens picked files against the
 * same list in the browser, and this module is server-only — importing it from
 * a client component would pull the R2 client into the bundle. Re-exported so
 * `/api/uploads` can take its allowlist and its key's extension from one
 * import.
 */
export { GUIDE_PHOTO_CONTENT_TYPES, type GuidePhotoContentType };

const GUIDE_PHOTO_EXTENSION_BY_CONTENT_TYPE: Record<
  GuidePhotoContentType,
  string
> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

/**
 * Generates the object key for one guide photo: the shared prefix (so the
 * bucket stays organized if other object kinds are added later), a
 * `crypto.randomUUID()` so two authors uploading the same photo can never
 * collide, and an extension so the stored object has one (R2 doesn't infer
 * it, and a bucket of extensionless blobs is miserable to eyeball).
 *
 * Keyed off the content type rather than a filename because a filename never
 * reaches the server in this flow: `POST /api/uploads`' body is
 * `{ contentType }` alone, and the bytes go browser-to-R2 directly. Callers
 * are expected to have already rejected anything outside
 * `GUIDE_PHOTO_CONTENT_TYPES` (`/api/uploads` does, via `z.enum`), so an
 * unrecognized type here falls back to no extension rather than throwing.
 */
export function guidePhotoKeyForContentType(contentType: string): string {
  const extension =
    GUIDE_PHOTO_EXTENSION_BY_CONTENT_TYPE[
      contentType as GuidePhotoContentType
    ] ?? "";

  return `${GUIDE_PHOTO_KEY_PREFIX}${randomUUID()}${extension}`;
}

export interface CreateUploadUrlOptions {
  /** Object key to upload to — typically from `guidePhotoKeyForContentType`. */
  key: string;
  /**
   * MIME type the upload must be. Signed into the presigned URL, so the
   * browser's PUT **must** send this exact `Content-Type` header — R2
   * validates the signed request against every header baked into it, and a
   * mismatched `Content-Type` makes the whole signature invalid, not just
   * that one header. Not optional in practice, only in the type: a plain
   * `fetch(url, { method: "PUT", body: file })` without setting it will send
   * whatever default the browser picks (frequently blank), which won't match.
   */
  contentType: string;
  /** Seconds; defaults to `DEFAULT_UPLOAD_URL_EXPIRY_SECONDS` (5 minutes). Clamped to R2's 1s–7d range. */
  expiresIn?: number;
}

export interface UploadUrlResult {
  /** Presigned PUT URL — upload-only, expires in `expiresIn` seconds. Never persist this. */
  uploadUrl: string;
  /**
   * The object's permanent public URL, i.e. `r2PublicUrl(key)`. Returned
   * alongside `uploadUrl` so a caller storing the result in Mongo doesn't
   * recompute `r2PublicUrl` separately and risk the two drifting (e.g. if
   * `key` gets normalized differently in two places). **This** is the value
   * to persist — never `uploadUrl`.
   */
  publicUrl: string;
  /** Echoed back for convenience — the key `guidePhotoKeyForContentType` minted. */
  key: string;
}

/**
 * Generates a presigned PUT URL for uploading one object to R2, plus the
 * permanent public URL it will be reachable at once the upload completes.
 *
 * Requires CORS configured on the bucket for the app's origin — see the
 * module doc-comment. Without it, the browser's PUT against `uploadUrl`
 * fails even though the URL itself is valid.
 */
export async function createUploadUrl(
  options: CreateUploadUrlOptions,
): Promise<UploadUrlResult> {
  const { key, contentType } = options;
  const expiresIn = Math.min(
    Math.max(
      options.expiresIn ?? DEFAULT_UPLOAD_URL_EXPIRY_SECONDS,
      MIN_UPLOAD_URL_EXPIRY_SECONDS,
    ),
    MAX_UPLOAD_URL_EXPIRY_SECONDS,
  );

  const command = new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn });

  return { uploadUrl, publicUrl: r2PublicUrl(key), key };
}
