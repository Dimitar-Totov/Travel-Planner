/**
 * Turns a picked file into the `data:image/...` string the rest of the draft
 * (`coverImage`, the gallery) stores it as — there is no uploads API yet, so
 * the file itself, base64-encoded, is the only place for it to live.
 */

/** Keeps a photo-heavy draft from ballooning the in-memory state (and the
 *  preview's data-URL `<Image>` payload) past what a browser tab should hold. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export class ImageTooLargeError extends Error {}
export class UnsupportedImageTypeError extends Error {}

export function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
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
