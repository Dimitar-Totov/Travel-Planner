/**
 * The day/stop shape shared by every itinerary in the app.
 *
 * Two things produce this shape and one template renders it:
 *   - `guideItineraries.ts` — hand-written community guides (`/guides`),
 *   - `tripPlanner.ts` — an AI-generated plan for the sentence a traveller typed
 *     (`/plan`),
 * and both are read by `components/destinations/detail/*`.
 *
 * It lives in its own module so the plan route doesn't have to import the
 * destinations data module just to name a type. `guideItineraries.ts` re-exports
 * all four names, so existing imports from there keep working.
 *
 * Stop coordinates are real: they are what the map plots, so a wrong pair puts a
 * pin in the sea.
 */

/** How you reach a stop from the one before it. */
export type TransferMode =
  | "walk"
  | "metro"
  | "bus"
  | "tram"
  | "train"
  | "car"
  | "ferry"
  | "bike"
  | "flight";

export interface StopTransfer {
  mode: TransferMode;
  /** Human-readable, e.g. "11 min". */
  duration: string;
  /** Human-readable, e.g. "0.56 mi". */
  distance: string;
}

export interface GuideStop {
  name: string;
  lat: number;
  lng: number;
  /** Category chips under the stop title, e.g. ["Cathedral", "Free entry"]. */
  tags: string[];
  /** Terse bullets — the actual advice. */
  notes: string[];
  /** Longer prose, shown in the map's stop detail card. */
  about?: string;
  /** Shown in the stop detail card next to a pin glyph. */
  address?: string;
  /** 1–4, rendered as filled/unfilled currency symbols. */
  priceLevel?: number;
  /** How you got here from the previous stop. Omitted on a day's first stop. */
  transfer?: StopTransfer;
  /** The day's standout — rendered in gold rather than brand blue. */
  highlight?: boolean;
}

export interface GuideDay {
  /** Free-form so a section can cover a range: "Day 1" or "Days 8–10". */
  title: string;
  /** One line under the title, e.g. "Notre Dame and the Eiffel Tower". */
  summary: string;
  stops: GuideStop[];
}
