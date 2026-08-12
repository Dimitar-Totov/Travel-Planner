import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import {
  BedIcon,
  CheckIcon,
  MapPinIcon,
  PlaneIcon,
  SpinnerIcon,
} from "@/components/icons";

/**
 * Instant-loading UI for /plan.
 *
 * `PlanPage` awaits `withAiRoute`, which hits a real LLM and can take a few
 * seconds; this file is the Suspense fallback the App Router shows in the
 * meantime. It deliberately renders the *same* shell as the page it replaces
 * (SiteNav onLight, #f4f7f9 background, 1060px container, SiteFooter) and a
 * skeleton shaped like `PlanBoard`, so the swap to the real board is a fill-in
 * rather than a re-layout.
 *
 * Everything animates in CSS (see the `lp-*` block in globals.css) — this stays
 * a server component and ships no JavaScript.
 */

/** Route drawn on the fake map. Kept in sync with the `lp-draw` / `lp-plane`
 *  keyframes: the dash offsets there are derived from these coordinates. */
const ROUTE_PATH = "M150 420 L300 300 L470 330 L620 160";

/** Stop positions plus the moment the plane lands on each (5 / 30 / 54 / 82%
 *  of the shared 5.2s loop), used as the pin's `animation-delay`. */
const STOPS: readonly { x: number; y: number; delay: string }[] = [
  { x: 150, y: 420, delay: "0.26s" },
  { x: 300, y: 300, delay: "1.56s" },
  { x: 470, y: 330, delay: "2.81s" },
  { x: 620, y: 160, delay: "4.26s" },
];

/** Rotating status lines — one visible per 1.6s slot of the 8s `lp-status` loop. */
const STATUS_LINES: readonly string[] = [
  "Reading your sentence",
  "Charting your route",
  "Searching flights",
  "Picking places to stay",
  "Packing your checklist",
];

/** Shimmering placeholder for a value that hasn't arrived yet. */
function Bar({
  w,
  h = 10,
  className = "",
}: {
  w: number | string;
  h?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`lp-shimmer block rounded-full ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px` }}
    />
  );
}

/** The card header rows are real text — only the data is missing. */
function CardHeading({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf2f8] text-[#1c5b83]">
        {icon}
      </span>
      {label}
    </span>
  );
}

export default function PlanLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7f9]">
      <SiteNav variant="onLight" />

      <main className="flex-1">
        <div className="mx-auto max-w-[1060px] px-4 py-9 sm:px-6 sm:py-12">
          {/* One polite announcement stands in for the whole decorative scene. */}
          <p role="status" className="sr-only">
            Building your trip plan — charting your route, searching flights and
            stays, and packing your checklist. This usually takes a few seconds.
          </p>

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="mt-2 text-[24px] font-extrabold tracking-[-.02em] text-ink sm:text-[28px]">
                Planning{" "}
                <span className="font-serif font-normal italic tracking-normal">
                  your trip
                </span>
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                Turning your sentence into a route, flights, stays and a
                checklist.
              </p>
            </div>
          </div>

          {/* PlanBoard skeleton */}
          <div className="tp-rise box-border w-full overflow-hidden rounded-3xl border border-[#e6e9ee] bg-white text-ink shadow-[0_40px_90px_-50px_rgba(20,52,78,.55),0_8px_30px_-18px_rgba(20,52,78,.25)]">
            {/* header bar — mirrors PlanBoard's, in its "Planning" state */}
            <div className="flex items-center justify-between gap-4 border-b border-[#eef1f5] bg-[linear-gradient(180deg,#fbfcfd,#f6f8fa)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[linear-gradient(150deg,#2f7fb0,#164e73)] text-white">
                  <MapPinIcon size={15} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <Bar w="100%" h={11} className="max-w-[168px]" />
                  <Bar w="100%" h={9} className="max-w-[228px]" />
                </div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-[11px] py-[5px] text-[12px] font-semibold"
                  style={{
                    color: "#8a6d1f",
                    background: "#fbf3df",
                    borderColor: "#f0e2bd",
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "#c69a3a" }}
                  />
                  Planning
                </span>
                <span className="rounded-full border border-[#d4e6f1] bg-[#eaf2f8] px-[11px] py-[7px]">
                  <Bar w={68} h={9} />
                </span>
              </div>
            </div>

            {/* body */}
            <div className="bg-[#f6f8fa] p-[18px]">
              <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1.5fr_1fr]">
                {/* map card — the animated centrepiece */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="flex items-center justify-between px-[15px] pb-2.5 pt-3">
                    <span className="text-[12px] font-bold uppercase tracking-[.09em] text-[#5c6b76]">
                      Route &amp; map
                    </span>
                    <span className="text-[11.5px] text-[#8b98a1]">
                      plotting stops…
                    </span>
                  </div>

                  <div
                    className="relative w-full flex-1 bg-[#e8eff4]"
                    style={{ aspectRatio: "780 / 560" }}
                  >
                    <svg
                      viewBox="0 0 780 560"
                      className="absolute inset-0 h-full w-full"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <defs>
                        <pattern
                          id="lp-dots"
                          width="26"
                          height="26"
                          patternUnits="userSpaceOnUse"
                        >
                          <circle cx="1.7" cy="1.7" r="1.7" fill="#c6d6e2" />
                        </pattern>
                        <linearGradient
                          id="lp-route-stroke"
                          x1="0"
                          y1="1"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#5ea8d3" />
                          <stop offset="100%" stopColor="#134a6f" />
                        </linearGradient>
                      </defs>

                      {/* abstract landmass so the dot lattice reads as a map */}
                      <path
                        d="M60 300 C120 210 240 190 330 232 C420 274 470 214 560 226 C650 238 706 196 740 220 L740 560 L60 560 Z"
                        fill="#dfe9f0"
                      />
                      <path
                        d="M96 128 C170 84 268 96 320 136 C372 176 340 210 262 208 C184 206 96 186 96 128 Z"
                        fill="#e3ecf2"
                      />
                      <rect width="780" height="560" fill="url(#lp-dots)" />

                      {/* the itinerary, ghosted, then drawn stop by stop */}
                      <path
                        d={ROUTE_PATH}
                        fill="none"
                        stroke="#b9cbd8"
                        strokeWidth="3"
                        strokeDasharray="2 11"
                        strokeLinecap="round"
                      />
                      {/* radar ping on the destination pin's head */}
                      <circle
                        className="tp-map-pulse"
                        cx="620"
                        cy="140"
                        r="7"
                        fill="#2f7fb0"
                        opacity=".45"
                      />
                      <path
                        className="lp-draw"
                        d={ROUTE_PATH}
                        fill="none"
                        stroke="url(#lp-route-stroke)"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {STOPS.map((stop) => (
                        <g
                          key={`${stop.x}-${stop.y}`}
                          transform={`translate(${stop.x} ${stop.y})`}
                        >
                          <g
                            className="lp-pin"
                            style={{ animationDelay: stop.delay }}
                          >
                            <path
                              d="M0 0 C0 0 -11 -13 -11 -20 A11 11 0 1 1 11 -20 C11 -13 0 0 0 0 Z"
                              fill="#134a6f"
                            />
                            <circle cx="0" cy="-20" r="4.4" fill="#ffffff" />
                          </g>
                        </g>
                      ))}

                      {/* Same paper-plane silhouette as PlaneIcon, filled and
                          re-centred on its own origin so `lp-plane` can rotate
                          it about its middle. */}
                      <g className="lp-plane">
                        <g transform="scale(1.55) translate(-12.5 -11.5)">
                          <path
                            d="M3 11l19-9-9 19-2-8-8-2z"
                            fill="#0f3d5b"
                            stroke="#ffffff"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                        </g>
                      </g>
                    </svg>

                    {/* Rotating status, parked in the bottom-right — the only
                        corner the route never crosses, so the panel can grow
                        into a full five-line list under reduced motion without
                        covering a stop. */}
                    <div className="pointer-events-none absolute bottom-3 right-3 max-w-[calc(100%-24px)]">
                      <div className="inline-flex items-start gap-2.5 rounded-xl border border-white/70 bg-white/85 px-3 py-2.5 shadow-[0_12px_26px_-18px_rgba(20,52,78,.8)] backdrop-blur-[3px]">
                        <span className="flex-none pt-[1px] text-[#2f7fb0]">
                          <SpinnerIcon size={15} />
                        </span>
                        <div
                          aria-hidden="true"
                          className="lp-status-list relative h-[17px] w-[152px] max-w-full"
                        >
                          {STATUS_LINES.map((line, i) => (
                            <span
                              key={line}
                              className="lp-status absolute inset-x-0 top-0 block truncate text-[12.5px] font-semibold leading-[17px] text-[#245374]"
                              style={{ animationDelay: `${i * 1.6}s` }}
                            >
                              {line}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* flights + checklist */}
                <div className="flex flex-col gap-3.5">
                  {/* FlightsCard skeleton */}
                  <div className="flex-1 rounded-2xl border border-line bg-white p-[15px]">
                    <div className="mb-3 flex items-center justify-between">
                      <CardHeading
                        icon={<PlaneIcon size={13} />}
                        label="Flights"
                      />
                      <span className="rounded-md bg-[#f1f4f7] px-2 py-[3px] text-[10.5px] font-semibold text-muted-2">
                        round trip
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-[7px] pt-[2px]">
                        <Bar w={124} h={11} />
                        <Bar w={148} h={9} />
                      </div>
                      <div className="flex flex-none flex-col items-end gap-[7px] pt-[2px]">
                        <Bar w={62} h={15} />
                        <Bar w={34} h={8} />
                      </div>
                    </div>

                    <div className="my-[11px] h-px bg-[#eef1f5]" />

                    <div className="flex items-center justify-between gap-2">
                      <Bar w={104} h={9} />
                      <Bar w={44} h={9} />
                    </div>

                    <div className="mt-3">
                      <Bar w={132} h={8} />
                    </div>
                  </div>

                  {/* ChecklistCard skeleton */}
                  <div className="flex-1 rounded-2xl border border-line bg-white p-[15px]">
                    <div className="mb-3 flex items-center justify-between">
                      <CardHeading
                        icon={<CheckIcon size={13} />}
                        label="Travel checklist"
                      />
                      <Bar w={28} h={9} />
                    </div>

                    <div className="mb-[13px] h-[5px] overflow-hidden rounded-full bg-[#eaeef2]">
                      <div
                        aria-hidden="true"
                        className="lp-bar h-full w-[30%] rounded-full bg-[linear-gradient(90deg,#2f7fb0,#164e73)]"
                      />
                    </div>

                    <ul className="m-0 list-none p-0">
                      {["88%", "70%", "96%", "78%", "62%"].map((w) => (
                        <li
                          key={w}
                          className="flex items-center gap-[9px] py-[5px]"
                        >
                          <span className="inline-flex h-[17px] w-[17px] flex-none rounded-[5px] border-[1.5px] border-[#cbd4da]" />
                          <Bar w={w} h={9} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* HotelsCard skeleton */}
              <div className="mt-3.5 rounded-2xl border border-line bg-white p-[15px]">
                <div className="mb-[13px] flex items-center justify-between">
                  <CardHeading
                    icon={<BedIcon size={13} />}
                    label="Where you’ll stay"
                  />
                  <Bar w={112} h={9} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {["a", "b", "c"].map((key) => (
                    <div
                      key={key}
                      className="overflow-hidden rounded-[13px] border border-[#eef1f5] bg-[#fbfcfd]"
                    >
                      <div
                        className="lp-shimmer h-[74px] w-full"
                        aria-hidden="true"
                      />
                      <div className="flex flex-col gap-[7px] px-[11px] pb-3 pt-2.5">
                        <Bar w="80%" h={11} />
                        <Bar w="55%" h={8} />
                        <div className="mt-[5px] flex items-baseline justify-between gap-2">
                          <Bar w={46} h={8} />
                          <Bar w={38} h={10} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
