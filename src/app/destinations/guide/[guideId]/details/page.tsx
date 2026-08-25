import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { destinationGuides } from "@/lib/destinationGuides";
import {
  countStops,
  getGuideDetail,
  heroImageFor,
} from "@/lib/guideItineraries";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import GuideDetailView from "@/components/destinations/detail/GuideDetailView";

type GuideDetailProps = PageProps<"/destinations/guide/[guideId]/details">;

/**
 * Every guide's content is hardcoded in `lib/destinationGuides.ts` +
 * `lib/guideItineraries.ts`, so there is nothing to fetch and nothing that can
 * change between builds — prerender the lot.
 */
export function generateStaticParams() {
  return destinationGuides.map((guide) => ({ guideId: guide.slug }));
}

export async function generateMetadata(
  props: GuideDetailProps,
): Promise<Metadata> {
  const { guideId } = await props.params;
  const detail = getGuideDetail(guideId);

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
 * A server component on purpose: the itinerary is static content, so the whole
 * document — hero, author bar, tips and every day — is rendered on the server
 * and `GuideDetailView` is the single `"use client"` boundary underneath it.
 * The two derived values the client needs (`heroImageFor`, `countStops`) are
 * computed here so the client bundle never has to import the module holding all
 * nineteen itineraries.
 *
 * `lg:h-screen lg:overflow-hidden` is what lets the split pane below own the
 * viewport: the nav keeps its natural height and the split takes the rest. It
 * is scoped to `lg` so smaller screens fall back to ordinary page scrolling.
 */
export default async function GuideDetailsPage(props: GuideDetailProps) {
  const { guideId } = await props.params;
  const detail = getGuideDetail(guideId);

  if (!detail) {
    notFound();
  }

  const { guide, itinerary } = detail;

  return (
    <div className="flex min-h-screen flex-col bg-white lg:h-screen lg:overflow-hidden">
      <SiteNav variant="onLight" />

      <GuideDetailView
        guide={guide}
        itinerary={itinerary}
        heroImage={heroImageFor(guide)}
        stopCount={countStops(itinerary)}
        footer={<SiteFooter />}
      />
    </div>
  );
}
