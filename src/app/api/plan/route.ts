import type { NextRequest } from "next/server";
import { getPlanForQuery } from "@/lib/plans";
import { withAiRoute } from "@/lib/aiRoute";

/**
 * Trip-planning endpoint — backs onto `getPlanForQuery` (`src/lib/plans.ts`),
 * a deterministic stand-in for a future real planning + flights API, then
 * asks the `route-planner` agent to replace the mock route's cities with an
 * AI-picked itinerary (falling back to the mock route on any failure).
 */

/** GET /api/plan?q=<sentence> — sentence in the query string. */
export async function GET(request: NextRequest): Promise<Response> {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const plan = await withAiRoute(getPlanForQuery(query));
  return Response.json(plan, { status: 200 });
}

/** POST /api/plan with a `{ "query": string }` JSON body. */
export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      { error: 'Request body must be a JSON object shaped like { "query": string }.' },
      { status: 400 }
    );
  }

  const rawQuery = (body as Record<string, unknown>).query;
  const query = typeof rawQuery === "string" ? rawQuery : "";

  const plan = await withAiRoute(getPlanForQuery(query));
  return Response.json(plan, { status: 200 });
}
