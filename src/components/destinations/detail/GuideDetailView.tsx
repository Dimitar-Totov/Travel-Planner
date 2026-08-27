import type { ReactNode } from "react";
import type { DestinationGuide } from "@/lib/destinationGuides";
import type { GuideItinerary } from "@/lib/guideItineraries";
import type { StopImagePair } from "@/lib/unsplash";
import GuideAuthorBar from "./GuideAuthorBar";
import ItineraryDetailView from "./ItineraryDetailView";

interface GuideDetailViewProps {
  guide: DestinationGuide;
  itinerary: GuideItinerary;
  /** `heroImageFor(guide)` and `countStops(itinerary)`, both resolved on the
   *  server so the client bundle never imports the guide data module. */
  heroImage: string;
  stopCount: number;
  /**
   * Every stop's photo, resolved server-side from that stop's stored
   * `photoUrl` (`src/services/guides.ts`'s `getPublishedGuideDetail`) — not
   * a live Unsplash call. A stop with no uploaded photo is simply absent
   * from the map; `ItineraryDetailView`/`StopThumb` already render the
   * gradient placeholder for a missing key.
   */
  stopImages: Record<string, StopImagePair>;
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
 * Stop photographs are resolved from storage, not Unsplash. Unlike `/plan`
 * (`resolveStopImages`, `src/lib/unsplash.ts`), which hits Unsplash's live
 * search API and is why this route historically passed an empty
 * `stopImages` map — a real Unsplash lookup here, on a per-request page
 * (`SiteNav` reads the session cookie via `auth()`, forcing dynamic
 * rendering), measurably exhausted the free tier's entire 50-requests/hour
 * quota on a single 24-stop guide view — every stop photo here now comes
 * from that stop's own stored `photoUrl` (`IGuideStop.photoUrl`,
 * `src/models/Guide.ts`), keyed the same way by the caller. No network call,
 * so no rate limit to dodge.
 */
export default function GuideDetailView({
  guide,
  itinerary,
  heroImage,
  stopCount,
  stopImages,
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
      stopImages={stopImages}
      footer={footer}
    />
  );
}
