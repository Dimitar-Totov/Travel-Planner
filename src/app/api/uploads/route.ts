import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  createUploadUrl,
  GUIDE_PHOTO_CONTENT_TYPES,
  guidePhotoKeyForContentType,
  isR2Configured,
} from "@/lib/storage/r2";

/**
 * Content types this endpoint will presign an upload for. Re-exported from
 * `GUIDE_PHOTO_CONTENT_TYPES` (`lib/storage/r2.ts`) — that's the single
 * source of truth this route's validation and its key's extension both read
 * from — under this route's own name so a future client-side pre-flight
 * check (mirroring how `SignUpForm` reuses `registerSchema`) has something
 * to import without reaching into `lib/storage/r2.ts` directly.
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = GUIDE_PHOTO_CONTENT_TYPES;

const uploadRequestSchema = z.object({
  contentType: z.enum(GUIDE_PHOTO_CONTENT_TYPES, {
    error: `contentType must be one of: ${GUIDE_PHOTO_CONTENT_TYPES.join(", ")}.`,
  }),
});

/**
 * POST /api/uploads — presigns a direct-to-R2 upload for one guide photo (a
 * cover image or a stop photo, from `/create-guide`).
 *
 * Body: `{ "contentType": string }`, one of `ALLOWED_UPLOAD_CONTENT_TYPES`.
 *
 * Responses:
 * - 201 `{ uploadUrl, publicUrl, key }` — `uploadUrl` is a presigned PUT the
 *   browser sends the file bytes to directly (this server never sees them);
 *   `publicUrl` is the value to keep and later send to `POST /api/guides`.
 *   The client is expected to follow up with
 *   `fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body })`.
 * - 400 `{ error }` — body isn't valid JSON, isn't a JSON object, or
 *   `contentType` is missing / not in the allowlist
 * - 401 `{ error }` — no signed-in session
 * - 500 `{ error }` — R2 isn't configured, or an unexpected failure
 *
 * No server-side file-size limit is enforced here, or anywhere in this
 * flow, and this route does not claim otherwise: the PUT this presigns goes
 * straight from the browser to R2 and never passes back through this
 * server, so nothing here can inspect or cap the byte count once a client
 * has a presigned URL in hand. `MAX_PHOTO_BYTES`
 * (`components/create-guide/imageUpload.ts`) is a client-side UX guard, not
 * an enforced limit — a client that skips it can PUT an arbitrarily large
 * object straight to R2. A SigV4-presigned **PUT** has no built-in
 * size-condition field to bind one into; S3-compatible presigned **POST**
 * does support a `content-length-range` policy condition, so switching this
 * flow to presigned POST (or adding an out-of-band check, e.g. an R2 Event
 * Notification that deletes oversized objects after the fact) are the two
 * real options if a server-enforced cap is ever required. Neither is
 * implemented here.
 */
export async function POST(request: Request): Promise<Response> {
  // This is the only gate on this route. `src/proxy.ts`'s matcher excludes
  // all of `/api/*`, and `PROTECTED_PATHS` in `src/lib/auth.ts` is
  // intentionally empty — so without this check, any anonymous request could
  // mint a presigned write URL into the bucket. This endpoint *is* a write
  // handle to R2; this check is what keeps it from being an open one.
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to upload a photo." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      {
        error:
          'Request body must be a JSON object shaped like { "contentType": string }.',
      },
      { status: 400 },
    );
  }

  const result = uploadRequestSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      {
        error:
          result.error.issues[0]?.message ??
          "contentType is missing or unsupported.",
      },
      { status: 400 },
    );
  }

  const { contentType } = result.data;

  // Checked explicitly, rather than letting a missing env var surface as a
  // thrown error inside the generic catch below, so the log names exactly
  // what's misconfigured instead of an opaque 500.
  if (!isR2Configured()) {
    console.error(
      "[api/uploads] R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME)",
    );
    return Response.json(
      { error: "Photo storage is not configured." },
      { status: 500 },
    );
  }

  try {
    // The key is derived here, server-side, from nothing the client
    // controls beyond its (already-validated) content type — never from a
    // client-supplied key or filename. Letting a client choose the key
    // would let one author overwrite another author's object.
    const key = guidePhotoKeyForContentType(contentType);
    const { uploadUrl, publicUrl } = await createUploadUrl({
      key,
      contentType,
    });

    return Response.json({ uploadUrl, publicUrl, key }, { status: 201 });
  } catch (error) {
    console.error("[api/uploads] failed to create presigned upload URL", error);
    return Response.json(
      { error: "Unexpected error while preparing the upload." },
      { status: 500 },
    );
  }
}
