/**
 * The numbered teardrop that marks a stop.
 *
 * One component for both surfaces on purpose: the list and the map must agree
 * pixel for pixel, because the number on a pin is the only thing tying a row in
 * the reading column to a dot on the map. Two implementations would drift.
 *
 * The geometry is a 30x39 teardrop whose tip sits at (15, 38), which is why the
 * map anchors markers to `"bottom"` — the tip, not the bubble, is the location.
 */

/** Native pin size; every other size is a proportional scale of it. */
const PIN_W = 30;
const PIN_H = 39;

export type PinTone = "brand" | "gold";

interface StopPinProps {
  /** 1-based position within its day. */
  n: number;
  tone?: PinTone;
  /** Width in px. Height follows the aspect ratio. */
  size?: number;
  /** Adds the pulsing halo and the drop-in pop. Map only. */
  selected?: boolean;
  /** Map pins float over photography-dense tiles and need the lift. */
  shadow?: boolean;
}

export default function StopPin({
  n,
  tone = "brand",
  size = 26,
  selected = false,
  shadow = false,
}: StopPinProps) {
  // Selection outranks the author's own highlight: only one pin can be the
  // one the card is describing, and it has to be unmistakable.
  const fill =
    selected || tone === "gold"
      ? "var(--color-gold-warm)"
      : "var(--color-brand-500)";

  return (
    <svg
      width={size}
      height={(size * PIN_H) / PIN_W}
      viewBox={`0 0 ${PIN_W} ${PIN_H}`}
      aria-hidden="true"
      className={selected ? "tp-pin-pop" : undefined}
      style={{
        overflow: "visible",
        filter: shadow
          ? "drop-shadow(0 5px 7px rgba(16,45,68,.42))"
          : undefined,
      }}
    >
      {selected && (
        <circle
          className="tp-pin-halo"
          cx="15"
          cy="14"
          r="8"
          fill="var(--color-gold-warm)"
          opacity=".38"
        />
      )}
      <path
        d="M15 38C15 38 28 23.4 28 14A13 13 0 1 0 2 14C2 23.4 15 38 15 38Z"
        fill={fill}
        stroke="#fff"
        strokeWidth="2.4"
      />
      {/* No font-family: the number inherits Hanken Grotesk from <body>, so it
          matches the numerals everywhere else on the page. */}
      <text
        x="15"
        y="19"
        textAnchor="middle"
        fill="#fff"
        fontSize="14"
        fontWeight="800"
      >
        {n}
      </text>
    </svg>
  );
}
