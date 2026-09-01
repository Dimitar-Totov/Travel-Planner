"use client";

import { useMemo, type ReactNode } from "react";
import type { CreateGuideFormState } from "@/lib/hooks/useCreateGuideForm";
import type { DestinationImage, StopImagePair } from "@/lib/unsplash";
import { EyeIcon } from "@/components/icons";
import ItineraryDetailView from "@/components/destinations/detail/ItineraryDetailView";
import { coverImageSrc } from "./coverImage";

/** Set when the preview is of a guide that already exists in the database and
 *  is being edited, rather than a brand-new draft. */
interface EditingContext {
  status: "draft" | "published";
}

/**
 * The byline slot, pre-save.
 *
 * `GuideAuthorBar` can't be reused here: it takes a whole `DestinationGuide`
 * (author, avatar gradient, view and like counts) that a draft has none of, and
 * its Follow / like / comment / share row is meaningless on something nobody
 * can reach yet. So the strip says the one true thing instead — which is a
 * different true thing when the guide is already published and the author is
 * looking at unsaved changes to it.
 */
function DraftByline({
  stopCount,
  editing,
}: {
  stopCount: number;
  editing?: EditingContext;
}) {
  const state = !editing
    ? "Not published"
    : editing.status === "published"
      ? "Published · unsaved changes"
      : "Saved as a draft · unsaved changes";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1.5 text-[12.5px] font-bold text-brand-700">
        <EyeIcon size={14} />
        {editing ? "Preview of your edits" : "Draft preview"}
      </span>
      <span className="text-[12.5px] text-[#8b98a1]">
        {state} · {stopCount} {stopCount === 1 ? "stop" : "stops"}{" "}
        {editing ? "in this guide" : "written so far"}
      </span>
    </div>
  );
}

/**
 * Same visual family as `PlanFallbackNotice` — gold, not red, because nothing
 * has gone wrong; what is on screen simply isn't (yet) what a reader gets.
 *
 * The edit branch carries the one thing an author has to be told and cannot
 * infer: there is no review step behind Save changes. A `PATCH` on a published
 * guide is live on the next reader's request.
 */
function DraftNotice({
  unplacedCount,
  hasCover,
  editing,
}: {
  unplacedCount: number;
  hasCover: boolean;
  editing?: EditingContext;
}) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl border border-gold-warm/25 bg-gold-warm/[.08] px-4 py-3 text-[13.5px] leading-[1.55] text-gold-deep">
      <span
        aria-hidden="true"
        className="mt-[6px] inline-block h-[7px] w-[7px] flex-none rounded-full bg-gold-warm"
      />
      <span>
        {editing ? (
          <>
            <span className="font-bold">
              Preview of unsaved changes — nothing is stored yet.
            </span>{" "}
            {editing.status === "published"
              ? "This is exactly how your guide will read once you press Save changes, and it goes live for readers the moment you do — there is no review step. Until then the published guide is unchanged, and leaving this page discards these edits."
              : "This is exactly how your guide will read once you press Save changes. It stays a draft either way — saving won’t publish it — and leaving this page discards these edits."}
          </>
        ) : (
          <>
            <span className="font-bold">
              Preview only — publishing isn&rsquo;t built yet.
            </span>{" "}
            This is exactly how your guide would read, but nothing is saved and
            the draft is lost on reload.
          </>
        )}
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
  /** Present when the draft being previewed is an edit of a guide that already
   *  exists (`/destinations/guide/[guideId]/edit`) — the byline and the notice
   *  have genuinely different things to say in that case, and one of them is a
   *  warning that saving is immediately visible to readers. */
  editing?: EditingContext;
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
 *
 * It serves the edit route as well as `/create-guide`, which is why `editing`
 * exists: the template itself is provenance-free and stays that way, but the
 * two slots this file owns — the byline and the notice — are exactly where the
 * page has to admit that these are unsaved changes to a guide readers can
 * already see.
 */
export default function CreateGuidePreview({
  form,
  editing,
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
      byline={<DraftByline stopCount={form.stopCount} editing={editing} />}
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
          editing={editing}
        />
      }
      generalTips={form.generalTips}
      days={form.asGuideDays}
      stopImages={stopImages}
      footer={footer}
    />
  );
}
