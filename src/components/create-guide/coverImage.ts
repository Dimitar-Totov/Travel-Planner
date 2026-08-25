/**
 * Which cover-photo URLs the hero can actually render.
 *
 * `GuideHero` draws the cover with `next/image`, and `next/image` throws at
 * request time for any remote host missing from `images.remotePatterns` in
 * `next.config.ts` — today that list is `images.unsplash.com` and nothing else.
 * A typed-in URL is therefore not free-form: an unlisted host would take down
 * the whole preview rather than showing a broken image.
 *
 * So the form validates against this and the preview falls back to the bundled
 * cover. Widening it is a `next.config.ts` change (outside this feature), not
 * something to work around here.
 */

/** The one cover shipped in `public/`. */
export const DEFAULT_COVER_IMAGE = "/destinations-background-image.png";

const ALLOWED_REMOTE_HOST = "images.unsplash.com";

export function isSupportedCoverImage(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  // A root-relative path is served by this app, so it needs no allow-listing.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && url.hostname === ALLOWED_REMOTE_HOST;
  } catch {
    return false;
  }
}

/** The value to hand `GuideHero` — never something `next/image` will reject. */
export function coverImageSrc(value: string): string {
  const trimmed = value.trim();
  return trimmed !== "" && isSupportedCoverImage(trimmed)
    ? trimmed
    : DEFAULT_COVER_IMAGE;
}
