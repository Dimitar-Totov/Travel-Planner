import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PlanDetailView from "@/components/plan/PlanDetailView";
import { buildTripPlan } from "@/lib/tripPlanner";
import type { TripPlan } from "@/lib/tripPlan";

/** Long titles get cut in search results anyway; cut them on a word instead. */
const TITLE_LIMIT = 58;

/**
 * The sentence the traveller typed, or `null` when `/plan` was reached without
 * one — from a shared link, say. The empty case is deliberately *not* filled in
 * here: `buildTripPlan` substitutes its own default sentence and reports it back
 * as `plan.query`, so leaving it null keeps one source of truth for it.
 */
async function queryFrom(
  searchParams: PageProps<"/plan">["searchParams"],
): Promise<string | null> {
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  return raw?.trim() || null;
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Total stops across every day — the "Stops" stat in the header strip. */
function countStops(itinerary: TripPlan["itinerary"]): number {
  return itinerary.reduce((total, day) => total + day.stops.length, 0);
}

/**
 * Titled off the sentence rather than the plan, deliberately: resolving the
 * title from `buildTripPlan` would mean waiting for a model call before Next
 * can stream the document head, and the sentence already says where you're
 * going.
 */
export async function generateMetadata(
  props: PageProps<"/plan">,
): Promise<Metadata> {
  const query = await queryFrom(props.searchParams);
  const title = query
    ? `${truncate(query, TITLE_LIMIT)} · Travel Planner`
    : "Your plan · Travel Planner";
  const description = query
    ? `A day-by-day itinerary with a live map, planned for “${query}”.`
    : "A day-by-day itinerary with a live map, planned from one sentence.";

  return {
    title,
    description,
    // A plan is one traveller's answer to one sentence, not a page anyone
    // should land on from search.
    robots: { index: false, follow: true },
    openGraph: { title, description },
  };
}

/**
 * Results page: the sentence from `?q=`, turned into a trip and read side by
 * side with its map.
 *
 * It renders the same template as a community guide —
 * `/guides/guide/[guideId]/details` — because a plan and a guide are the
 * same document with different provenance. `PlanDetailView` is the adapter that
 * says so, and `ItineraryDetailView` underneath it is the single `"use client"`
 * boundary.
 *
 * A server component on purpose: `buildTripPlan` is called directly rather than
 * through `/api/plan`, so the model call happens once, on the server, and the
 * browser is sent the finished itinerary. It never throws — a failed AI path
 * comes back as a renderable plan with `aiGenerated: false` — so there is no
 * error branch here, only the notice `PlanDetailView` raises for it.
 *
 * `lg:h-screen lg:overflow-hidden` is what lets the split pane own the
 * viewport: the nav keeps its natural height and the split takes the rest. It
 * is scoped to `lg` so smaller screens fall back to ordinary page scrolling.
 */
export default async function PlanPage(props: PageProps<"/plan">) {
  const query = await queryFrom(props.searchParams);
  const plan = await buildTripPlan(query ?? "");

  return (
    <div className="flex min-h-screen flex-col bg-white lg:h-screen lg:overflow-hidden">
      <SiteNav variant="onLight" />

      <PlanDetailView
        plan={plan}
        stopCount={countStops(plan.itinerary)}
        footer={<SiteFooter />}
      />
    </div>
  );
}
