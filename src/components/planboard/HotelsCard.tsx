import type { Hotel } from "@/lib/types";
import { BedIcon } from "@/components/icons";

export default function HotelsCard({
  hotels,
  nights,
  avgHotel,
  currency,
}: {
  hotels: Hotel[];
  nights: number;
  avgHotel: number;
  currency: string;
}) {
  return (
    <div className="mt-3.5 rounded-2xl border border-line bg-white p-[15px]">
      <div className="mb-[13px] flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf2f8] text-[#1c5b83]">
            <BedIcon size={13} />
          </span>
          Where you&rsquo;ll stay
        </span>
        <span className="text-[11.5px] text-[#8b98a1]">
          {nights} nights · avg {currency}
          {avgHotel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {hotels.map((h) => (
          <div
            key={h.name}
            className="overflow-hidden rounded-[13px] border border-[#eef1f5] bg-[#fbfcfd]"
          >
            <div
              className="relative h-[74px]"
              style={{ background: h.gradient }}
            >
              <span className="absolute left-2 top-2 rounded-full bg-[rgba(20,48,72,.55)] px-2 py-[3px] text-[10px] font-bold text-white backdrop-blur-[3px]">
                {h.city}
              </span>
              <span className="absolute right-2 top-2 rounded-[7px] bg-white/90 px-[7px] py-[3px] text-[10.5px] font-extrabold text-brand-650">
                {h.rating}
              </span>
            </div>
            <div className="px-[11px] pb-3 pt-2.5">
              <div className="text-[13px] font-bold leading-[1.15] tracking-[-.01em]">
                {h.name}
              </div>
              <div className="mt-[3px] text-[11px] text-[#8b98a1]">
                {h.area}
              </div>
              <div className="mt-[9px] flex items-baseline justify-between">
                <span
                  className="text-[11px] tracking-[1px] text-gold-2"
                  aria-label={`${h.stars} stars`}
                >
                  {"★".repeat(h.stars)}
                </span>
                <span className="text-[13px] font-extrabold text-brand-650">
                  {currency}
                  {h.price}
                  <span className="text-[10px] font-semibold text-[#9aa5ac]">
                    {" "}
                    /night
                  </span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
