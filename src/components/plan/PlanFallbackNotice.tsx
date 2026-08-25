/**
 * Shown when `TripPlan.aiGenerated` is false — every AI path failed and the
 * itinerary below is the deterministic offline fallback.
 *
 * Deliberately a note and not an error: the page is fully usable and the route
 * is a real one, so the only thing owed to the reader is that we don't let
 * `PlanByline`'s "Generated from your prompt" imply a model wrote it. Gold
 * rather than red for the same reason.
 */
export default function PlanFallbackNotice({
  destination,
}: {
  destination: string;
}) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl border border-gold-warm/25 bg-gold-warm/[.08] px-4 py-3 text-[13.5px] leading-[1.55] text-gold-deep">
      <span
        aria-hidden="true"
        className="mt-[6px] inline-block h-[7px] w-[7px] flex-none rounded-full bg-gold-warm"
      />
      <span>
        <span className="font-bold">
          Our own itinerary, not the model&rsquo;s.
        </span>{" "}
        The trip planner didn&rsquo;t answer just now, so this is our built-in
        route for {destination}. Reload the page to try again.
      </span>
    </p>
  );
}
