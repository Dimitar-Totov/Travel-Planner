import type { ReactNode } from "react";
import type { TripPlan } from "@/lib/tripPlan";
import { resolveStopImages } from "@/lib/unsplash";
import ItineraryDetailView from "@/components/destinations/detail/ItineraryDetailView";
import PhotoCredit from "@/components/shared/PhotoCredit";
import PlanByline from "./PlanByline";
import PlanFallbackNotice from "./PlanFallbackNotice";

interface PlanDetailViewProps {
  plan: TripPlan;
  /** Total stops across every day, counted on the server. */
  stopCount: number;
  /** `SiteFooter`, passed as a slot so it stays a server component. */
  footer: ReactNode;
}

/**
 * The `/plan` face of the shared itinerary template.
 *
 * Sibling to `GuideDetailView`: same layout, same client state, different
 * provenance. Everything specific to a generated plan is assembled here — the
 * prompt echo instead of an author bar, the Unsplash credit over the hero, and
 * the fallback notice when no model produced this — and handed to
 * `ItineraryDetailView` as slots and primitives. Staying a server component
 * keeps all three of those out of the client bundle.
 *
 * The per-stop photographs are resolved here too, for the whole itinerary
 * before the page renders — every day is mounted at once, so there is no
 * "visible day only" boundary to fetch against. `resolveStopImages` batches
 * internally, so it is a single awaited call rather than one per stop.
 */
export default async function PlanDetailView({
  plan,
  stopCount,
  footer,
}: PlanDetailViewProps) {
  const stopImages = await resolveStopImages(plan.itinerary, plan.destination);

  return (
    <ItineraryDetailView
      hero={{
        title: plan.heroTitle,
        accent: plan.heroAccent,
        tags: plan.tags,
        image: plan.hero.url,
        imageAlt: plan.hero.alt,
        // Checked here as well as inside the credit so the hero doesn't lay out
        // an empty corner box for a photo with nobody to credit.
        credit: plan.hero.photographer ? (
          <PhotoCredit
            placement="onPhoto"
            photographer={plan.hero.photographer}
            photographerUrl={plan.hero.photographerUrl}
            unsplashUrl={plan.hero.unsplashUrl}
          />
        ) : undefined,
      }}
      byline={<PlanByline query={plan.query} />}
      intro={plan.intro}
      stats={{
        days: plan.days,
        stopCount,
        currency: plan.currency,
        approxCost: plan.approxCost,
        bestTime: plan.bestTime,
      }}
      notice={
        plan.aiGenerated ? undefined : (
          <PlanFallbackNotice destination={plan.destination} />
        )
      }
      generalTips={plan.generalTips}
      days={plan.itinerary}
      stopImages={stopImages}
      footer={footer}
    />
  );
}
