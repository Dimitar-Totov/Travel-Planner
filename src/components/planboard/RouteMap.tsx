import type { RoutePlan, RouteStop } from "@/lib/types";

/**
 * Self-contained SVG route map — no D3, no topojson, no runtime CDN calls (the
 * design doc iframed a D3 map; this renders inline so it streams with the page
 * and costs nothing on the client bundle beyond a little markup + CSS).
 *
 * Two modes:
 *  - `mapShape="italy"` → the bespoke stylized boot with fixed, hand-placed pin
 *    positions for Rome / Florence / Venice (the canonical demo).
 *  - otherwise → an evenly-spaced "journey" arc through the stops. The board
 *    labels the map "illustrative"; even spacing keeps any itinerary legible
 *    (a true geographic projection collapses near-collinear cities — e.g.
 *    Kyoto/Osaka vs. Tokyo — into an unreadable cluster).
 */

const W = 780;
const H = 580;

type Placement = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  lx: number;
  nameY: number;
  subY: number;
};

// Fixed pin positions that sit on the hand-drawn Italy silhouette below.
const ITALY_COORDS: Record<string, { x: number; y: number }> = {
  Rome: { x: 405, y: 340 },
  Florence: { x: 368, y: 276 },
  Venice: { x: 446, y: 212 },
};

// Simplified, low-poly Italy — reads as the boot without a topojson payload.
const ITALY_MAINLAND =
  "M250 214 L300 168 L345 150 L402 148 L452 158 L498 178 L486 232 L505 286 " +
  "L538 340 L566 378 L596 404 L602 414 L590 420 L566 410 L546 430 L516 436 " +
  "L492 452 L470 486 L452 512 L440 516 L434 500 L430 470 L414 452 L400 410 " +
  "L388 372 L392 344 L372 300 L348 262 L322 236 L286 226 L258 224 Z";
const ITALY_SICILY = "M398 532 L456 520 L470 540 L440 560 L406 548 Z";
const ITALY_SARDINIA =
  "M238 352 C250 342 266 352 268 374 C270 398 256 412 240 406 C226 400 224 364 238 352 Z";

/** Italy: fixed positions, labels flanking the pins (rightmost to the right). */
function italyPlacements(stops: RouteStop[]): Placement[] {
  const pts = stops.map((s) => ITALY_COORDS[s.name] ?? { x: W / 2, y: H / 2 });
  const rightmost = pts.reduce((best, p, i) => (p.x > pts[best].x ? i : best), 0);
  return pts.map((p, i) => ({
    x: p.x,
    y: p.y,
    anchor: i === rightmost ? "start" : "end",
    lx: i === rightmost ? 15 : -14,
    nameY: 5,
    subY: 21,
  }));
}

/** Generic: evenly spaced left→right on a gentle arc, labels centered below. */
function genericPlacements(stops: RouteStop[]): Placement[] {
  const n = stops.length;
  if (n === 1) {
    return [{ x: W / 2, y: H * 0.5, anchor: "middle", lx: 0, nameY: 34, subY: 50 }];
  }
  const padL = 150;
  const padR = 150;
  const baseY = H * 0.52;
  const amp = n > 2 ? 58 : 0; // bow the middle of multi-stop routes upward
  return stops.map((_, i) => {
    const t = i / (n - 1);
    return {
      x: padL + t * (W - padL - padR),
      y: baseY - amp * Math.sin(t * Math.PI),
      anchor: "middle",
      lx: 0,
      nameY: 34,
      subY: 50,
    };
  });
}

/** Smooth-ish path through the points (natural-looking route line). */
function routePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x} ${points[0].y}`;
  const p = points;
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function RouteMap({
  route,
  days,
  budget,
  currency,
  mapShape,
}: {
  route: RoutePlan;
  days: number;
  budget: number;
  currency: string;
  mapShape?: "italy";
}) {
  const isItaly = mapShape === "italy";
  const placements = isItaly ? italyPlacements(route.stops) : genericPlacements(route.stops);

  const gridLines: React.ReactElement[] = [];
  for (let x = 0; x <= W; x += 52) {
    gridLines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke="#d3e0e8" strokeWidth={0.8} />,
    );
  }
  for (let y = 0; y <= H; y += 52) {
    gridLines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="#d3e0e8" strokeWidth={0.8} />,
    );
  }

  return (
    <div className="absolute inset-0 h-full w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
        role="img"
        aria-label={`Route map: ${route.summary}`}
      >
        <defs>
          <filter id="tp-land-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx={0} dy={5} stdDeviation={7} floodColor="#1c4a6b" floodOpacity={0.28} />
          </filter>
          <radialGradient id="tp-sea-glow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#f2f7fa" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#e8eff4" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* sea */}
        <rect x={0} y={0} width={W} height={H} fill="#e8eff4" />
        <g opacity={0.55}>{gridLines}</g>
        {!isItaly && <rect x={0} y={0} width={W} height={H} fill="url(#tp-sea-glow)" />}

        {/* land */}
        {isItaly && (
          <g filter="url(#tp-land-shadow)">
            <path
              d={ITALY_MAINLAND}
              fill="#fbf8f1"
              stroke="#1c5b83"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <path d={ITALY_SICILY} fill="#fbf8f1" stroke="#1c5b83" strokeWidth={1.5} strokeLinejoin="round" />
            <path d={ITALY_SARDINIA} fill="#fbf8f1" stroke="#1c5b83" strokeWidth={1.5} strokeLinejoin="round" />
          </g>
        )}

        {/* route line */}
        <path
          d={routePath(placements)}
          fill="none"
          stroke="#1c5b83"
          strokeWidth={2.2}
          strokeDasharray="1 8"
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* pins */}
        {placements.map((pl, i) => {
          const stop = route.stops[i];
          return (
            <g key={stop.name} transform={`translate(${pl.x},${pl.y})`}>
              {i === 0 && <circle className="tp-map-pulse" r={7} fill="#2f7fb0" />}
              <circle r={13} fill="#17527a" opacity={0.1} />
              <circle r={6.5} fill="#17527a" stroke="#fff" strokeWidth={2.5} />
              <text
                x={pl.lx}
                y={pl.nameY}
                textAnchor={pl.anchor}
                fontWeight={700}
                fontSize={16}
                fill="#16242d"
                paintOrder="stroke"
                stroke="#fbf8f1"
                strokeWidth={3.4}
                strokeLinejoin="round"
              >
                {stop.name}
              </text>
              <text
                x={pl.lx}
                y={pl.subY}
                textAnchor={pl.anchor}
                fontWeight={600}
                fontSize={11.5}
                fill="#5f7078"
                paintOrder="stroke"
                stroke="#fbf8f1"
                strokeWidth={3}
                strokeLinejoin="round"
              >
                {stop.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* overlay chips */}
      <span className="tp-chip absolute left-4 top-3.5 inline-flex items-center gap-2 rounded-full border border-brand-600/15 bg-white/80 px-3.5 py-[7px] text-[12.5px] font-semibold text-[#1c5b83] shadow-[0_6px_20px_-12px_rgba(20,60,90,.5)] backdrop-blur-sm">
        <span className="h-[7px] w-[7px] rounded-full bg-gold-2" />
        {route.summary}
      </span>
      <span className="absolute right-4 top-3.5 inline-flex items-center gap-2 rounded-full border border-brand-600/15 bg-white/80 px-3.5 py-[7px] text-[12.5px] font-semibold text-ink shadow-[0_6px_20px_-12px_rgba(20,60,90,.5)] backdrop-blur-sm">
        <span className="h-[7px] w-[7px] rounded-full bg-brand-500" />
        {days} days · {currency}
        {budget.toLocaleString()}
      </span>

      {/* legend */}
      <div className="absolute bottom-3.5 left-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#4a5b66]">
          <span className="h-0 w-5 rounded-sm border-t-[2.5px] border-dashed border-[#1c5b83]" />
          Suggested route
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#4a5b66]">
          <span className="h-[11px] w-[11px] rounded-full border-2 border-white bg-[#17527a] shadow-[0_0_0_1px_rgba(23,82,122,.25)]" />
          Overnight stop
        </div>
      </div>
      <div className="absolute bottom-2.5 right-3 font-mono text-[9.5px] lowercase tracking-[.02em] text-[#8a99a3]">
        {route.distanceKm > 0 ? `${route.distanceKm} km · illustrative` : "illustrative"}
      </div>
    </div>
  );
}
