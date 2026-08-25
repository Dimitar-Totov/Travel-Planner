import type { ReactNode } from "react";
import type { DestinationGuide } from "@/lib/destinationGuides";
import type { GuideItinerary } from "@/lib/guideItineraries";
import GuideAuthorBar from "./GuideAuthorBar";
import ItineraryDetailView from "./ItineraryDetailView";

interface GuideDetailViewProps {
  guide: DestinationGuide;
  itinerary: GuideItinerary;
  /** `heroImageFor(guide)` and `countStops(itinerary)`, both resolved on the
   *  server so the client bundle never imports the guide data module. */
  heroImage: string;
  stopCount: number;
  /** `SiteFooter`, passed as a slot so it stays a server component. */
  footer: ReactNode;
}

/**
 * The community-guide face of the shared itinerary template.
 *
 * All the layout and every piece of client state live in
 * `ItineraryDetailView`, which `/plan` renders too; this file is only the
 * adapter that spreads a `DestinationGuide` + `GuideItinerary` onto it and
 * supplies the author bar as the byline. It stays a server component — the
 * author bar is a client component referenced from here, exactly as the footer
 * slot is, so nothing extra reaches the browser.
 *
 * Stop photographs are deliberately **not** resolved here. `getStopImages`/
 * `resolveStopImages` (`src/lib/unsplash.ts`) call Unsplash live, and this
 * route is not static — `SiteNav` reads the session cookie via `auth()`,
 * which forces per-request rendering — so every real page view would re-hit
 * Unsplash for all of that guide's stops. Measured directly: one uncached
 * view of the Paris guide (24 stops) exhausted the free tier's entire
 * 50-requests/hour quota by itself. `/plan` is the only live-Unsplash path
 * today (`PlanDetailView.tsx`), because a plan is one bounded request
 * triggered by a deliberate action, not passive browsing. Guides pass an
 * empty `stopImages` map, which `ItineraryDetailView` already renders as the
 * ordinary gradient placeholder for every stop — until a future pass backs
 * this with a MongoDB-resolved store instead of a live call (`src/models/`
 * has the existing mongoose-model pattern to follow when that lands).
 */
export default function GuideDetailView({
  guide,
  itinerary,
  heroImage,
  stopCount,
  footer,
}: GuideDetailViewProps) {
  return (
    <ItineraryDetailView
      hero={{
        title: itinerary.heroTitle,
        accent: itinerary.heroAccent,
        tags: itinerary.tags,
        image: heroImage,
        imageAlt: guide.place,
        verified: guide.verified,
      }}
      byline={
        <GuideAuthorBar guide={guide} publishedAt={itinerary.publishedAt} />
      }
      intro={itinerary.intro}
      stats={{
        days: guide.days,
        stopCount,
        currency: itinerary.currency,
        approxCost: guide.approxCostEUR,
        bestTime: itinerary.bestTime,
      }}
      generalTips={itinerary.generalTips}
      days={itinerary.days}
      stopImages={{}}
      footer={footer}
    />
  );
}
