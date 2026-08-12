import { ArrowRightIcon } from "@/components/icons";

export default function CtaBand() {
  return (
    <section id="cta" className="bg-white px-6 pb-16 sm:px-10">
      <div className="mx-auto max-w-[1160px]">
        <div className="relative flex flex-wrap items-center justify-between gap-10 overflow-hidden rounded-[26px] bg-[linear-gradient(150deg,#1d5a80,#123f5e)] px-8 py-14 sm:px-14">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(90% 120% at 88% 0%, rgba(126,196,235,.28), transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="m-0 text-[30px] font-extrabold leading-[1.06] tracking-[-.025em] text-white sm:text-[38px]">
              Where to{" "}
              <span className="font-serif font-medium italic">next?</span>
            </h2>
            <p className="mt-3.5 max-w-[440px] text-[17px] leading-[1.55] text-[#cadeeb]">
              Type a sentence. Get the itinerary, map, and checklist before your
              coffee&rsquo;s cold.
            </p>
          </div>
          <a
            href="#plan-prompt"
            className="tp-btn relative inline-flex flex-none items-center gap-2.5 rounded-full bg-white px-[30px] py-[17px] text-[16px] font-bold text-[#123f5e] shadow-[0_20px_40px_-18px_rgba(0,0,0,.7)]"
          >
            Plan my trip — free
            <ArrowRightIcon size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
