import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import DestinationsExplorer from "@/components/destinations/DestinationsExplorer";
import ScrollToTopButton from "@/components/destinations/ScrollToTopButton";

export const metadata: Metadata = {
  title: "Destinations · Travel Planner",
  description:
    "Browse travel guides and itineraries from real travellers, then remix any of them into your own plan.",
};

/**
 * The guide feed. Entirely static for now — the twelve guides live in
 * `src/lib/destinationGuides.ts` and all searching/filtering happens client-side
 * inside `DestinationsExplorer`'s `useDestinationsExplorer` hook; there is no
 * guides API yet.
 */
export default function DestinationsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav variant="onLight" />

      <main className="flex-1">
        <DestinationsExplorer />
      </main>

      <SiteFooter />

      {/* Mounted at the route boundary, not inside DestinationsExplorer, so it
          can only ever exist on /destinations. It is position-fixed, so where
          it sits in the document is irrelevant to the layout. */}
      <ScrollToTopButton />
    </div>
  );
}
