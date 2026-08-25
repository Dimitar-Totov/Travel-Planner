import { MapPinIcon } from "@/components/icons";

/**
 * The stop's picture slot.
 *
 * There is no per-stop photo in the data model and no upload path yet, so this
 * is a *designed* placeholder rather than a broken `<img>` or an upload
 * affordance: a soft brand wash, an oversized pin glyph bleeding out of the
 * bottom-right corner, and the stop's initial. Real photographs land here when
 * uploads ship — the box is already the shape and radius they'll need, so
 * dropping an `<Image fill>` in is the whole change.
 *
 * Decorative by definition (it carries no information the row doesn't already
 * state in text), hence `aria-hidden`.
 */

const WASH_BRAND =
  "linear-gradient(150deg,#e6eff5 0%,#cbdfed 55%,#b7d1e4 100%)";
const WASH_GOLD = "linear-gradient(150deg,#f8eedd 0%,#efd9b8 55%,#e6c99f 100%)";

interface StopThumbProps {
  /** Only the first character is used. */
  name: string;
  /** Matches the stop's pin so the row reads as one object. */
  tone?: "brand" | "gold";
  /** Sizing/positioning is the caller's job; this only paints. */
  className?: string;
}

export default function StopThumb({
  name,
  tone = "brand",
  className = "",
}: StopThumbProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-xl ring-1 ring-inset ring-white/70 ${className}`}
    >
      {/* The wash is the element that scales on row hover (`.tp-ph`), so the
          glyph and the initial stay put and only the backdrop drifts. */}
      <div
        className="tp-ph absolute inset-0"
        style={{ background: tone === "gold" ? WASH_GOLD : WASH_BRAND }}
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
        {initial}
      </span>
    </div>
  );
}
