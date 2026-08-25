import Image from "next/image";
import { MapPinIcon } from "@/components/icons";

/**
 * The stop's picture slot.
 *
 * With `image`: the photograph Unsplash resolved for this stop, cropped to the
 * box. Without it: the original *designed* placeholder — a soft brand wash, an
 * oversized pin glyph bleeding out of the bottom-right corner, and the stop's
 * initial. That branch is not a degraded state anyone should notice; a keyless
 * or rate-limited run renders it for every stop, exactly as the page did before
 * photos existed.
 *
 * Decorative either way (it carries no information the row doesn't already
 * state in text), hence `aria-hidden` on the box. The `alt` is still passed
 * through to the `<img>` so the element is correct on its own terms if that
 * wrapper ever stops hiding it.
 */

const WASH_BRAND =
  "linear-gradient(150deg,#e6eff5 0%,#cbdfed 55%,#b7d1e4 100%)";
const WASH_GOLD = "linear-gradient(150deg,#f8eedd 0%,#efd9b8 55%,#e6c99f 100%)";

/** The two fields a `DestinationImage` contributes here; anything with a URL
 *  and alt text fits, so callers can forward one straight through. */
export interface StopThumbImage {
  url: string;
  alt: string;
}

interface StopThumbProps {
  /** Only the first character is used — placeholder branch only. */
  name: string;
  /** Matches the stop's pin so the row reads as one object. */
  tone?: "brand" | "gold";
  /** Sizing/positioning is the caller's job; this only paints. */
  className?: string;
  /**
   * Resolved photo for this stop. `null`/omitted — no key, no results, a
   * transient failure — falls back to the gradient placeholder.
   */
  image?: StopThumbImage | null;
  /** `sizes` for the `fill` image; the rendered box differs per call site. */
  sizes?: string;
}

export default function StopThumb({
  name,
  tone = "brand",
  className = "",
  image,
  sizes = "(min-width: 640px) 170px, 100vw",
}: StopThumbProps) {
  const wash = tone === "gold" ? WASH_GOLD : WASH_BRAND;

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-xl ring-1 ring-inset ring-white/70 ${className}`}
    >
      {image ? (
        <>
          {/* The wash stays underneath as the loading tint, so the box is never
              a white hole while the photo streams in. */}
          <div className="absolute inset-0" style={{ background: wash }} />
          {/* `.tp-ph` is what scales on row hover, so a photograph drifts the
              same way the placeholder always has. */}
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes={sizes}
            className="tp-ph object-cover"
          />
        </>
      ) : (
        <>
          {/* The wash is the element that scales on row hover (`.tp-ph`), so the
              glyph and the initial stay put and only the backdrop drifts. */}
          <div
            className="tp-ph absolute inset-0"
            style={{ background: wash }}
          />
          <span
            className={`absolute -bottom-3 -right-2 ${
              tone === "gold" ? "text-gold-deep/20" : "text-brand-700/20"
            }`}
          >
            <MapPinIcon size={72} strokeWidth={1.3} />
          </span>
          <span
            className={`relative grid h-full w-full place-items-center text-[26px] font-extrabold tracking-[-.02em] ${
              tone === "gold" ? "text-gold-deep/45" : "text-brand-700/40"
            }`}
          >
            {name.trim().charAt(0).toUpperCase()}
          </span>
        </>
      )}
    </div>
  );
}
