import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import CtaBand from "@/components/landing/CtaBand";
import SentenceBuilder from "@/components/landing/SentenceBuilder";
import SiteFooter from "@/components/site/SiteFooter";

export default function Home() {
  return (
    <div className="bg-white">
      <Hero />

      {/* Sentence builder overlapping up into the hero. Nothing is "planned"
          here — both this card's CTA and the hero's route to /plan, which is
          where a plan actually loads. */}
      <section className="bg-[#f4f7f9] px-4 pb-[68px] sm:px-10">
        <div className="relative mx-auto -mt-32 max-w-[1060px]">
          <SentenceBuilder />
        </div>
      </section>

      <Features />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
