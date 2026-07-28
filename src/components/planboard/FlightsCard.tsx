import type { Flights } from "@/lib/types";
import { PlaneIcon } from "@/components/icons";

export default function FlightsCard({
  flights,
  currency,
}: {
  flights: Flights;
  currency: string;
}) {
  const { outbound, inbound, roundTrip, refreshedText } = flights;
  return (
    <div className="flex-1 rounded-2xl border border-line bg-white p-[15px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf2f8] text-[#1c5b83]">
            <PlaneIcon size={13} />
          </span>
          Flights
        </span>
        {roundTrip && (
          <span className="rounded-md bg-[#f1f4f7] px-2 py-[3px] text-[10.5px] font-semibold text-muted-2">
            round trip
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold tracking-[-.01em]">
            {outbound.from} <span className="font-medium text-[#b7c0c7]">→</span> {outbound.to}
          </div>
          <div className="mt-[3px] text-[11.5px] text-muted-2">
            {outbound.duration} · {outbound.stops} · {outbound.carrier}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-[19px] font-extrabold tracking-[-.02em] text-brand-650">
            {currency}
            {outbound.price}
          </div>
          <div className="text-[10.5px] text-[#8b98a1]">return</div>
        </div>
      </div>

      <div className="my-[11px] h-px bg-[#eef1f5]" />

      <div className="flex items-center justify-between text-[11.5px] text-muted-2">
        <span>
          {inbound.from} → {inbound.to}
        </span>
        <span className="font-bold text-[#3a4a54]">
          {currency}
          {inbound.price}
        </span>
      </div>

      <div className="mt-2.5 font-mono text-[10px] text-[#a3adb4]">{refreshedText}</div>
    </div>
  );
}
