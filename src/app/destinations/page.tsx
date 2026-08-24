import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import DestinationsHero from "@/components/destinations/DestinationsHero";

export const metadata: Metadata = {
  title: "Destinations · Travel Planner",
  description:
    "Browse travel guides and itineraries from real travellers, then remix any of them into your own plan.",
};

/**
 * The guide feed. Entirely static for now — the twelve guides live in
 * `src/lib/destinationGuides.ts` and all searching/filtering happens client-side
 * inside `DestinationsExplorer`; there is no guides API yet.
 */
export default function DestinationsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav variant="onLight" />

      <main className="flex-1">
        <DestinationsHero />
      </main>

      <SiteFooter />
    </div>
  );
}
