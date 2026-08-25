/**
 * The contract for an AI-generated trip plan — what `/plan` renders.
 *
 * `/plan` reuses the guide-detail template (`components/destinations/detail/*`)
 * rather than the old PlanBoard, so a `TripPlan` is deliberately shaped to line
 * up with what that template already reads off a `GuideItinerary`: hero copy,
 * an intro, tips, a stats strip, and the ordered `GuideDay[]` that drives both
 * the reading column and the map.
 *
 * The difference from a community guide is provenance. A guide has an author, a
 * publication date and a cover photo the author chose; a plan has the sentence
 * the traveller typed, and a hero photo looked up live on Unsplash from the
 * destination name.
 *
 * Producer: `src/lib/tripPlanner.ts`. Consumers: `/plan` and `GET|POST /api/plan`.
 */

import type { GuideDay } from "./itinerary";

// `DestinationImage` moved to `./unsplash` once stop-level photos needed the
// same shape — it was never really plan-specific. Re-exported here so the
// existing `from "@/lib/tripPlan"` imports (`HeroPhotoCredit`, `tripPlanner.ts`)
// don't have to change.
export type { DestinationImage } from "./unsplash";
import type { DestinationImage } from "./unsplash";

export interface TripPlan {
  /** The original sentence the traveller typed — echoed under the hero. */
  query: string;
  /** Primary destination the model inferred, e.g. "Italy". */
  destination: string;
  /**
   * Hero headline, split so the tail renders in the serif italic accent —
   * exactly as `GuideItinerary.heroTitle`/`heroAccent` do.
   */
  heroTitle: string;
  heroAccent: string;
  /** Pills over the hero photo, e.g. ["Food", "First-timers"]. */
  tags: string[];
  /** The opening paragraph, written to the traveller's request. */
  intro: string;
  /** Bulleted advice above the first day. */
  generalTips: string[];
  /** Trip length in days. */
  days: number;
  /** Currency symbol used across the plan, e.g. "€". */
  currency: string;
  /** The budget parsed out of the traveller's sentence. */
  budget: number;
  /** Estimated total spend, at or under `budget`. Drives the Budget stat. */
  approxCost: number;
  /** "Best time" stat in the header strip, e.g. "May". */
  bestTime: string;
  /** The itinerary itself — same shape the guide detail template renders. */
  itinerary: GuideDay[];
  /** Hero photograph for `destination`, looked up on Unsplash. */
  hero: DestinationImage;
  /**
   * True when the itinerary came back from the model, false when every AI path
   * failed and this is the deterministic offline fallback. The UI uses it to
   * decide whether to show a "generated from your prompt" or a degraded notice.
   */
  aiGenerated: boolean;
}
