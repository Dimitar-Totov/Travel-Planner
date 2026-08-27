"use client";

import { useMemo, type ReactNode } from "react";
import type { CreateGuideFormState } from "@/lib/hooks/useCreateGuideForm";
import type { DestinationImage, StopImagePair } from "@/lib/unsplash";
import { EyeIcon } from "@/components/icons";
import ItineraryDetailView from "@/components/destinations/detail/ItineraryDetailView";
import { coverImageSrc } from "./coverImage";

/**
 * The byline slot, pre-publish.
 *
 * `GuideAuthorBar` can't be reused here: it takes a whole `DestinationGuide`
 * (author, avatar gradient, view and like counts) that a draft has none of, and
 * its Follow / like / comment / share row is meaningless on something nobody
 * can reach yet. So the strip says the one true thing instead.
 */
function DraftByline({ stopCount }: { stopCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1.5 text-[12.5px] font-bold text-brand-700">
        <EyeIcon size={14} />
        Draft preview
      </span>
      <span className="text-[12.5px] text-[#8b98a1]">
        Not published · {stopCount} {stopCount === 1 ? "stop" : "stops"} written
        so far
      </span>
    </div>
  );
}

/** Same visual family as `PlanFallbackNotice` — gold, not red, because nothing
 *  has gone wrong; the page is simply not a published guide. */
function DraftNotice({
  unplacedCount,
  hasCover,
}: {
  unplacedCount: number;
  hasCover: boolean;
}) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl border border-gold-warm/25 bg-gold-warm/[.08] px-4 py-3 text-[13.5px] leading-[1.55] text-gold-deep">
      <span
        aria-hidden="true"
        className="mt-[6px] inline-block h-[7px] w-[7px] flex-none rounded-full bg-gold-warm"
      />
      <span>
        <span className="font-bold">
          Preview only — publishing isn&rsquo;t built yet.
        </span>{" "}
        This is exactly how your guide would read, but nothing is saved and the
        draft is lost on reload.
        {hasCover &&
          " Your cover is shown whole here so you can check it — a published hero crops it to fill the banner."}
        {unplacedCount > 0 &&
          ` ${unplacedCount} ${
            unplacedCount === 1 ? "stop still needs" : "stops still need"
          } a location — until then they borrow a neighbour's position on the map.`}
      </span>
    </p>
  );
}

interface CreateGuidePreviewProps {
  form: CreateGuideFormState;
  /** `SiteFooter`, threaded down from the page so it stays a server component
   *  — the same slot the real guide route passes through. */
  footer: ReactNode;
}

/**
 * The draft's face of the shared itinerary template.
 *
 * Third adapter onto `ItineraryDetailView`, alongside `GuideDetailView` (a
 * published community guide) and `PlanDetailView` (an AI-generated plan). All
 * the layout, the day accordion, the map and every piece of reading-side state
 * come from there; this file only spreads the draft onto it, which is the whole
 * point of the preview — an author sees the real template, not an approximation
 * of it.
 *
 * `stopImages` doesn't come from Unsplash the way `GuideDetailView`/
 * `PlanDetailView`'s do — guides don't call it per stop (see the rate-limit
 * note on `resolveStopImages`), and a draft has no published slug to key a
 * live lookup off anyway. Instead it's built here from whatever stop photos
 * the author has uploaded (`stop.photo`), keyed the same `"<dayIndex>-
 * <stopIndex>"` way `DaySection` computes for every other per-stop lookup, so
 * a stop with no uploaded photo still falls back to `StopThumb`'s placeholder.
 * Unlike its two siblings this one is a client component, because the draft it
 * renders lives in `useCreateGuideForm` up in the shell.
 */
export default function CreateGuidePreview({
  form,
  footer,
}: CreateGuidePreviewProps) {
  const title = form.heroTitle.trim() || "Untitled guide";

  const stopImages = useMemo(() => {
    const out: Record<string, StopImagePair> = {};
    form.days.forEach((day, dayIndex) => {
      day.stops.forEach((stop, stopIndex) => {
        if (!stop.photo) return;
        const image: DestinationImage = {
          url: stop.photo.src,
          alt: stop.name.trim() || "Stop photo",
          photographer: null,
          photographerUrl: null,
          unsplashUrl: null,
        };
        out[`${dayIndex}-${stopIndex}`] = { thumb: image, about: image };
      });
    });
    return out;
  }, [form.days]);

  return (
    <ItineraryDetailView
      hero={{
        title,
        accent: form.heroAccent.trim(),
        tags: form.tags,
        image: coverImageSrc(form.coverImage),
        imageAlt: form.heroTitle.trim() || "Guide cover",
        // The one place this preview deliberately diverges from the published
        // render. A cover here is an author's own upload of any aspect ratio,
        // and the banner's `object-cover` would crop away the parts they are
        // previewing to check; `DraftNotice` says so in words.
        imageFit: "contain",
      }}
      byline={<DraftByline stopCount={form.stopCount} />}
      intro={
        form.intro.trim() ||
        "Your intro paragraph will appear here once you write one."
      }
      stats={{
        days: form.days.length,
        stopCount: form.stopCount,
        currency: form.currency.trim() || "€",
        // There is no budget field on a guide draft — `DestinationGuide`'s
        // `approxCostEUR` is feed metadata a published guide gets, not
        // something the itinerary itself carries. Left undefined rather than
        // `0`, which rendered as "€0" and read as a free trip.
        approxCost: undefined,
        bestTime: form.bestTime.trim() || "—",
      }}
      notice={
        <DraftNotice
          unplacedCount={form.unplacedCount}
          hasCover={form.coverImage !== null}
        />
      }
      generalTips={form.generalTips}
      days={form.asGuideDays}
      stopImages={stopImages}
      footer={footer}
    />
  );
}
