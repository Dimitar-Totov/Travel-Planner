import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { countStops, heroImageFor } from "@/lib/guideItineraries";
import { getPublishedGuideDetail } from "@/services/guides";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import GuideDetailView from "@/components/destinations/detail/GuideDetailView";

type GuideDetailProps = PageProps<"/destinations/guide/[guideId]/details">;

// No `generateStaticParams` here anymore: guides live in MongoDB now, so
// their slugs aren't knowable at build time the way the old hardcoded array's
// were. The route renders dynamically per slug instead.

export async function generateMetadata(
  props: GuideDetailProps,
): Promise<Metadata> {
  const { guideId } = await props.params;
  const detail = await getPublishedGuideDetail(guideId);

  // `notFound()` belongs in the page, not here; an unknown slug just gets a
  // neutral title so metadata generation can't be the thing that 404s.
  if (!detail) return { title: "Guide not found · Travel Planner" };

  const { guide } = detail;
  const title = `${guide.title} · Travel Planner`;

  return {
    title,
    description: guide.blurb,
    openGraph: {
      title,
      description: guide.blurb,
      images: [{ url: heroImageFor(guide) }],
    },
  };
}

/**
 * One community guide, read side by side with its map.
 *
 * A server component on purpose: the guide is fetched once, server-side, via
 * `getPublishedGuideDetail(slug)` (`src/services/guides.ts`, backed by
 * MongoDB) — an unknown or unpublished slug 404s here. The whole document —
 * hero, author bar, tips and every day — is then rendered on the server, and
 * `GuideDetailView` is the single `"use client"` boundary underneath it. The
 * derived values the client needs (`heroImageFor`, `countStops`, and the
 * `stopImages` map built from each stop's stored photo) are all resolved
 * here so the client bundle never has to import the guide data modules.
 *
 * `lg:h-screen lg:overflow-hidden` is what lets the split pane below own the
 * viewport: the nav keeps its natural height and the split takes the rest. It
 * is scoped to `lg` so smaller screens fall back to ordinary page scrolling.
 */
export default async function GuideDetailsPage(props: GuideDetailProps) {
  const { guideId } = await props.params;
  const detail = await getPublishedGuideDetail(guideId);

  if (!detail) {
    notFound();
  }

  const { guide, itinerary, stopImages } = detail;

  return (
    <div className="flex min-h-screen flex-col bg-white lg:h-screen lg:overflow-hidden">
      <SiteNav variant="onLight" />

      <GuideDetailView
        guide={guide}
        itinerary={itinerary}
        heroImage={heroImageFor(guide)}
        stopCount={countStops(itinerary)}
        stopImages={stopImages}
        footer={<SiteFooter />}
      />
    </div>
  );
}
