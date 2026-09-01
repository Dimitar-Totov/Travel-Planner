import SiteNav from "@/components/site/SiteNav";
import { SpinnerIcon } from "@/components/icons";

/**
 * The loading-state counterpart of `ItineraryDetailView`.
 *
 * `/plan` and `/guides/guide/[guideId]/details` render the same detail
 * template through different adapters (`PlanDetailView`, `GuideDetailView`),
 * so their instant-loading UI is the same silhouette too — the nav, the
 * viewport-filling `lg` split, the reading column's hero / byline / intro /
 * stats / tips / day accordions, and a flat map pane beside them. Drawing the
 * shape the real page is about to occupy makes the swap a fill-in rather than
 * a re-layout, which is what a skeleton is for.
 *
 * Only the wording differs between the two routes, so only the wording is a
 * prop: the rotating status lines and the one polite announcement that stands
 * in for the whole decorative skeleton. Both routes render `SiteNav` with
 * `variant="onLight"` and both pass `SiteFooter` into the template, so neither
 * is parameterized — a third caller that genuinely differs can add the prop
 * then.
 *
 * Everything animates in CSS (`.lp-shimmer`, `.lp-status`, `.tp-map-pulse` in
 * globals.css, all of which have `prefers-reduced-motion` fallbacks) — this
 * stays a server component and ships no JavaScript.
 *
 * There is no footer: the real pages only show one below `lg`, under a column
 * that is far taller than this skeleton, so putting one here would park it
 * mid-viewport.
 */

/** Header washes, matching `CollapsibleSection`'s open/closed states. */
const WASH_OPEN = "linear-gradient(90deg,#eaf3f9,rgba(234,243,249,0))";
const WASH_CLOSED = "linear-gradient(90deg,#f2f5f7,rgba(242,245,247,0))";

/**
 * Rotating status lines — one visible per 1.6s slot of the 8s `lp-status`
 * loop, so the count has to stay at exactly five. A fixed-length tuple rather
 * than `readonly string[]` so that's the compiler's problem, not a caller's
 * memory: four lines leave a silent gap in the cycle and six overlap.
 */
export type StatusLineSet = readonly [string, string, string, string, string];

interface ItineraryDetailSkeletonProps {
  /** Exactly five short present-participle lines, shown in order. */
  statusLines: StatusLineSet;
  /**
   * What a screen reader hears once, politely, in place of the skeleton.
   * Route-specific because the honest wait differs: `/plan` runs a model call,
   * a guide is a database read.
   */
  announcement: string;
}

/** Shimmering placeholder for a value that hasn't arrived yet. */
function Bar({
  w,
  h = 10,
  radius = "rounded-full",
  className = "",
}: {
  w: number | string;
  h?: number;
  /** Rounding utility. A prop rather than something `className` overrides,
   *  because two competing `rounded-*` utilities resolve by CSS source order,
   *  not by the order they appear in the attribute. */
  radius?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`lp-shimmer block ${radius} ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px` }}
    />
  );
}

/** The rotating progress caption. Mounted twice — in the desktop map pane and
 *  in the mobile pill — but only ever one of them is on screen. */
function StatusLines({ lines }: { lines: StatusLineSet }) {
  return (
    <span className="inline-flex items-start gap-2.5">
      <span className="flex-none pt-[1px] text-[#2f7fb0]">
        <SpinnerIcon size={15} />
      </span>
      <span
        aria-hidden="true"
        className="lp-status-list relative block h-[17px] w-[158px] max-w-full"
      >
        {lines.map((line, i) => (
          <span
            key={line}
            className="lp-status absolute inset-x-0 top-0 block truncate text-[12.5px] leading-[17px] font-semibold text-[#245374]"
            style={{ animationDelay: `${i * 1.6}s` }}
          >
            {line}
          </span>
        ))}
      </span>
    </span>
  );
}

/** One collapsed day section: the header wash, its title and its subtitle. */
function DayHeader({ open = false }: { open?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 sm:px-4 sm:py-3.5"
      style={{ background: open ? WASH_OPEN : WASH_CLOSED }}
    >
      <span className="flex min-w-0 flex-col gap-2.5">
        <Bar w={112} h={17} />
        <Bar w={196} h={10} className="max-w-full" />
      </span>
      <Bar w={19} h={19} className="flex-none" />
    </div>
  );
}

/** A stop row inside the one day that starts expanded. */
function StopRowSkeleton({ alternate }: { alternate: boolean }) {
  return (
    <div
      className={`flex gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4 ${
        alternate ? "bg-surface-3" : ""
      }`}
    >
      <Bar w={24} h={30} radius="rounded-[10px]" className="mt-0.5 flex-none" />
      <div className="flex min-w-0 flex-1 flex-col-reverse gap-3 sm:flex-row sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Bar w="62%" h={15} />
          <span className="flex gap-1.5">
            <Bar w={54} h={20} radius="rounded-md" />
            <Bar w={72} h={20} radius="rounded-md" />
          </span>
          <Bar w="94%" h={9} />
          <Bar w="78%" h={9} />
        </div>
        <span
          aria-hidden="true"
          className="lp-shimmer block h-[128px] w-full flex-none rounded-[13px] sm:h-[112px] sm:w-[170px] lg:h-[88px] lg:w-[132px] xl:h-[112px] xl:w-[170px]"
        />
      </div>
    </div>
  );
}

export default function ItineraryDetailSkeleton({
  statusLines,
  announcement,
}: ItineraryDetailSkeletonProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:h-screen lg:overflow-hidden">
      <SiteNav variant="onLight" />

      {/* One polite announcement stands in for the whole decorative skeleton. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* `<main>` here as well as in the real split, so the landmark doesn't
          blink in and out as the page resolves. */}
      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* Reading column. `overflow-hidden` rather than the real page's
            `overflow-y-auto`: there is nothing here worth scrolling to, and a
            scrollbar that appears now and stays is a visible seam. */}
        <div className="flex min-w-0 flex-col lg:min-h-0 lg:w-[54%] lg:max-w-[820px] lg:flex-none lg:overflow-hidden lg:border-r lg:border-line xl:w-[50%]">
          {/* Hero. The bars sit on the same dark scrim the real headline does,
              so they are flat white rather than the light `lp-shimmer` — a grey
              shimmer would read as a hole in the photograph. */}
          <div className="relative h-[240px] flex-none overflow-hidden bg-[#dde6ec] sm:h-[300px] lg:h-[330px]">
            <span
              aria-hidden="true"
              className="lp-shimmer absolute inset-0 block"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg,rgba(11,36,56,.34) 0%,rgba(11,36,56,0) 34%,rgba(11,36,56,.82) 100%)",
              }}
            />
            <div
              aria-hidden="true"
              className="tp-rise absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-[26px]"
            >
              <span className="block h-[26px] w-[78%] max-w-[430px] rounded-lg bg-white/30 sm:h-[32px] lg:h-[38px]" />
              <span className="mt-2.5 block h-[26px] w-[46%] max-w-[260px] rounded-lg bg-white/20 sm:h-[32px] lg:h-[38px]" />
              <span className="mt-4 flex gap-2">
                <span className="block h-[27px] w-[88px] rounded-full bg-white/20" />
                <span className="block h-[27px] w-[104px] rounded-full bg-white/20" />
              </span>
            </div>
          </div>

          <div className="px-5 pt-6 sm:px-8">
            {/* Byline */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-[11px]">
                <Bar w={42} h={42} className="flex-none" />
                <div className="flex min-w-0 flex-col gap-2">
                  <Bar w={184} h={12} />
                  <Bar w={236} h={10} className="max-w-full" />
                </div>
              </div>
              <Bar w={158} h={41} className="hidden flex-none sm:block" />
            </div>

            {/* Intro */}
            <div className="mt-5 flex flex-col gap-2.5">
              <Bar w="100%" h={10} />
              <Bar w="97%" h={10} />
              <Bar w="88%" h={10} />
            </div>

            {/* Stats strip */}
            <dl className="mt-[22px] grid grid-cols-2 gap-x-3 gap-y-4 border-t border-[#eef1f4] pt-4 sm:grid-cols-4">
              {["days", "stops", "budget", "best-time"].map((stat) => (
                <div key={stat} className="flex flex-col gap-2.5">
                  <Bar w={58} h={9} />
                  <Bar w={72} h={16} />
                </div>
              ))}
            </dl>
          </div>

          {/* General tips */}
          <div className="mt-[26px] px-5 sm:px-8">
            <div
              className="flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 sm:px-4 sm:py-3.5"
              style={{ background: WASH_OPEN }}
            >
              <Bar w={126} h={16} />
              <Bar w={19} h={19} className="flex-none" />
            </div>
            <div className="flex flex-col gap-2.5 py-3.5 pl-5">
              <Bar w="82%" h={9} />
              <Bar w="74%" h={9} />
              <Bar w="66%" h={9} />
            </div>
          </div>

          {/* Days */}
          <div className="flex flex-col gap-[26px] px-5 pt-[30px] pb-24 sm:px-8 lg:pb-10">
            <div>
              <DayHeader open />
              <div className="pt-1.5 pb-1">
                <StopRowSkeleton alternate={false} />
                <StopRowSkeleton alternate />
              </div>
            </div>
            <DayHeader />
            <DayHeader />
            <DayHeader />
          </div>
        </div>

        {/* Map pane — flat on purpose. The real one is a MapLibre canvas that
            fits itself to the stops; anything more drawn here would be a route
            we don't have yet. */}
        <div className="relative hidden min-w-0 flex-1 overflow-hidden bg-[#e9eff2] lg:block">
          <svg
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <pattern
                id="lp-map-dots"
                width="26"
                height="26"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1.7" cy="1.7" r="1.7" fill="#cfdde6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lp-map-dots)" />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <svg
              width="60"
              height="60"
              viewBox="0 0 60 60"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                className="tp-map-pulse"
                cx="30"
                cy="30"
                r="7"
                fill="#2f7fb0"
                opacity=".45"
              />
              <circle cx="30" cy="30" r="6" fill="#134a6f" />
            </svg>

            <span className="inline-flex items-start gap-2.5 rounded-xl border border-white/70 bg-white/85 px-3 py-2.5 shadow-[0_12px_26px_-18px_rgba(20,52,78,.8)] backdrop-blur-[3px]">
              <StatusLines lines={statusLines} />
            </span>
          </div>
        </div>
      </main>

      {/* Below `lg` the map is a modal, so its pill is the only place the
          progress caption can live. Same footprint as the real button. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-5 z-30 mx-auto inline-flex w-fit items-center rounded-full border border-white/70 bg-white/90 px-4 py-3 shadow-[0_18px_34px_-16px_rgba(19,74,111,.6)] backdrop-blur-[3px] lg:hidden"
      >
        <StatusLines lines={statusLines} />
      </div>
    </div>
  );
}
