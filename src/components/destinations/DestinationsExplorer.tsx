"use client";

import Image from "next/image";
import { SparkleIcon } from "@/components/icons";
import type { DestinationGuide } from "@/lib/destinationGuides";
import DestinationsSearchBand from "./DestinationsSearchBand";
import DestinationsResults from "./DestinationsResults";
import { useDestinationsExplorer } from "@/lib/hooks/useDestinationsExplorer";

/**
 * The single scrim over the one backdrop photo. Darkest at the top, where the
 * white heading and subhead sit; holds a dark plateau through the middle so the
 * search band's caption stays legible over the photo's bright areas; then ramps
 * to the page's white across the bottom sixth so the band dissolves into the
 * plain-white guide feed instead of ending on a hard edge. The photo itself is
 * shown at full colour underneath — this only darkens, it doesn't tint.
 */
const BACKDROP_SCRIM =
  "linear-gradient(180deg," +
  "rgba(6,18,28,.78) 0%," +
  "rgba(7,20,31,.62) 22%," +
  "rgba(8,23,35,.56) 46%," +
  "rgba(9,27,41,.60) 68%," +
  "rgba(12,34,51,.66) 84%," +
  "rgba(140,170,190,.80) 94%," +
  "#fff 100%)";

/**
 * The whole of /guides below the nav.
 *
 * The banner copy and the search band deliberately share ONE `<section>` — and
 * therefore one `<Image>` and one scrim — so the backdrop illustration reads as
 * a single continuous photo behind both, rather than two independently cropped
 * copies of the same file with a seam between them. The section takes its height
 * from normal flow (copy + band), which is what keeps it responsive: no fixed
 * height, no aspect-ratio hack, so it never letterboxes on wide screens or
 * clips its own content on narrow ones.
 *
 * `object-cover` therefore crops a different window of the illustration at each
 * width — a tall window on mobile (where the stacked copy makes the section
 * tall) and a wide letterbox one on desktop. `object-position` is biased just
 * above centre so the globe, train and the plane's engines stay in frame as
 * desktop crops in, instead of the crop drifting down into open water.
 *
 * All state lives in `useDestinationsExplorer` because it is shared across that
 * boundary: the search band renders inside the photo, the results feed renders
 * on plain white below it.
 */
export default function DestinationsExplorer({
  guides,
}: {
  /** The published feed, loaded server-side by `app/guides/page.tsx`
   *  (`listPublishedGuides`) — see `useDestinationsExplorer`'s doc comment. */
  guides: DestinationGuide[];
}) {
  const {
    draft,
    query,
    activeTab,
    heading,
    results,
    visible,
    hasMore,
    hasAnyGuides,
    setDraft,
    search,
    selectTab,
    loadMore,
  } = useDestinationsExplorer(guides);

  return (
    <>
      <section
        id="top"
        className="relative isolate flex flex-col overflow-hidden px-6 pb-[62px] pt-[64px] sm:px-10 sm:pb-[70px] sm:pt-[72px] lg:min-h-[82vh] lg:justify-center lg:pb-[80px] lg:pt-[80px] xl:min-h-[88vh]"
      >
        {/* Decorative, so `alt=""` keeps it out of the a11y tree. `sizes`
            overshoots the viewport below `lg` because `object-cover` scales the
            photo by the section's height there, not its width — the rendered
            image is ~1.5–3× wider than the viewport, and a 100vw hint would
            hand back a candidate far too small and visibly soft. */}
        <Image
          src="/destinations-background-image.png"
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 300vw, (max-width: 1024px) 150vw, 100vw"
          className="pointer-events-none object-cover object-[center_42%]"
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: BACKDROP_SCRIM }}
        />

        <div className="relative mx-auto max-w-[720px] text-center">
          <span className="tp-rise inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3.5 py-[7px] text-[12px] font-bold uppercase tracking-[.09em] text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,.65)] backdrop-blur-[6px]">
            <SparkleIcon size={13} />
            3,480 guides · 112 countries
          </span>

          <h1 className="tp-rise mt-5 text-[36px] font-extrabold leading-[1.04] tracking-[-.032em] text-white text-balance [text-shadow:0_2px_18px_rgba(11,36,56,.45)] sm:text-[44px] lg:text-[52px]">
            Explore travel guides and{" "}
            <span className="font-serif font-medium italic text-brand-300">
              itineraries
            </span>
          </h1>

          <p className="tp-rise mx-auto mt-4 max-w-[520px] text-[16px] leading-[1.6] text-[#cadeeb] [text-shadow:0_1px_12px_rgba(11,36,56,.45)] sm:text-[17.5px]">
            Real trips from real travellers — open any guide and remix it into
            your own plan in one click.
          </p>
        </div>

        <div className="relative mx-auto mt-[42px] max-w-[720px] sm:mt-[48px] lg:mt-[84px] xl:mt-[96px]">
          <DestinationsSearchBand
            draft={draft}
            query={query}
            onDraftChange={setDraft}
            onSearch={search}
          />
        </div>
      </section>

      <DestinationsResults
        activeTab={activeTab}
        heading={heading}
        results={results}
        visible={visible}
        hasMore={hasMore}
        hasAnyGuides={hasAnyGuides}
        onSelectTab={selectTab}
        onLoadMore={loadMore}
      />
    </>
  );
}
