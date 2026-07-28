import SiteNav from "@/components/site/SiteNav";
import PromptBox from "./PromptBox";

const TEXTURE =
  "radial-gradient(120% 85% at 82% -12%, rgba(126,196,235,.32), transparent 58%)," +
  "radial-gradient(95% 75% at -8% 118%, rgba(201,138,47,.16), transparent 55%)," +
  "repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 48px)," +
  "repeating-linear-gradient(90deg, rgba(255,255,255,.045) 0 1px, transparent 1px 48px)";

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-[linear-gradient(165deg,#1d5a80_0%,#164e73_46%,#103a58_100%)] text-[#e9f3f9]">
      <div className="pointer-events-none absolute inset-0" style={{ background: TEXTURE }} />

      <SiteNav variant="onDark" />

      <div className="relative mx-auto max-w-[860px] px-6 pb-[172px] pt-[52px] text-center sm:px-10">

        <h1 className="tp-rise mt-[22px] text-[44px] font-extrabold leading-[1.02] tracking-[-.03em] text-white text-balance sm:text-[56px] lg:text-[66px]">
          Your whole trip, planned
          <br />
          from <span className="font-serif font-medium italic">one sentence</span>.
        </h1>

        <p className="tp-rise mx-auto mt-[22px] max-w-[600px] text-[17px] leading-[1.6] text-[#cadeeb] sm:text-[18.5px]">
          Tell it where, how long, and your budget. Get back a mapped day-by-day route, real flights
          and stays, and a checklist tuned to your dates — in seconds.
        </p>

        <PromptBox />

        <div className="mt-[26px] text-[13px] tracking-[.01em] text-[#9dbccd]">
          Free to try · No card required · Prices update live
        </div>
      </div>
    </div>
  );
}
