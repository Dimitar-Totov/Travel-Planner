import type { ReactNode } from "react";
import { MapPinIcon, PlaneIcon, CheckCircleIcon } from "@/components/icons";

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <MapPinIcon size={24} strokeWidth={1.8} />,
    title: "Real routing, mapped",
    body: "Every stop lands on a live map, ordered into a sensible day-by-day route.",
  },
  {
    icon: <PlaneIcon size={23} strokeWidth={1.9} />,
    title: "Live flights & stays",
    body: "Real fares and rooms as you plan — the budget you see is the budget you pay.",
  },
  {
    icon: <CheckCircleIcon size={23} strokeWidth={1.9} />,
    title: "A checklist that thinks",
    body: "Docs, adapters, weather-based packing — built for your exact dates.",
  },
  {
    icon: <span className="text-[27px] font-bold leading-none">€</span>,
    title: "Built to your budget",
    body: "Set a number once. Every suggestion is chosen to fit it, with room to spare.",
  },
];

export default function Features() {
  return (
    <section id="how" className="bg-white px-6 pb-[84px] pt-[78px] sm:px-12">
      <div className="mx-auto max-w-[1160px]">
        <div className="max-w-[640px]">
          <span className="text-[12.5px] font-bold uppercase tracking-[.1em] text-brand-500">
            Why it feels different
          </span>
          <h2 className="mt-3.5 text-[32px] font-extrabold leading-[1.08] tracking-[-.025em] text-ink-soft sm:text-[40px]">
            Not a list of links. An actual plan.
          </h2>
        </div>

        <div className="mt-11 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="tp-feat tp-lift rounded-[18px] border border-[#e9eef2] bg-[#f7fafc] p-[22px] pt-[26px]"
            >
              <span className="tp-badge inline-flex h-14 w-14 items-center justify-center rounded-full bg-[radial-gradient(120%_120%_at_30%_22%,#4a97c6,#123f5e)] text-white shadow-[0_14px_30px_-16px_rgba(18,73,110,.95),inset_0_1px_0_rgba(255,255,255,.3)]">
                {f.icon}
              </span>
              <h3 className="mt-5 text-[17.5px] font-bold tracking-[-.01em] text-ink">{f.title}</h3>
              <p className="mt-[9px] text-[14px] leading-[1.55] text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
