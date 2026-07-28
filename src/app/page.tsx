import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import CtaBand from "@/components/landing/CtaBand";
import SiteFooter from "@/components/site/SiteFooter";
import PlanBoard from "@/components/planboard/PlanBoard";
import { italyPlan } from "@/lib/demo";

export default function Home() {
  return (
    <div className="bg-white">
      <Hero />

      {/* PlanBoard preview overlapping up into the hero */}
      <section className="bg-[#f4f7f9] px-4 pb-[68px] sm:px-10">
        <div className="relative mx-auto -mt-32 max-w-[1060px]">
          <PlanBoard plan={italyPlan} />
          <p className="mt-5 text-center text-[13px] text-[#7c8a93]">
            Generated from that one sentence — every flight, room, and price is pulled live.
          </p>
        </div>
      </section>

      <Features />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
