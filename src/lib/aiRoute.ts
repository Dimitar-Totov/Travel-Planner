/**
 * AI-generated route layer, sitting on top of the mock plan data in
 * `src/lib/plans.ts`. Asks the `route-planner` agent (see
 * `src/lib/openrouter/agents/route-planner.ts`) to pick a real sequence of
 * cities for the trip, and turns that into a `RoutePlan`. Unlike `plans.ts`,
 * this module does make a network call — keep it isolated here so the mock
 * data layer stays pure.
 *
 * Any failure (missing API key, network error, malformed/invalid model
 * output) resolves to `null`/the original plan so callers can fall back to
 * the deterministic mock route instead of breaking the page.
 */
import { agentRegistry } from "@/lib/openrouter/registry";
import { createChatCompletion } from "@/lib/openrouter/client";
import type { Plan, RoutePlan, RouteStop } from "@/lib/types";

interface AiCity {
  name: string;
  lat: number;
  lng: number;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isValidCity(value: unknown): value is AiCity {
  if (typeof value !== "object" || value === null) return false;
  const { name, lat, lng } = value as Record<string, unknown>;
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

function isValidDestination(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 60;
}

/** Splits `totalDays` into `stopCount` contiguous day spans, e.g. [1,2] [3,4] [5]. */
function splitDaySpans(totalDays: number, stopCount: number): Array<{ start: number; end: number }> {
  const count = Math.max(1, Math.min(stopCount, totalDays));
  const base = Math.floor(totalDays / count);
  let remainder = totalDays - base * count;
  const spans: Array<{ start: number; end: number }> = [];
  let day = 1;
  for (let i = 0; i < count; i++) {
    const len = Math.max(1, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
    const start = day;
    const end = day + len - 1;
    spans.push({ start, end });
    day = end + 1;
  }
  return spans;
}

function formatLabel(start: number, end: number): string {
  return start === end ? `Day ${start}` : `Days ${start}–${end}`;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

export interface AiRouteResult {
  route: RoutePlan;
  /** Destination the model inferred straight from the traveller's sentence, if valid. */
  destination: string | null;
}

/**
 * Asks the route-planner agent to infer the destination and pick a sequence
 * of real cities for the trip, and turns that into a `RoutePlan`. Deliberately
 * does NOT take the mock backend's guessed destination as input — that guess
 * can be wrong (e.g. an unrecognised country falling back to a default city),
 * and feeding a wrong destination into the prompt would bias the model into
 * matching it instead of the traveller's actual request. Returns `null` on
 * any failure.
 */
export async function getAiRoute(query: string, days: number): Promise<AiRouteResult | null> {
  const agent = agentRegistry["route-planner"];
  if (!agent) return null;

  try {
    const response = await createChatCompletion({
      model: agent.model,
      messages: [
        { role: "system", content: agent.systemPrompt },
        {
          role: "user",
          content: `Traveller's trip request: "${query}"\nRequested trip length: ${days} day(s).`,
        },
      ],
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      responseFormat: "json_object",
    });

    const parsed = extractJson(response.content);
    if (typeof parsed !== "object" || parsed === null) {
      console.warn("[aiRoute] could not parse JSON from route-planner response:", response.content);
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const cities = record.cities;
    if (!Array.isArray(cities) || cities.length === 0) {
      console.warn("[aiRoute] route-planner response had no cities array:", parsed);
      return null;
    }

    const validCities = cities.filter(isValidCity).slice(0, 5);
    if (validCities.length === 0) {
      console.warn("[aiRoute] route-planner cities all failed validation:", cities);
      return null;
    }

    const destination = isValidDestination(record.destination) ? record.destination.trim() : null;

    const spans = splitDaySpans(days, validCities.length);
    const stops: RouteStop[] = validCities.slice(0, spans.length).map((city, i) => ({
      name: city.name,
      label: formatLabel(spans[i].start, spans[i].end),
      lat: city.lat,
      lng: city.lng,
      overnight: true,
    }));

    let distanceKm = 0;
    for (let i = 1; i < stops.length; i++) {
      distanceKm += haversineKm(stops[i - 1], stops[i]);
    }

    return {
      route: {
        stops,
        distanceKm,
        summary: stops.map((s) => s.name).join(" → "),
      },
      destination,
    };
  } catch (err) {
    console.warn("[aiRoute] route-planner call failed, falling back to mock route:", err);
    return null;
  }
}

/**
 * Overrides `plan.route` with an AI-generated one, falling back to the mock
 * route on failure. Also corrects `plan.destination`/`title` when the model's
 * inferred destination differs from the mock backend's guess (e.g. an
 * unrecognised country that the mock silently defaulted elsewhere).
 */
export async function withAiRoute(plan: Plan): Promise<Plan> {
  const result = await getAiRoute(plan.query, plan.days);
  if (!result) return plan;

  const destination = result.destination ?? plan.destination;
  const destinationChanged = destination !== plan.destination;

  return {
    ...plan,
    route: result.route,
    destination,
    title: destinationChanged ? `Your ${plan.days}-day ${destination} plan` : plan.title,
  };
}
