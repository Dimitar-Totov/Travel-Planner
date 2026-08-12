import SiteNav from "@/components/site/SiteNav";
import HeroGlobe from "./HeroGlobe";
import PromptBox from "./PromptBox";

/** Softens the seam into the section below; paints over the canvas, under the copy. */
const BOTTOM_FADE =
  "linear-gradient(180deg,rgba(11,53,83,0) 0%,rgba(11,53,83,.55) 60%,#0b3553 100%)";

export default function Hero() {
  return (
    <div className="relative min-h-[720px] overflow-hidden bg-[linear-gradient(180deg,#17567c_0%,#114a6d_42%,#0d3d5b_78%,#0b3553_100%)] text-[#e9f3f9] lg:min-h-[860px]">
      <HeroGlobe />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px]"
        style={{ background: BOTTOM_FADE }}
      />

      <SiteNav variant="onDark" />

      <div className="relative mx-auto max-w-[860px] px-6 pb-[172px] pt-[52px] text-center sm:px-10">
        <h1
          className="tp-rise mt-[22px] text-[44px] font-extrabold leading-[1.02] tracking-[-.03em] text-white text-balance sm:text-[56px] lg:text-[66px]"
          style={{ textShadow: "0 2px 30px rgba(8,38,60,.45)" }}
        >
          Your whole trip, planned
          <br />
          from{" "}
          <span className="font-serif font-medium italic">one sentence</span>.
        </h1>

        <p
          className="tp-rise mx-auto mt-[22px] max-w-[600px] text-[17px] leading-[1.6] text-[#cadeeb] sm:text-[18.5px]"
          style={{ textShadow: "0 1px 16px rgba(8,38,60,.7)" }}
        >
          Tell it where, how long, and your budget. Get back a mapped day-by-day
          route, real flights and stays, and a checklist tuned to your dates —
          in seconds.
        </p>

        <PromptBox />

        <div className="mt-[26px] text-[13px] tracking-[.01em] text-[#9dbccd]">
          Free to try · No card required · Prices update live
        </div>
      </div>
    </div>
  );
}
