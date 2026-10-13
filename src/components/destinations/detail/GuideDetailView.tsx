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
  /** The guide's live like count, sourced from the `Like` collection via
   *  `getPublishedGuideDetail` (`src/services/guides.ts`). */
  likeCount: number;
  /** The guide's total comment count, sourced from the `Comment` collection
   *  via `getPublishedGuideDetail` (`src/services/guides.ts`). */
  commentCount: number;
  /** Whether the signed-in reader is already among the guide's likers —
   *  `false` for an anonymous reader. Resolved on the server by the page,
   *  which compares `session.user.id` against `PublishedGuideDetail.likedUserIds`
   *  (`src/services/guides.ts`). */
  likedByViewer: boolean;
  /** Whether there is a signed-in reader at all — distinct from
   *  `likedByViewer`, which is always `false` for an anonymous reader
   *  regardless of this flag. Lets the author bar decide whether liking is
   *  even an option right now. */
  isAuthenticated: boolean;
  /**
   * `GuideOwnerActions`, when the signed-in reader is this guide's author.
   *
   * A slot on *this* component rather than a prop on `ItineraryDetailView`:
   * that template is shared with `/plan` and `/create-guide`'s preview and is
   * deliberately provenance-free — it renders a hero, a byline, some stats and
   * a `GuideDay[]`, and has no concept of a guide having an owner. The byline
   * is already the seam for exactly this kind of route-specific chrome, so
   * ownership is resolved here and forwarded from the byline downwards.
   *
   * Passed straight through to `GuideAuthorBar`, which swaps it in for Follow,
   * like and comment — see that component for why those three go away rather
   * than sitting alongside these.
   *
   * Omitted for everyone else, which is a rendering decision and not a
   * permission boundary — `PATCH`/`DELETE /api/guides/[guideId]` each re-check
   * authorship against the database.
   */
  ownerActions?: ReactNode;
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
 * slot is, so nothing extra reaches the browser. The owner controls arrive the
 * same way, already built by the page, so ownership is decided once on the
 * server and this file never learns who is reading.
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
  likeCount,
  commentCount,
  likedByViewer,
  isAuthenticated,
  ownerActions,
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
        // The owner controls go *into* the author bar's own action row, not
        // beside or beneath it: on your own guide, Edit and Delete are the row,
        // and the bar swaps them in for Follow/like/comment rather than
        // stacking a second surface under a strip of controls that don't apply
        // to you. `undefined` for everyone else, which is the branch that
        // leaves the reader's render byte-for-byte what it was.
        <GuideAuthorBar
          guide={guide}
          publishedAt={itinerary.publishedAt}
          likeCount={likeCount}
          commentCount={commentCount}
          likedByViewer={likedByViewer}
          isAuthenticated={isAuthenticated}
          ownerActions={ownerActions}
        />
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
