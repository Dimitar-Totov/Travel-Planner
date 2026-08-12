import type { ReactNode } from "react";
import HeroGlobe from "@/components/landing/HeroGlobe";
import SiteNav from "@/components/site/SiteNav";
import WorldClock from "./WorldClock";

/** Same gradient family as the landing hero, so arriving here from `/` doesn't
 *  feel like a different product. */
const PAGE_GRADIENT =
  "bg-[linear-gradient(180deg,#17567c_0%,#114a6d_42%,#0d3d5b_78%,#0b3553_100%)]";

/** No headline competing with it here, so the globe runs larger than on the
 *  hero — big enough to read as the page's subject rather than a texture. */
const GLOBE_SCALE = 1.45;

/** On the hero the flat lattice is half the point; here it isn't — the globe is
 *  what the page is about, and a sign-in form is somewhere people arrive at a
 *  random moment, so catching the backdrop mid-grid would be the common case.
 *  Rather than add a "globe only" mode to HeroGlobe, hold the globe long enough
 *  that nobody sits through a cycle: the 1s grid still buys the one-off morph-in
 *  on load, then the globe stays put for a quarter of an hour. */
const GLOBE_GRID_SECONDS = 1;
const GLOBE_HOLD_SECONDS = 900;

type AuthShellProps = {
  /** Card contents — heading, provider buttons, form, legal note. */
  children: ReactNode;
};

/**
 * Full-bleed backdrop shared by /sign-in and /sign-up: the dot-matrix globe,
 * the shared site nav, the ambient bottom strip, and a centred white card slot.
 */
export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden text-[#e9f3f9] ${PAGE_GRADIENT}`}
    >
      <HeroGlobe
        scale={GLOBE_SCALE}
        gridSeconds={GLOBE_GRID_SECONDS}
        globeSeconds={GLOBE_HOLD_SECONDS}
      />

      {/* Same bar as the landing hero — the "wrong form?" swap link lives in
          the card itself, so nothing is lost by dropping the bespoke bar. */}
      <SiteNav variant="onDark" />

      <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="tp-rise w-full max-w-[420px] rounded-[14px] bg-white p-6 text-ink shadow-[0_44px_90px_-40px_rgba(4,26,44,.9),0_0_0_1px_rgba(255,255,255,.08)] sm:p-8">
          {children}
        </div>
      </main>

      {/* The clock takes the leftover width and the tagline is `flex-none`, so
          the two can never run into each other; below `sm` the tagline drops
          out entirely rather than wrapping under the card. */}
      <div className="relative flex items-center justify-between gap-6 px-6 pb-6 sm:px-10">
        <WorldClock />
        <p className="hidden flex-none font-mono text-[10px] uppercase tracking-[.2em] text-[#5b7f9b] sm:block">
          Everywhere, planned in seconds
        </p>
      </div>
    </div>
  );
}
