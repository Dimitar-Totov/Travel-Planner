import ItineraryDetailSkeleton, {
  type StatusLineSet,
} from "@/components/shared/ItineraryDetailSkeleton";

/**
 * Instant-loading UI for /guides/guide/[guideId]/details.
 *
 * The page awaits `getPublishedGuideDetail(slug)` — a MongoDB read plus a
 * render, usually a few hundred milliseconds, not `/plan`'s model call — but
 * it is still a navigation to a route that owns the whole viewport, so
 * without a fallback the reader (or an author just off `/create-guide`'s
 * publish redirect) sits on the previous page until it resolves. The
 * silhouette is `ItineraryDetailSkeleton`, shared with `/plan` because both
 * routes resolve to the same `ItineraryDetailView`.
 *
 * The copy is deliberately about *reading* a guide, not publishing one: this
 * is what anyone opening a guide from `/guides` sees too.
 */

/** Rotating status lines — one visible per 1.6s slot of the 8s `lp-status`
 *  loop, which is why `StatusLineSet` is a five-tuple. */
const STATUS_LINES: StatusLineSet = [
  "Opening the guide",
  "Reading the itinerary",
  "Laying out the days",
  "Lining up the stops",
  "Placing the map pins",
];

export default function GuideDetailsLoading() {
  return (
    <ItineraryDetailSkeleton
      statusLines={STATUS_LINES}
      announcement="Loading this guide — its itinerary, stops and map. The page will fill in as soon as it is ready."
    />
  );
}
