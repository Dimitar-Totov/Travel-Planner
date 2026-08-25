/** Inline icon set ported 1:1 from the design doc (Lucide-style line icons). */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({
  size = 18,
  strokeWidth = 2,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </Stroke>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Stroke>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M20 6L9 17l-5-5" />
    </Stroke>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.2 2.2 4.8-4.8" />
    </Stroke>
  );
}

export function BedIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={1.9} {...props}>
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </Stroke>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.2} {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Stroke>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.2} {...props}>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </Stroke>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.2} {...props}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </Stroke>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Stroke>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z" />
    </Stroke>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M1.5 12S5 5.5 12 5.5S22.5 12 22.5 12S19 18.5 12 18.5S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Stroke>
  );
}

/** Indeterminate ring spinner. The arc spins via the shared `.tp-spin` class,
 *  so `prefers-reduced-motion` leaves a legible static ring behind. */
export function SpinnerIcon({
  size = 16,
  strokeWidth = 2.6,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="9" opacity=".28" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        strokeLinecap="round"
        className="tp-spin"
      />
    </svg>
  );
}

export function SparkleIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 2c.3 4.2 3.8 7.7 8 8-4.2.3-7.7 3.8-8 8-.3-4.2-3.8-7.7-8-8 4.2-.3 7.7-3.8 8-8z" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.2} {...props}>
      <path d="M6 9l6 6 6-6" />
    </Stroke>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.4} {...props}>
      <path d="M14 6l-6 6 6 6" />
    </Stroke>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.4} {...props}>
      <path d="M10 6l6 6-6 6" />
    </Stroke>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.4} {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Stroke>
  );
}

/** Closed padlock — the sign-in gate on planning actions. */
export function LockIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </Stroke>
  );
}

/** Share sheet glyph — a tray with an arrow lifting out of it. */
export function ShareIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
    </Stroke>
  );
}

/** Same tray, arrow pointing in — used for the map's Export affordance. */
export function DownloadIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={2.1} {...props}>
      <path d="M12 3v13" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </Stroke>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.8-.4L4 21l1.5-4.2A8.3 8.3 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </Stroke>
  );
}

/** Outline ribbon. `filled` swaps to a solid silhouette for the saved state —
 *  one component so the two states share the exact same geometry and the pill
 *  never shifts by a pixel when it toggles. */
export function BookmarkIcon({
  filled = false,
  ...rest
}: IconProps & { filled?: boolean }) {
  const path = "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z";
  if (filled) {
    const { size = 18, ...svgRest } = rest;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...svgRest}
      >
        <path d={path} />
      </svg>
    );
  }
  return (
    <Stroke strokeWidth={2.1} {...rest}>
      <path d={path} />
    </Stroke>
  );
}

/* ---- Transfer modes (guide detail stop connectors) ----------------------
   One icon per `TransferMode` in `lib/guideItineraries.ts`, except "flight",
   which reuses `PlaneIcon` above. Drawn on the same 24x24 Lucide grid as the
   rest of the set so they sit optically level in a 22px circle. */

export function WalkIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="13" cy="4" r="2" />
      <path d="M11 21l-1-5-3-3 2-6" />
      <path d="M9 7l4 2 3 3" />
      <path d="M7 21l3-5" />
    </Stroke>
  );
}

export function MetroIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="5" y="3" width="14" height="14" rx="4" />
      <path d="M5 11h14" />
      <path d="M8.6 14.2h.01" />
      <path d="M15.4 14.2h.01" />
      <path d="M8 21l1.8-3" />
      <path d="M16 21l-1.8-3" />
    </Stroke>
  );
}

export function TrainIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="4" y="3" width="16" height="13" rx="2.5" />
      <path d="M4 10h16" />
      <path d="M8.2 13.2h.01" />
      <path d="M15.8 13.2h.01" />
      <path d="M7 21l2.4-3" />
      <path d="M17 21l-2.4-3" />
      <path d="M4 18h16" />
    </Stroke>
  );
}

export function BusIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7.2 13.2h.01" />
      <path d="M16.8 13.2h.01" />
      <path d="M7 16v3" />
      <path d="M17 16v3" />
    </Stroke>
  );
}

export function TramIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="6" y="4" width="12" height="13" rx="2.5" />
      <path d="M6 10h12" />
      <path d="M12 4V2" />
      <path d="M9 21l1.6-4" />
      <path d="M15 21l-1.6-4" />
      <path d="M4 21h16" />
    </Stroke>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
      <path d="M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
      <path d="M5 17H3v-5l2-5h9l4 5h3v5h-2" />
      <path d="M9 17h6" />
    </Stroke>
  );
}

export function FerryIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 18.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2" />
      <path d="M4.5 15.5L6 10h12l1.5 5.5" />
      <path d="M12 10V5" />
      <path d="M9 5h6" />
    </Stroke>
  );
}

export function BikeIcon(props: IconProps) {
  return (
    <Stroke strokeWidth={1.9} {...props}>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="1" />
      <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
    </Stroke>
  );
}
