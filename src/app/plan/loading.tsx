import ItineraryDetailSkeleton, {
  type StatusLineSet,
} from "@/components/shared/ItineraryDetailSkeleton";

/**
 * Instant-loading UI for /plan.
 *
 * `PlanPage` awaits `buildTripPlan`, which makes a large model call and then
 * looks up a hero photograph; this file is the Suspense fallback the App Router
 * shows in the meantime, and the wait is long enough that its shape matters.
 * The silhouette itself lives in `ItineraryDetailSkeleton` — the same shape
 * `/guides/guide/[guideId]/details` waits behind, because both routes
 * resolve to the same `ItineraryDetailView` — so all that's left here is the
 * copy for this particular wait.
 */

/** Rotating status lines — one visible per 1.6s slot of the 8s `lp-status`
 *  loop, which is why `StatusLineSet` is a five-tuple. */
const STATUS_LINES: StatusLineSet = [
  "Reading your sentence",
  "Choosing where to go",
  "Routing your days",
  "Picking the stops",
  "Framing the hero shot",
];

export default function PlanLoading() {
  return (
    <ItineraryDetailSkeleton
      statusLines={STATUS_LINES}
      announcement="Building your trip plan — choosing where to go, routing your days and picking the stops. This usually takes a few seconds."
    />
  );
}
