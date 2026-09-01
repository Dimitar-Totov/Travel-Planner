import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { countStops, heroImageFor } from "@/lib/guideItineraries";
import { getPublishedGuideDetail } from "@/services/guides";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import GuideDetailView from "@/components/destinations/detail/GuideDetailView";
import GuideOwnerActions from "@/components/destinations/detail/GuideOwnerActions";

type GuideDetailProps = PageProps<"/guides/guide/[guideId]/details">;

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
 *
 * The session is read here too, purely to decide whether to render the author's
 * own Edit/Delete controls. It costs nothing new: this route is already
 * per-request (`SiteNav`'s `NavAccount` calls `auth()` on every render), and the
 * two awaits below run concurrently rather than one after the other. It is also
 * *only* a rendering decision — `PATCH`/`DELETE /api/guides/[guideId]` each
 * re-check authorship against the database, which is where the actual
 * authorization lives.
 */
export default async function GuideDetailsPage(props: GuideDetailProps) {
  const { guideId } = await props.params;
  // Two independent reads — the guide doesn't depend on the session and the
  // session doesn't depend on the guide — so they're started together rather
  // than serialised behind one another.
  const [detail, session] = await Promise.all([
    getPublishedGuideDetail(guideId),
    auth(),
  ]);

  if (!detail) {
    notFound();
  }

  const { guide, itinerary, stopImages, authorId } = detail;

  // Both halves matter. `authorId` is `null` when the guide's author reference
  // didn't resolve (a deleted user), and `session.user.id` is absent for an
  // anonymous reader — comparing without checking either would make
  // `undefined === null` style near-misses into ownership.
  const isOwner = Boolean(session?.user?.id && session.user.id === authorId);

  return (
    <div className="flex min-h-screen flex-col bg-white lg:h-screen lg:overflow-hidden">
      <SiteNav variant="onLight" />

      <GuideDetailView
        guide={guide}
        itinerary={itinerary}
        heroImage={heroImageFor(guide)}
        stopCount={countStops(itinerary)}
        stopImages={stopImages}
        ownerActions={
          isOwner ? (
            <GuideOwnerActions slug={guide.slug} title={guide.title} />
          ) : undefined
        }
        footer={<SiteFooter />}
      />
    </div>
  );
}
