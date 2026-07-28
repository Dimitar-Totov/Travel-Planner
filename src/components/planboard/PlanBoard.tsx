import type { Plan } from "@/lib/types";
import { MapPinIcon } from "@/components/icons";
import RouteMap from "./RouteMap";
import FlightsCard from "./FlightsCard";
import ChecklistCard from "./ChecklistCard";
import HotelsCard from "./HotelsCard";

/**
 * The result board — a single sentence rendered as a routed itinerary, live
 * flights & stays, and a checklist. Pure presentation, driven entirely by a
 * `Plan`, so it works identically on the landing preview and the /plan page.
 */
export default function PlanBoard({ plan }: { plan: Plan }) {
  const ready = plan.status === "ready";

  return (
    <div className="box-border w-full overflow-hidden rounded-3xl border border-[#e6e9ee] bg-white text-ink shadow-[0_40px_90px_-50px_rgba(20,52,78,.55),0_8px_30px_-18px_rgba(20,52,78,.25)]">
      {/* header bar */}
      <div className="flex items-center justify-between gap-4 border-b border-[#eef1f5] bg-[linear-gradient(180deg,#fbfcfd,#f6f8fa)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[linear-gradient(150deg,#2f7fb0,#164e73)] text-white">
            <MapPinIcon size={15} />
          </span>
          <div className="min-w-0">
            <div className="text-[14.5px] font-bold leading-none tracking-[-.01em]">{plan.title}</div>
            <div className="mt-[3px] truncate font-mono text-[11.5px] text-[#7a8791]">
              &ldquo;{plan.query}&rdquo;
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-[11px] py-[5px] text-[12px] font-semibold"
            style={
              ready
                ? { color: "#2c8b5f", background: "#e9f6ef", borderColor: "#cceadb" }
                : { color: "#8a6d1f", background: "#fbf3df", borderColor: "#f0e2bd" }
            }
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: ready ? "#2c8b5f" : "#c69a3a" }}
            />
            {ready ? "Ready" : "Planning"}
          </span>
          <span className="rounded-full border border-[#d4e6f1] bg-[#eaf2f8] px-[11px] py-[5px] text-[12.5px] font-bold text-brand-650">
            {plan.currency}
            {plan.spent.toLocaleString()} / {plan.currency}
            {plan.budget.toLocaleString()}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="bg-[#f6f8fa] p-[18px]">
        <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1.5fr_1fr]">
          {/* map card */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex items-center justify-between px-[15px] pb-2.5 pt-3">
              <span className="text-[12px] font-bold uppercase tracking-[.09em] text-[#5c6b76]">
                Route &amp; map
              </span>
              <span className="text-[11.5px] text-[#8b98a1]">
                {plan.route.stops.length} stop{plan.route.stops.length === 1 ? "" : "s"}
                {plan.route.distanceKm > 0 ? ` · ${plan.route.distanceKm} km` : ""}
              </span>
            </div>
            <div className="relative w-full flex-1 bg-[#e8eff4]" style={{ aspectRatio: "780 / 560" }}>
              <RouteMap
                route={plan.route}
                days={plan.days}
                budget={plan.budget}
                currency={plan.currency}
                mapShape={plan.mapShape}
              />
            </div>
          </div>

          {/* flights + checklist */}
          <div className="flex flex-col gap-3.5">
            <FlightsCard flights={plan.flights} currency={plan.currency} />
            <ChecklistCard items={plan.checklist} />
          </div>
        </div>

        <HotelsCard
          hotels={plan.hotels}
          nights={plan.nights}
          avgHotel={plan.avgHotel}
          currency={plan.currency}
        />
      </div>
    </div>
  );
}
