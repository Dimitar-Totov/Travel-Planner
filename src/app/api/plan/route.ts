import type { NextRequest } from "next/server";
import { buildTripPlan } from "@/lib/tripPlanner";

/**
 * Trip-planning endpoint — HTTP mirror of what `/plan` renders. Backs onto
 * `buildTripPlan` (`src/lib/tripPlanner.ts`), which asks the
 * `itinerary-planner` agent for a full day-by-day itinerary plus a live
 * Unsplash hero photo, falling back to a deterministic offline `TripPlan` on
 * any failure so this endpoint always returns 200 with a renderable plan.
 */

/** GET /api/plan?q=<sentence> — sentence in the query string. */
export async function GET(request: NextRequest): Promise<Response> {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const plan = await buildTripPlan(query);
  return Response.json(plan, { status: 200 });
}

/** POST /api/plan with a `{ "query": string }` JSON body. */
export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      {
        error:
          'Request body must be a JSON object shaped like { "query": string }.',
      },
      { status: 400 },
    );
  }

  const rawQuery = (body as Record<string, unknown>).query;
  const query = typeof rawQuery === "string" ? rawQuery : "";

  const plan = await buildTripPlan(query);
  return Response.json(plan, { status: 200 });
}
