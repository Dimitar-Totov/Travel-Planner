"use client";

import { useMemo, useState } from "react";
import { SearchIcon, ArrowDownIcon } from "@/components/icons";
import GuideCard from "./GuideCard";
import {
  destinationGuides,
  popularDestinations,
  type DestinationGuide,
} from "@/lib/destinationGuides";

type TabId = "recent" | "loved" | "budget" | "weekends";

/** `heading` swaps the section title so it always describes what's listed. */
const TABS: { id: TabId; label: string; heading: string }[] = [
  { id: "recent", label: "Recent", heading: "Recent guides" },
  { id: "loved", label: "Most loved", heading: "Most loved guides" },
  { id: "budget", label: "Budget under €1k", heading: "Guides under €1k" },
  { id: "weekends", label: "Weekends", heading: "Weekend guides" },
];

const PAGE_SIZE = 8;

/** Faint 52px vertical rules, continuing the pattern from `DestinationsHero`
 *  across the seam between the two bands. */
const BAND_PATTERN =
  "repeating-linear-gradient(90deg, rgba(19,74,111,.035) 0 1px, transparent 1px 52px)";

/** Applies the active tab's sort/filter. "recent" keeps the authored order. */
function guidesForTab(tab: TabId): DestinationGuide[] {
  switch (tab) {
    case "loved":
      return [...destinationGuides].sort((a, b) => b.likes - a.likes);
    case "budget":
      return destinationGuides.filter((g) => g.approxCostEUR < 1000);
    case "weekends":
      return destinationGuides.filter((g) => g.days <= 4);
    case "recent":
      return destinationGuides;
  }
}

function matchesQuery(guide: DestinationGuide, needle: string): boolean {
  return (
    guide.title.toLowerCase().includes(needle) ||
    guide.author.toLowerCase().includes(needle) ||
    guide.blurb.toLowerCase().includes(needle)
  );
}

/**
 * The interactive half of /destinations: the search band, the tab row, and the
 * paged guide feed. Everything filters client-side over the hardcoded
 * `destinationGuides` list — there is no guides API yet. Typing does NOT
 * filter live: `draft` tracks the input as the user types, and `query` (the
 * value results are actually filtered against) only advances on an explicit
 * search action — the Search button/Enter, a popular-destination chip, or
 * "See more…".
 */
export default function DestinationsExplorer() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const tabbed = guidesForTab(activeTab);
    return needle ? tabbed.filter((g) => matchesQuery(g, needle)) : tabbed;
  }, [query, activeTab]);

  const visible = results.slice(0, visibleCount);
  const hasMore = results.length > visibleCount;
  const heading =
    TABS.find((t) => t.id === activeTab)?.heading ?? TABS[0].heading;

  function search(next: string) {
    setDraft(next);
    setQuery(next);
    setVisibleCount(PAGE_SIZE);
  }

  function selectTab(next: TabId) {
    setActiveTab(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#eef1f4] bg-[linear-gradient(180deg,#fbfcfd_0%,#fff_100%)] px-6 pb-[58px] pt-[30px] sm:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: BAND_PATTERN }}
        />

        <div className="relative mx-auto max-w-[720px]">
          {/* Typing only updates the draft text — results don't filter until
              this submits (Search button or Enter). */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(draft);
            }}
            className="tp-rise flex items-center gap-2.5 rounded-2xl border border-[#dbe4ea] bg-white py-2 pl-[18px] pr-2 shadow-[0_24px_50px_-32px_rgba(20,52,78,.55)]"
          >
            <label htmlFor="destination-search" className="sr-only">
              Search for a destination
            </label>
            <span className="flex-none text-[#94a4ad]">
              <SearchIcon size={19} />
            </span>
            <input
              id="destination-search"
              name="destination"
              type="search"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search for a destination"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16.5px] font-medium text-ink outline-none placeholder:text-[#8a98a1] [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="submit"
              className="tp-btn flex-none rounded-xl bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-[22px] py-3 text-[14.5px] font-bold text-white shadow-[0_14px_26px_-14px_rgba(19,74,111,.9)]"
            >
              Search
            </button>
          </form>

          <div className="mt-[22px] text-center text-[13.5px] text-[#7c8a93]">
            Or browse our most popular destinations:
          </div>

          <div className="mt-[13px] flex flex-wrap justify-center gap-[9px]">
            {popularDestinations.map((place) => {
              const active = query === place;
              return (
                <button
                  key={place}
                  type="button"
                  aria-pressed={active}
                  onClick={() => search(active ? "" : place)}
                  className={`tp-chip rounded-full border px-[15px] py-2 text-[13px] font-semibold ${
                    active
                      ? "border-[#c4dcec] bg-[#eaf3f9] text-brand-700"
                      : "border-[#e4eaee] bg-surface-2 text-[#46555f] hover:border-[#c4dcec] hover:bg-[#eaf3f9] hover:text-brand-700"
                  }`}
                >
                  {place}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => search("")}
              className="tp-chip rounded-full border border-[#d3e7f2] bg-[#eaf3f9] px-[15px] py-2 text-[13px] font-bold text-brand-600 hover:border-[#c4dcec] hover:bg-[#e0eef7]"
            >
              See more&hellip;
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1360px] px-6 pb-6 pt-11 sm:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#eef1f4] pb-3.5">
          <div className="flex items-baseline gap-3.5">
            <h2 className="text-[26px] font-extrabold tracking-[-.022em] text-ink-soft">
              {heading}
            </h2>
          </div>

          {/* Buttons with aria-pressed rather than an ARIA tablist: there is one
              list being filtered, not four separate panels. */}
          <div
            role="group"
            aria-label="Filter guides"
            className="flex flex-wrap items-center gap-x-[26px] gap-y-2"
          >
            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectTab(tab.id)}
                  className={`border-b-2 pb-[9px] text-[14px] transition-colors ${
                    active
                      ? "border-brand-500 font-bold text-brand-700"
                      : "border-transparent font-semibold text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1360px] px-6 pt-[26px] sm:px-12">
        {visible.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-[26px] gap-y-7">
            {visible.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        )}

        {/* One always-mounted live region doubles as the count caption and the
            empty state, so a filter that matches nothing is announced. */}
        <div
          className={`flex flex-col items-center gap-3 pb-2 ${
            results.length === 0 ? "pt-16" : "pt-[52px]"
          }`}
        >
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="tp-btn inline-flex items-center gap-[9px] rounded-full border border-[#d5e2ea] bg-white px-[26px] py-3.5 text-[15px] font-bold text-brand-700 shadow-[0_16px_34px_-24px_rgba(20,52,78,.55)]"
            >
              Load more guides
              <ArrowDownIcon size={16} />
            </button>
          )}
          <p
            role="status"
            className={
              results.length === 0
                ? "text-center text-[15px] text-muted"
                : "text-[12.5px] text-[#8b98a1]"
            }
          >
            {results.length === 0
              ? "No guides match your search."
              : `Showing ${visible.length} of ${results.length}`}
          </p>
        </div>
      </section>
    </>
  );
}
