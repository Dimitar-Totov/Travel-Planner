/**
 * The original "Plan" contract — now an internal shape, no longer what the UI
 * renders.
 *
 * `/plan` and `/api/plan` return a `TripPlan` (`src/lib/tripPlan.ts`) built by
 * `src/lib/tripPlanner.ts`, and the PlanBoard components that consumed this
 * type are gone. What survives is the deterministic mock in `src/lib/plans.ts`
 * and `src/lib/demo.ts`, which `tripPlanner.ts` uses two ways: as the
 * destination guess feeding its day/budget parsing, and as the source of the
 * offline fallback plan when every AI path fails.
 *
 * New work should target `TripPlan`, not this.
 */

export type PlanStatus = "ready" | "planning";

/** A stop on the routed itinerary, placed on the map by lat/lng. */
export interface RouteStop {
  /** City name, e.g. "Rome". */
  name: string;
  /** Day span shown under the pin, e.g. "Days 1–2" or "Day 5". */
  label: string;
  lat: number;
  lng: number;
  /** Whether the traveller sleeps here (drives the map's "overnight" pin). */
  overnight: boolean;
}

/** The outbound (fully-detailed) flight leg. */
export interface FlightLeg {
  from: string;
  /** Arrival city + airport code, e.g. "Rome FCO". */
  to: string;
  /** Human duration, e.g. "2h 25m". */
  duration: string;
  /** "direct" or "1 stop", etc. */
  stops: string;
  carrier: string;
  price: number;
}

/** The return leg, summarised. */
export interface ReturnLeg {
  from: string;
  to: string;
  price: number;
}

export interface Flights {
  outbound: FlightLeg;
  inbound: ReturnLeg;
  roundTrip: boolean;
  /** Freshness note, e.g. "fares refreshed 4 min ago". */
  refreshedText: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Hotel {
  name: string;
  /** Neighbourhood, e.g. "Trastevere, Rome". */
  area: string;
  /** Short city label shown as an image chip, e.g. "Rome". */
  city: string;
  /** Review score as a string, e.g. "9.1". */
  rating: string;
  /** Star rating, 1–5. */
  stars: number;
  /** Price per night, in the plan's currency. */
  price: number;
  /** CSS gradient used as the card's placeholder image. */
  gradient: string;
}

export interface RoutePlan {
  stops: RouteStop[];
  /** Total route distance in km. */
  distanceKm: number;
  /** One-line route summary, e.g. "Rome → Florence → Venice". */
  summary: string;
}

export interface Plan {
  /** The original sentence the traveller typed. */
  query: string;
  /** Primary destination, e.g. "Italy". */
  destination: string;
  /** Board title, e.g. "Your 5-day Italy plan". */
  title: string;
  /** Trip length in days. */
  days: number;
  status: PlanStatus;
  /** Currency symbol used across the plan, e.g. "€". */
  currency: string;
  /** Target budget the traveller set. */
  budget: number;
  /** Planned total spend (kept at or under budget). */
  spent: number;
  route: RoutePlan;
  flights: Flights;
  checklist: ChecklistItem[];
  hotels: Hotel[];
  /** Number of hotel nights. */
  nights: number;
  /** Average nightly hotel price. */
  avgHotel: number;
  /**
   * Key selecting a decorative country silhouette in the map, when we have one
   * baked in (e.g. "italy"). Unknown/absent falls back to a route-only map.
   */
  mapShape?: "italy";
}
