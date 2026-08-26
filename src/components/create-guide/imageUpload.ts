/**
 * Turns a picked file into the `data:image/...` string the draft holds it as
 * (`coverImage`, each stop's photo) until Publish uploads it for real.
 *
 * The draft is still in-memory, so a data URL remains how a photo lives
 * between being picked and being published — `lib/uploadGuidePhotos.ts` reads
 * these back into blobs at publish time.
 */

import { isGuidePhotoContentType } from "@/lib/validation/guide";

/**
 * Client-side only, and deliberately not claimed as anything more.
 *
 * The real upload is a presigned browser-to-R2 PUT that never passes through
 * this app's server (see `POST /api/uploads`), so nothing server-side can
 * enforce a byte cap — this keeps a photo-heavy draft from ballooning the
 * in-memory state and the preview's data-URL `<Image>` payload, and that's all.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export class ImageTooLargeError extends Error {}
export class UnsupportedImageTypeError extends Error {}

export function readImageFile(file: File): Promise<string> {
  // Screened against the same list `POST /api/uploads` enforces, not a loose
  // `image/*` check. A picker more permissive than the endpoint would let an
  // author add a `.bmp`, watch it preview correctly, write the entire guide,
  // and only learn at Publish that it was never uploadable.
  if (!isGuidePhotoContentType(file.type)) {
    return Promise.reject(new UnsupportedImageTypeError(file.name));
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return Promise.reject(new ImageTooLargeError(file.name));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}
