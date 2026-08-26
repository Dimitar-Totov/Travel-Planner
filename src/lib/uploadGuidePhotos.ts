/**
 * Turning a draft's `data:image/...` photos into real R2 URLs, which is the
 * step that has to happen before `POST /api/guides` can be called at all.
 *
 * `useCreateGuideForm` stores every picked file as a data URL (see
 * `components/create-guide/imageUpload.ts`) because there was nowhere else to
 * put it. That representation fails the guides API twice over:
 * `publishGuideSchema` requires `coverImageUrl` to be an `http(s)` URL, and the
 * route additionally host-checks every photo URL against `R2_PUBLIC_BASE_URL`.
 * So each photo is uploaded first and only its `publicUrl` is ever POSTed.
 *
 * One photo is a three-step exchange:
 *   1. read the MIME type out of the data URL and turn the URL back into a Blob,
 *   2. `POST /api/uploads { contentType }` for a presigned PUT,
 *   3. `PUT` the blob at `uploadUrl` with that *exact same* content type.
 *
 * Step 3's header is not cosmetic: the content type is signed into the
 * presigned URL, so any difference between what step 2 was told and what step 3
 * sends invalidates the whole signature and R2 rejects the upload. That is why
 * a single `contentType` string is parsed once and used for both, rather than
 * sending `blob.type` (which the browser derives separately and may normalise)
 * on the PUT.
 *
 * Deliberately no React in here — this is plain async plumbing, and
 * `lib/hooks/usePublishGuide.ts` is the only caller.
 */

/**
 * How many photos are uploaded at once.
 *
 * Three, not "all of them". A guide can legitimately carry a cover plus a photo
 * per stop — 20+ multi-megabyte PUTs — and firing those simultaneously on a
 * domestic uplink makes every one of them slow down together, so the whole
 * batch finishes no sooner and the progress counter sits at 0/20 until the very
 * end. It also pins every blob in memory at once. Three keeps the connection
 * saturated (one upload's latency is covered by the other two) while leaving
 * room for the interleaved `/api/uploads` round trips to the app's own origin,
 * and it makes progress visibly tick.
 */
export const UPLOAD_CONCURRENCY = 3;

/** `POST /api/uploads` answered 401 — the author isn't signed in. Separate from
 *  `UploadFailedError` because it is the one failure with a fix the author can
 *  act on, and `usePublishGuide` turns it into a sign-in prompt. */
export class UploadAuthError extends Error {
  constructor() {
    super("You must be signed in to upload photos.");
    this.name = "UploadAuthError";
  }
}

/** Any other upload failure. The message is written to be shown to an author
 *  as-is, so callers never have to invent one. */
export class UploadFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadFailedError";
  }
}

/** A cancelled `fetch` rejects with a `DOMException`, and cancellation is the
 *  one "failure" that must never reach the author as an error banner. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export interface PhotoUploadTask {
  /** Caller-chosen identity — `usePublishGuide` keys by cover/stop id so the
   *  returned URL can be put back on the right stop. Never sent anywhere. */
  readonly key: string;
  /** The `data:image/...` string held in the draft. */
  readonly dataUrl: string;
}

export interface UploadGuidePhotosOptions {
  /** Aborts every in-flight request — the publish flow wires this to unmount. */
  signal?: AbortSignal;
  /** Called after each photo lands, with the running completed count. */
  onProgress?: (completed: number) => void;
}

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Uploads every task, at most `UPLOAD_CONCURRENCY` at a time, and resolves to a
 * `key -> publicUrl` map.
 *
 * Rejects with the first real failure and aborts whatever else is in flight —
 * the guide can't be published with a missing photo, so continuing to push
 * megabytes at R2 after the batch is already doomed only costs the author time
 * and bandwidth.
 */
export async function uploadGuidePhotos(
  tasks: readonly PhotoUploadTask[],
  { signal, onProgress }: UploadGuidePhotosOptions = {},
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (tasks.length === 0) return results;

  // Own controller so one task's failure can cancel its siblings; chained off
  // the caller's signal so an unmount still cancels the lot.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });

  // Boxed twice over: the inner `{ error }` so a thrown `undefined` still
  // counts as a failure (and so the first error wins over the AbortErrors it
  // causes), and the outer object because control-flow analysis would otherwise
  // narrow a plain `let` to `null` here — every assignment to it happens inside
  // the closure below.
  const state: { failure: { error: unknown } | null } = { failure: null };
  let cursor = 0;
  let completed = 0;

  const runner = async (): Promise<void> => {
    while (state.failure === null) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;

      const task = tasks[index];
      try {
        results.set(
          task.key,
          await uploadDataUrl(task.dataUrl, controller.signal),
        );
        completed += 1;
        onProgress?.(completed);
      } catch (error) {
        if (state.failure === null) state.failure = { error };
        abort();
        return;
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, tasks.length) }, () =>
        runner(),
      ),
    );
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  if (state.failure) throw state.failure.error;
  return results;
}

/** The one photo's worth of work — presign, PUT, hand back the public URL. */
async function uploadDataUrl(
  dataUrl: string,
  signal: AbortSignal,
): Promise<string> {
  const contentType = mimeTypeOf(dataUrl);
  if (!contentType) {
    throw new UploadFailedError(
      "One of your photos is in a format we can't read. Remove it and pick the file again.",
    );
  }

  const blob = await dataUrlToBlob(dataUrl, signal);

  const presignResponse = await fetchOrFail(
    "/api/uploads",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType }),
      signal,
    },
    "We couldn't reach the server to upload your photos. Check your connection and try again.",
  );

  if (presignResponse.status === 401) throw new UploadAuthError();
  if (!presignResponse.ok) {
    throw new UploadFailedError(
      (await errorMessageOf(presignResponse)) ??
        `We couldn't prepare a photo upload (${presignResponse.status}).`,
    );
  }

  const presigned = readPresignedUpload(
    await presignResponse.json().catch(() => null),
  );
  if (!presigned) {
    throw new UploadFailedError(
      "The upload service sent back a response we couldn't read.",
    );
  }

  const putResponse = await fetchOrFail(
    presigned.uploadUrl,
    {
      method: "PUT",
      // Must be byte-identical to the `contentType` sent above — it is signed
      // into `uploadUrl`. See the module comment.
      headers: { "Content-Type": contentType },
      body: blob,
      signal,
    },
    "We couldn't upload one of your photos. Check your connection and try again.",
  );

  if (!putResponse.ok) {
    throw new UploadFailedError(
      `Photo storage rejected the upload (${putResponse.status}). Please try again.`,
    );
  }

  return presigned.publicUrl;
}

/**
 * The media type between `data:` and the first `;` or `,`.
 *
 * Lowercased here so the same normalised string goes to `/api/uploads` and onto
 * the PUT — the signature check compares them literally.
 */
function mimeTypeOf(dataUrl: string): string | null {
  const match = /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)[;,]/i.exec(
    dataUrl,
  );
  return match ? match[1].toLowerCase() : null;
}

/** `fetch` on a `data:` URL is the shortest correct base64 decoder available in
 *  the browser, and it hands back a `Blob` directly. */
async function dataUrlToBlob(
  dataUrl: string,
  signal: AbortSignal,
): Promise<Blob> {
  try {
    const response = await fetch(dataUrl, { signal });
    return await response.blob();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new UploadFailedError(
      "One of your photos couldn't be read back for upload. Remove it and pick the file again.",
    );
  }
}

/** `fetch` only rejects on a transport failure; every HTTP status is a resolved
 *  response. This converts that one rejection into an author-facing message and
 *  lets aborts through untouched. */
async function fetchOrFail(
  input: string,
  init: RequestInit,
  offlineMessage: string,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new UploadFailedError(offlineMessage);
  }
}

/** Both endpoints answer a failure with `{ error }`; the body is untrusted at
 *  the type level, so every branch is checked (as `SignUpForm` does). */
async function errorMessageOf(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null) return null;
  const { error } = body as { error?: unknown };
  return typeof error === "string" && error.trim() !== "" ? error : null;
}

/** `key` is deliberately ignored: the app has no use for the object key once it
 *  holds the public URL, and the guides API derives nothing from it. */
function readPresignedUpload(body: unknown): PresignedUpload | null {
  if (typeof body !== "object" || body === null) return null;
  const { uploadUrl, publicUrl } = body as {
    uploadUrl?: unknown;
    publicUrl?: unknown;
  };
  if (typeof uploadUrl !== "string" || typeof publicUrl !== "string") {
    return null;
  }
  if (uploadUrl === "" || publicUrl === "") return null;
  return { uploadUrl, publicUrl };
}
