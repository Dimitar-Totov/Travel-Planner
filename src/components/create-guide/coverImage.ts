import type { DraftPhoto } from "@/lib/hooks/useCreateGuideForm";

/**
 * The value to hand `GuideHero` for the cover photo.
 *
 * A draft's cover comes from `PhotoUploadField` as a `data:image/...` URL —
 * `next/image` special-cases `data:`/`blob:` sources as always-unoptimized
 * (see `get-img-props.js`), so unlike a typed-in remote URL there is no host
 * to allow-list here. `undefined` when nothing has been uploaded yet, which
 * `GuideHero` renders as a plain background rather than a stand-in photo.
 */
export function coverImageSrc(photo: DraftPhoto | null): string | undefined {
  return photo?.src.trim() || undefined;
}
