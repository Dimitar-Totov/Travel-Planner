import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import DestinationsExplorer from "@/components/destinations/DestinationsExplorer";
import ScrollToTopButton from "@/components/destinations/ScrollToTopButton";
import { listPublishedGuides } from "@/services/guides";

export const metadata: Metadata = {
  title: "Destinations · Travel Planner",
  description:
    "Browse travel guides and itineraries from real travellers, then remix any of them into your own plan.",
};

/**
 * The guide feed. A server component: it loads every published guide once,
 * server-side, via `listPublishedGuides()` (`src/services/guides.ts`, backed
 * by MongoDB) and hands the array to `DestinationsExplorer` as a prop. All
 * tab/search/pagination state still lives client-side in
 * `useDestinationsExplorer` — only the source of the array moved off the
 * hardcoded `destinationGuides` import, the filtering itself didn't change.
 *
 * An empty array (nothing published yet, or `scripts/seed-guides.ts` hasn't
 * been run) is a normal, expected state, not an error — `DestinationsResults`
 * renders a real empty state for it rather than a blank grid.
 */
export default async function DestinationsPage() {
  const guides = await listPublishedGuides();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav variant="onLight" />

      <main className="flex-1">
        <DestinationsExplorer guides={guides} />
      </main>

      <SiteFooter />

      {/* Mounted at the route boundary, not inside DestinationsExplorer, so it
          can only ever exist on /guides. It is position-fixed, so where
          it sits in the document is irrelevant to the layout. */}
      <ScrollToTopButton />
    </div>
  );
}
