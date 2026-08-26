"use client";

import { ArrowDownIcon } from "@/components/icons";
import GuideCard from "./GuideCard";
import { TABS, type TabId } from "@/lib/hooks/useDestinationsExplorer";
import type { DestinationGuide } from "@/lib/destinationGuides";

interface DestinationsResultsProps {
  activeTab: TabId;
  heading: string;
  results: DestinationGuide[];
  visible: DestinationGuide[];
  hasMore: boolean;
  /** False before any guide has ever been published (or seeded) — switches
   *  the empty state from "no matches" to "nothing published yet" copy. */
  hasAnyGuides: boolean;
  onSelectTab: (next: TabId) => void;
  onLoadMore: () => void;
}

/**
 * The tab row and the paged guide feed — plain white, no backdrop photo; the
 * photo stops at the search band above.
 */
export default function DestinationsResults({
  activeTab,
  heading,
  results,
  visible,
  hasMore,
  hasAnyGuides,
  onSelectTab,
  onLoadMore,
}: DestinationsResultsProps) {
  return (
    <>
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
                  onClick={() => onSelectTab(tab.id)}
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
              onClick={onLoadMore}
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
              ? hasAnyGuides
                ? "No guides match your search."
                : "No guides published yet — be the first to share one."
              : `Showing ${visible.length} of ${results.length}`}
          </p>
        </div>
      </section>
    </>
  );
}
