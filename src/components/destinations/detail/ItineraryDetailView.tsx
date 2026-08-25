"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import type { GuideDay } from "@/lib/itinerary";
import type { StopImagePair } from "@/lib/unsplash";
import { useGuideDetail } from "@/lib/hooks/useGuideDetail";
import { useMediaQuery } from "@/lib/utils/useMediaQuery";
import { MapPinIcon } from "@/components/icons";
import GuideHero from "./GuideHero";
import GuideStatsStrip from "./GuideStatsStrip";
import CollapsibleSection from "./CollapsibleSection";
import DaySection from "./DaySection";
import GuideMap from "./GuideMap";
import StopDetailCard from "./StopDetailCard";
import MapOverlaySheet from "./MapOverlaySheet";

/** Matches the `lg:` breakpoint the split layout is drawn at. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Long enough for the day accordion to finish opening, so the row we scroll
 *  to is already at its final offset. */
const SCROLL_SETTLE_MS = 160;

/** Everything the hero photograph needs, all resolved on the server. */
export interface DetailHero {
  title: string;
  accent: string;
  tags: string[];
  image: string;
  imageAlt: string;
  /** Community guides only — a generated plan is never "verified". */
  verified?: boolean;
  /** Photographer attribution, when the photo source requires one. */
  credit?: ReactNode;
}

/** The Days / Stops / Budget / Best time strip under the intro. */
export interface DetailStats {
  days: number;
  stopCount: number;
  /** Symbol the itinerary prices in, e.g. "€". Also used by every stop row. */
  currency: string;
  approxCost: number;
  bestTime: string;
}

export interface ItineraryDetailViewProps {
  hero: DetailHero;
  /**
   * The strip between the hero and the intro: `GuideAuthorBar` for a community
   * guide, the prompt echo for a generated plan. A slot rather than a variant
   * flag because the two share no markup at all.
   */
  byline: ReactNode;
  intro: string;
  stats: DetailStats;
  /** Optional line under the stats — currently the AI-fallback notice on `/plan`. */
  notice?: ReactNode;
  generalTips: string[];
  days: GuideDay[];
  /**
   * Every stop's photos, resolved on the server and keyed
   * `"<dayIndex>-<stopIndex>"` — the same key `useGuideDetail` gives each
   * `ShownStop`. Sparse on purpose: Unsplash's free tier is 50 requests an
   * hour against a ~300-stop corpus, so an absent entry (or a `null` slot
   * inside a present one) is routine and every consumer falls back to
   * `StopThumb`'s gradient placeholder, per slot.
   */
  stopImages: Record<string, StopImagePair>;
  /** `SiteFooter`, passed as a slot so it stays a server component. Only shown
   *  below `lg`; the desktop split is exactly one viewport tall and has no
   *  room for a footer under it. */
  footer: ReactNode;
}

/**
 * The two-pane itinerary template, below the nav.
 *
 * Rendered by both `/destinations/guide/[guideId]/details` (via
 * `GuideDetailView`) and `/plan` (via `PlanDetailView`). It knows nothing about
 * where its content came from — a hand-written community guide and an
 * AI-generated `TripPlan` both reduce to a hero, a byline, an intro, four
 * stats, some tips and a `GuideDay[]`.
 *
 * Desktop is a two-pane split filling the viewport: the reading column scrolls
 * on its own, the map stays put. The height comes entirely from flex — the page
 * wrapper is `h-screen` with `overflow-hidden`, this row is `flex-1 min-h-0`,
 * and the column is `overflow-y-auto`. No pixel arithmetic against the nav's
 * height, so the nav can grow or wrap without breaking the layout.
 *
 * Below `lg` all of that unwinds: the row becomes a column in normal document
 * flow, the map is a modal overlay reached from a floating pill, and the footer
 * appears at the bottom.
 */
export default function ItineraryDetailView({
  hero,
  byline,
  intro,
  stats,
  notice,
  generalTips,
  days,
  stopImages,
  footer,
}: ItineraryDetailViewProps) {
  const state = useGuideDetail(days);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const reduceMotion = useReducedMotion();

  const { selectedKey } = state;

  // Keep the reading column and the map pointing at the same stop: picking a
  // pin scrolls its row into view. `block: "nearest"` means a row that is
  // already visible doesn't move, so selecting from the list is a no-op rather
  // than a jump.
  useEffect(() => {
    if (!selectedKey) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`stop-${selectedKey}`)?.scrollIntoView({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }, SCROLL_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [selectedKey, reduceMotion]);

  // Built once and mounted in exactly one place — either the desktop pane or
  // the overlay, never both, so there is only ever one WebGL context alive.
  // `absolute inset-0` rather than `h-full`: both hosts are positioned boxes
  // with no explicit height, so a percentage height has nothing to resolve
  // against.
  const mapPane = (
    <div className="tp-map absolute inset-0 overflow-hidden bg-[#e9eff2]">
      <GuideMap
        stops={state.shownStops}
        selectedKey={state.selectedKey}
        onSelect={state.selectStop}
        dayFilterLabel={state.dayFilterLabel}
        onClearDayFilter={state.clearDayFilter}
      />
      <StopDetailCard
        selected={state.selected}
        index={state.selectedIndex}
        total={state.shownStops.length}
        // `?? ""` is just a key that can never exist, so nothing selected and
        // nothing resolved take the same `null` path.
        aboutImage={stopImages[state.selected?.key ?? ""]?.about ?? null}
        saved={state.selected ? state.isSaved(state.selected.key) : false}
        onToggleSaved={() =>
          state.selected && state.toggleSaved(state.selected.key)
        }
        onPrev={state.selectPrev}
        onNext={state.selectNext}
        onClose={state.clearSelection}
      />
    </div>
  );

  // A `<main>` rather than a plain wrapper: this *is* the page's content, and
  // both routes that render it put nothing but the nav above it. Purely a
  // landmark change — `flex` overrides the element's default `display`.
  return (
    <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
      <div className="tp-scroll flex min-w-0 flex-col lg:min-h-0 lg:w-[54%] lg:max-w-[820px] lg:flex-none lg:overflow-y-auto lg:border-r lg:border-line xl:w-[50%]">
        <GuideHero
          title={hero.title}
          accent={hero.accent}
          tags={hero.tags}
          image={hero.image}
          imageAlt={hero.imageAlt}
          verified={hero.verified}
          credit={hero.credit}
        />

        <div className="px-5 pt-6 sm:px-8">
          {byline}

          <p className="mt-5 text-[15px] leading-[1.62] text-[#54636c] sm:text-[15.5px]">
            {intro}
          </p>

          <GuideStatsStrip
            days={stats.days}
            stopCount={stats.stopCount}
            currency={stats.currency}
            approxCostEUR={stats.approxCost}
            bestTime={stats.bestTime}
          />

          {notice && <div className="mt-5">{notice}</div>}
        </div>

        <div className="mt-[26px] px-5 sm:px-8">
          <CollapsibleSection
            id="general-tips"
            title="General tips"
            open={state.tipsOpen}
            onToggle={state.toggleTips}
          >
            <ul className="flex list-disc flex-col gap-2.5 py-3.5 pl-5 text-[14px] leading-[1.6] text-[#54636c] sm:text-[14.5px]">
              {generalTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </CollapsibleSection>
        </div>

        <div className="flex flex-col gap-[26px] px-5 pb-24 pt-[30px] sm:px-8 lg:pb-10">
          {days.map((day, dayIndex) => (
            <DaySection
              key={`${day.title}-${dayIndex}`}
              day={day}
              dayIndex={dayIndex}
              currency={stats.currency}
              open={state.isDayOpen(dayIndex)}
              onToggle={() => state.toggleDay(dayIndex)}
              filtered={state.dayFilter === dayIndex}
              onToggleFilter={() => state.toggleDayFilter(dayIndex)}
              selectedKey={state.selectedKey}
              onSelectStop={state.selectStopFromList}
              isSaved={state.isSaved}
              onToggleSaved={state.toggleSaved}
              stopImages={stopImages}
            />
          ))}
        </div>

        {/* The floating Map pill is `fixed`, so it sits over whatever is at the
            bottom of the viewport — including the footer's copyright line once
            you reach it. Padding the footer itself (rather than this wrapper)
            keeps the extra space inside the navy block instead of leaving a
            white band under it. */}
        <div className="mt-auto lg:hidden [&>footer]:pb-[86px]">{footer}</div>
      </div>

      {isDesktop && (
        <div className="relative hidden min-w-0 flex-1 lg:block">{mapPane}</div>
      )}

      {!isDesktop && (
        <>
          {/* Centred with `inset-x-0 mx-auto w-fit` rather than a
              `-translate-x-1/2`, because `.tp-btn`'s hover lift writes to the
              same `transform` and would cancel the centring. */}
          <button
            type="button"
            onClick={state.openMap}
            className="tp-btn fixed inset-x-0 bottom-5 z-30 mx-auto inline-flex w-fit items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-3 text-[14px] font-bold text-white ring-2 ring-white/70 shadow-[0_18px_34px_-14px_rgba(19,74,111,.9)] outline-offset-4 outline-brand-500 focus-visible:outline-2 lg:hidden"
          >
            <MapPinIcon size={17} />
            Map
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[12px] tabular-nums">
              {state.shownStops.length}
            </span>
          </button>

          <AnimatePresence>
            {state.mapOpen && (
              <MapOverlaySheet onClose={state.closeMap}>
                {mapPane}
              </MapOverlaySheet>
            )}
          </AnimatePresence>
        </>
      )}
    </main>
  );
}
