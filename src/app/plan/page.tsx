import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PlanBoard from "@/components/planboard/PlanBoard";
import { ArrowRightIcon } from "@/components/icons";
import { getPlanForQuery } from "@/lib/plans";
import { italyPlan } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Your plan · Travel Planner",
};

/**
 * Results page. Reads the sentence from `?q=`, then renders the PlanBoard.
 *
 * We call the planning data layer (`getPlanForQuery`) directly here — the
 * idiomatic Next server-component pattern — while the same data is also exposed
 * over HTTP at `/api/plan` for external/client consumers.
 */
export default async function PlanPage(props: PageProps<"/plan">) {
  const { q } = await props.searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  const query = raw?.trim() || italyPlan.query;
  const plan = getPlanForQuery(query);

  return (
    <div className="flex min-h-full flex-col bg-[#f4f7f9]">
      <SiteNav variant="onLight" ctaHref="/" />

      <main className="flex-1">
        <div className="mx-auto max-w-[1060px] px-4 py-9 sm:px-6 sm:py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
              >
                <ArrowRightIcon size={15} className="rotate-180" />
                New plan
              </Link>
              <h1 className="mt-2 text-[24px] font-extrabold tracking-[-.02em] text-ink sm:text-[28px]">
                {plan.title}
              </h1>
              <p className="mt-1 truncate text-[14px] text-muted">
                From your prompt: <span className="font-mono text-[13px]">&ldquo;{query}&rdquo;</span>
              </p>
            </div>
            <Link
              href="/#plan-prompt"
              className="tp-btn inline-flex flex-none items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-3 text-[14px] font-bold text-white shadow-[0_14px_26px_-14px_rgba(19,74,111,.9)]"
            >
              Plan another trip
              <ArrowRightIcon size={16} />
            </Link>
          </div>

          <PlanBoard plan={plan} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
