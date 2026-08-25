import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import CtaBand from "@/components/landing/CtaBand";
import SentenceBuilder from "@/components/landing/SentenceBuilder";
import SiteFooter from "@/components/site/SiteFooter";
import { auth } from "@/lib/auth";

export default async function Home() {
  // Planning is gated behind an account. Same pattern as NavAccount: the
  // session is read server-side and handed down as a plain boolean, so the
  // client components stay free of next-auth (there is no SessionProvider).
  const isAuthenticated = !!(await auth())?.user;

  return (
    <div className="bg-white">
      <Hero isAuthenticated={isAuthenticated} />

      {/* Sentence builder overlapping up into the hero. Nothing is "planned"
          here — both this card's CTA and the hero's route to /plan, which is
          where a plan actually loads. */}
      <section className="bg-[#f4f7f9] px-4 pb-[68px] sm:px-10">
        <div className="relative mx-auto -mt-32 max-w-[1060px]">
          <SentenceBuilder isAuthenticated={isAuthenticated} />
        </div>
      </section>

      <Features />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
