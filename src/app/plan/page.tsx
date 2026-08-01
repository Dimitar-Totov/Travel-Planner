import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PlanBoard from "@/components/planboard/PlanBoard";
import { getPlanForQuery } from "@/lib/plans";
import { withAiRoute } from "@/lib/aiRoute";
import { italyPlan } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Your plan · Travel Planner",
};

/**
 * Results page. Reads the sentence from `?q=`, then renders the PlanBoard.
 *
 * We call the planning data layer (`getPlanForQuery`) directly here — the
 * idiomatic Next server-component pattern — while the same data is also exposed
 * over HTTP at `/api/plan` for external/client consumers. `withAiRoute` then
 * asks the `route-planner` agent to replace the mock route's cities with an
 * AI-picked itinerary, falling back to the mock route if that call fails.
 */
export default async function PlanPage(props: PageProps<"/plan">) {
  const { q } = await props.searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  const query = raw?.trim() || italyPlan.query;
  const plan = await withAiRoute(getPlanForQuery(query));

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7f9]">
      <SiteNav variant="onLight" ctaHref="/" />

      <main className="flex-1">
        <div className="mx-auto max-w-[1060px] px-4 py-9 sm:px-6 sm:py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="mt-2 text-[24px] font-extrabold tracking-[-.02em] text-ink sm:text-[28px]">
                {plan.title}
              </h1>
              <p className="mt-1 truncate text-[14px] text-muted">
                From your prompt: <span className="font-mono text-[13px]">&ldquo;{query}&rdquo;</span>
              </p>
            </div>
          </div>

          <PlanBoard plan={plan} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
