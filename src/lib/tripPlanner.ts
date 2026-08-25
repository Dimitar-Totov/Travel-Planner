/**
 * The single entry point for turning a traveller's one-line trip request
 * into a `TripPlan` (see `src/lib/tripPlan.ts`) — the shape `/plan` and
 * `GET|POST /api/plan` both render via the guide-detail template.
 *
 * Two network calls happen here, deliberately in sequence:
 *   1. the `itinerary-planner` agent (`src/lib/openrouter/agents/
 *      itinerary-planner.ts`), which turns the sentence into a full
 *      day-by-day itinerary, then
 *   2. `getDestinationImage` (`src/lib/unsplash.ts`), which looks up a live
 *      hero photo *for the destination the model actually inferred*.
 *
 * Running these concurrently looks tempting, but the only destination
 * available before the model answers is `plans.ts`'s deterministic guess —
 * and that guess falls back to `DEFAULT_CITY` (Barcelona) for anything
 * outside its small `KNOWN_CITIES` list. Keying the photo off it would put a
 * Barcelona hero over a Vietnam itinerary for a large share of real queries.
 * The photo has to follow the itinerary, so it waits for it. The cost is
 * small: Unsplash answers in a few hundred milliseconds against a model call
 * measured in tens of seconds. The guess is still used as the fallback
 * destination when the model call fails entirely.
 *
 * Never throws. Any failure — missing API key, network error, malformed
 * model output, or a response that fails validation entirely — resolves to a
 * deterministic offline `TripPlan` (`aiGenerated: false`) built from the
 * existing curated/mock data in `src/lib/plans.ts` and `src/lib/demo.ts`, so
 * `/plan` and `/api/plan` always render.
 */
import { z } from "zod";
import { agentRegistry } from "@/lib/openrouter/registry";
import { createChatCompletion } from "@/lib/openrouter/client";
import { getDestinationImage } from "@/lib/unsplash";
import { getPlanForQuery, parseBudget, parseDays } from "@/lib/plans";
import { italyPlan } from "@/lib/demo";
import type { Plan } from "@/lib/types";
import type { DestinationImage, TripPlan } from "@/lib/tripPlan";
import type { GuideDay, GuideStop } from "@/lib/itinerary";

// ---------------------------------------------------------------------------
// Model response parsing + validation
// ---------------------------------------------------------------------------

/** Same fenced-code/brace-scanning approach as `src/lib/aiRoute.ts`'s `extractJson`. */
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

const MAX_STOPS_PER_DAY = 4;
/**
 * Upper bound on day sections, matching the grouping rule in the agent's
 * prompt. It is a guard against a runaway response, NOT a display cap — the
 * two numbers have to agree, because anything over it is silently dropped and
 * a traveller who asked for 10 days would be shown 8 with no explanation.
 */
const MAX_DAY_SECTIONS = 14;

const transferModeSchema = z.enum([
  "walk",
  "metro",
  "bus",
  "tram",
  "train",
  "car",
  "ferry",
  "bike",
  "flight",
]);

const stopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  lat: z.number().finite().gte(-90).lte(90),
  lng: z.number().finite().gte(-180).lte(180),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  notes: z.array(z.string().trim().min(1).max(280)).max(8).optional(),
  about: z.string().trim().min(1).max(800).optional(),
  address: z.string().trim().min(1).max(200).optional(),
  priceLevel: z.number().int().gte(1).lte(4).optional(),
  transfer: z
    .object({
      mode: transferModeSchema,
      duration: z.string().trim().min(1).max(40),
      distance: z.string().trim().min(1).max(40),
    })
    .optional(),
  highlight: z.boolean().optional(),
});

const daySchema = z.object({
  title: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(240),
  stops: z.array(z.unknown()).optional(),
});

const tripSchema = z.object({
  destination: z.string().trim().min(1).max(80),
  heroTitle: z.string().trim().min(1).max(80),
  heroAccent: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  intro: z.string().trim().min(1).max(1500),
  generalTips: z.array(z.string().trim().min(1).max(320)).max(12).optional(),
  days: z.number().int().gte(1).lte(60),
  currency: z.string().trim().min(1).max(5),
  approxCost: z.number().finite().gte(0),
  bestTime: z.string().trim().min(1).max(60),
  itinerary: z.array(z.unknown()).min(1),
});

interface AiItineraryResult {
  destination: string;
  heroTitle: string;
  heroAccent: string;
  tags: string[];
  intro: string;
  generalTips: string[];
  days: number;
  currency: string;
  approxCost: number;
  bestTime: string;
  itinerary: GuideDay[];
}

/**
 * Validates one candidate stop, dropping it entirely (rather than coercing
 * bad data) when it fails. Mirrors `aiRoute.ts`'s "filter, don't cast"
 * approach, but with real per-field checks via Zod instead of a hand-rolled
 * type guard.
 */
function toValidStop(raw: unknown): GuideStop | null {
  const result = stopSchema.safeParse(raw);
  if (!result.success) return null;
  const s = result.data;
  return {
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    tags: s.tags ?? [],
    notes: s.notes ?? [],
    ...(s.about !== undefined ? { about: s.about } : {}),
    ...(s.address !== undefined ? { address: s.address } : {}),
    ...(s.priceLevel !== undefined ? { priceLevel: s.priceLevel } : {}),
    ...(s.transfer !== undefined ? { transfer: s.transfer } : {}),
    ...(s.highlight !== undefined ? { highlight: s.highlight } : {}),
  };
}

/**
 * Validates one candidate day, dropping invalid stops and capping the
 * per-day stop count. Returns `null` when the day itself is malformed or
 * every one of its stops fails validation (an empty day has nothing to
 * render on either the reading column or the map).
 */
function toValidDay(raw: unknown): GuideDay | null {
  const result = daySchema.safeParse(raw);
  if (!result.success) return null;

  const stops = (result.data.stops ?? [])
    .map(toValidStop)
    .filter((s): s is GuideStop => s !== null)
    .slice(0, MAX_STOPS_PER_DAY);

  if (stops.length === 0) return null;

  return { title: result.data.title, summary: result.data.summary, stops };
}

/**
 * Validates the full model response. Genuinely validates every field rather
 * than casting — invalid stops are dropped, days left empty are dropped, and
 * the whole result is rejected (triggering the offline fallback) if nothing
 * usable survives.
 */
function validateItineraryResponse(raw: unknown): AiItineraryResult | null {
  const top = tripSchema.safeParse(raw);
  if (!top.success) {
    console.warn(
      "[tripPlanner] itinerary-planner response failed validation:",
      top.error.issues,
    );
    return null;
  }

  const itinerary = top.data.itinerary
    .map(toValidDay)
    .filter((d): d is GuideDay => d !== null)
    .slice(0, MAX_DAY_SECTIONS);

  if (itinerary.length === 0) {
    console.warn(
      "[tripPlanner] itinerary-planner response had no valid days/stops after validation.",
    );
    return null;
  }

  return {
    destination: top.data.destination,
    heroTitle: top.data.heroTitle,
    heroAccent: top.data.heroAccent,
    tags: top.data.tags ?? [],
    intro: top.data.intro,
    generalTips: top.data.generalTips ?? [],
    days: top.data.days,
    currency: top.data.currency,
    approxCost: top.data.approxCost,
    bestTime: top.data.bestTime,
    itinerary,
  };
}

// ---------------------------------------------------------------------------
// Model call
// ---------------------------------------------------------------------------

function buildUserMessage(
  query: string,
  parsedDays: number | undefined,
  parsedBudget: number | undefined,
): string {
  const lines = [`Traveller's trip request: "${query}"`];
  if (parsedDays !== undefined) {
    lines.push(`Requested trip length: ${parsedDays} day(s).`);
  }
  if (parsedBudget !== undefined) {
    lines.push(
      `Stated budget: ${parsedBudget} (use the currency the destination actually uses).`,
    );
  }
  return lines.join("\n");
}

/**
 * Calls the `itinerary-planner` agent and validates its response. Never
 * throws — any failure (missing key, network error, bad/invalid JSON)
 * resolves to `null` so `buildTripPlan` can fall back to the offline plan.
 */
async function callItineraryPlanner(
  query: string,
  parsedDays: number | undefined,
  parsedBudget: number | undefined,
): Promise<AiItineraryResult | null> {
  const agent = agentRegistry["itinerary-planner"];
  if (!agent) return null;

  try {
    const response = await createChatCompletion({
      model: agent.model,
      messages: [
        { role: "system", content: agent.systemPrompt },
        {
          role: "user",
          content: buildUserMessage(query, parsedDays, parsedBudget),
        },
      ],
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      responseFormat: "json_object",
      // Load-bearing — see the comment in the agent config. With reasoning on,
      // this model spends most of its token budget thinking, truncates the
      // JSON, and leaks reasoning prose into `content` where `extractJson`
      // mistakes a stray brace for the start of the object.
      reasoning: agent.reasoning,
    });

    const parsed = extractJson(response.content);
    if (parsed === null) {
      console.warn(
        "[tripPlanner] could not parse JSON from itinerary-planner response:",
        response.content,
      );
      return null;
    }

    return validateItineraryResponse(parsed);
  } catch (err) {
    console.warn(
      "[tripPlanner] itinerary-planner call failed, falling back to offline plan:",
      err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offline fallback
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic, honest offline `TripPlan` from the existing mock
 * planning data (`getPlanForQuery`) when every AI path fails. One `GuideDay`
 * per route stop, reusing that stop's real coordinates and the curated
 * plan's checklist as general tips, rather than inventing content we can't
 * back up.
 */
function buildOfflineTripPlan(
  basePlan: Plan,
  query: string,
  budget: number,
  hero: DestinationImage,
): TripPlan {
  const itinerary: GuideDay[] = basePlan.route.stops.map((stop) => ({
    title: stop.label,
    summary: `Time in ${stop.name}`,
    stops: [
      {
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        tags: [basePlan.destination],
        notes: [`Explore ${stop.name} at your own pace.`],
        highlight: true,
      },
    ],
  }));

  return {
    query,
    destination: basePlan.destination,
    heroTitle: `${basePlan.days}-day trip to`,
    heroAccent: basePlan.destination,
    tags: [`${basePlan.days}-day itinerary`, basePlan.destination],
    intro: `We couldn't reach the AI planner just now, so here's a dependable offline route for ${basePlan.destination} built from our own trip data.`,
    generalTips: basePlan.checklist.map((item) => item.label),
    days: basePlan.days,
    currency: basePlan.currency,
    budget,
    approxCost: basePlan.spent,
    bestTime: "Year-round",
    itinerary,
    hero,
    aiGenerated: false,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Turns one sentence (e.g. "5 days in Italy with a €1,000 budget") into a
 * fully-formed `TripPlan`. Never throws — every failure mode resolves to the
 * deterministic offline fallback so callers can always render.
 */
export async function buildTripPlan(query: string): Promise<TripPlan> {
  const trimmed = query.trim();
  const effectiveQuery = trimmed.length > 0 ? trimmed : italyPlan.query;

  const parsedDays = parseDays(effectiveQuery);
  const parsedBudget = parseBudget(effectiveQuery);
  const budget = parsedBudget ?? 0;

  // Deterministic guess (no network call). Only used as the source data for
  // the offline fallback, and as the hero-photo query when the model call
  // fails — never in preference to the model's own inferred destination, see
  // the note at the top of this file.
  const basePlan = getPlanForQuery(effectiveQuery);

  const aiResult = await callItineraryPlanner(
    effectiveQuery,
    parsedDays,
    parsedBudget,
  );

  // The photo follows the itinerary, so it can only be looked up once we know
  // where the trip actually goes.
  const hero = await getDestinationImage(
    aiResult?.destination ?? basePlan.destination,
  );

  if (aiResult) {
    return {
      query: effectiveQuery,
      destination: aiResult.destination,
      heroTitle: aiResult.heroTitle,
      heroAccent: aiResult.heroAccent,
      tags: aiResult.tags,
      intro: aiResult.intro,
      generalTips: aiResult.generalTips,
      // The traveller's own stated length wins over the model's. Asking for
      // "5 days" and being shown a "7" in the stats strip reads as a bug, and
      // the number is the one thing here they explicitly specified.
      days: parsedDays ?? aiResult.days,
      currency: aiResult.currency,
      budget,
      approxCost: aiResult.approxCost,
      bestTime: aiResult.bestTime,
      itinerary: aiResult.itinerary,
      hero,
      aiGenerated: true,
    };
  }

  return buildOfflineTripPlan(basePlan, effectiveQuery, budget, hero);
}
