"use client";

import { useEffect, useState } from "react";

type Clock = { country: string; timeZone: string };

/** Roughly west-to-east, so the ticker reads like a sweep around the planet. */
const CLOCKS: readonly Clock[] = [
  { country: "Japan", timeZone: "Asia/Tokyo" },
  { country: "Australia", timeZone: "Australia/Sydney" },
  { country: "Singapore", timeZone: "Asia/Singapore" },
  { country: "Thailand", timeZone: "Asia/Bangkok" },
  { country: "UAE", timeZone: "Asia/Dubai" },
  { country: "Greece", timeZone: "Europe/Athens" },
  { country: "Bulgaria", timeZone: "Europe/Sofia" },
  { country: "Italy", timeZone: "Europe/Rome" },
  { country: "France", timeZone: "Europe/Paris" },
  { country: "Spain", timeZone: "Europe/Madrid" },
  { country: "UK", timeZone: "Europe/London" },
  { country: "Iceland", timeZone: "Atlantic/Reykjavik" },
  { country: "Brazil", timeZone: "America/Sao_Paulo" },
  { country: "USA", timeZone: "America/New_York" },
  { country: "Mexico", timeZone: "America/Mexico_City" },
  { country: "Canada", timeZone: "America/Vancouver" },
];

/** Minute resolution only, so there's no reason to wake up every second. */
const TICK_MS = 20_000;

/** Without the marquee only a handful of cities fit on one line. */
const STATIC_COUNT = 5;

/** Matches the rendered line height, so the strip doesn't shift when the
 *  post-mount times arrive. The desktop type bump below pins its own leading to
 *  the same 16px (`/[16px]`) rather than growing the strip, which would push the
 *  whole bottom bar taller on `lg` for no visual gain. */
const STRIP_HEIGHT = "h-4";

/** Fades the tail of the ticker out instead of letting it collide with the
 *  tagline pinned to the other end of the strip. */
const EDGE_FADE = "linear-gradient(90deg,#000 0%,#000 82%,transparent 100%)";

/**
 * Ambient strip of local times in the countries the app plans trips to.
 *
 * Everything comes from `Intl.DateTimeFormat`, so DST is handled by the
 * browser's own tz database and the component makes no network calls. The
 * times are nondeterministic, so the server renders an empty (but correctly
 * sized) strip and the values only appear after mount — there's nothing for
 * hydration to disagree about.
 */
export default function WorldClock() {
  const [times, setTimes] = useState<readonly string[] | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Formatters are expensive to build and never change — one per zone, made
    // once on mount rather than 16 fresh ones on every tick.
    const formatters = CLOCKS.map(
      ({ timeZone }) =>
        new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
        }),
    );

    const tick = () => {
      const now = new Date();
      setTimes(formatters.map((formatter) => formatter.format(now)));
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(motion.matches);
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);

  const entries = times
    ? CLOCKS.map((clock, i) => ({ ...clock, time: times[i] })).slice(
        0,
        reduceMotion ? STATIC_COUNT : CLOCKS.length,
      )
    : [];
  const scrolling = !reduceMotion && entries.length > 0;

  return (
    // Decorative chrome, and a duplicated one at that — a screen reader has no
    // use for sixteen scrolling clocks.
    <div
      aria-hidden
      className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[620px]"
    >
      <span className="h-[5px] w-[5px] flex-none rounded-full bg-gold" />
      {/* Reads as the strip's heading, so it takes the serif accent and stays a
          step larger than the times it labels. Its leading is pinned to the
          ticker's 16px for the same reason the entries' is — the bar's height
          shouldn't move just because the type grew. */}
      <span className="flex-none font-serif text-[14px]/[16px] italic text-[#7ea6c1] lg:text-[16px]/[16px]">
        World clock
      </span>

      <div
        className={`relative min-w-0 flex-1 overflow-hidden ${STRIP_HEIGHT}`}
        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
      >
        {/* Nothing to scroll before the first tick lands, and nothing to scroll
            under reduced motion — in both cases the track just sits still. */}
        <div className={`flex w-max ${scrolling ? "tp-ticker" : ""}`}>
          <Track entries={entries} />
          {/* The second copy is what makes the -50% loop seamless. */}
          {scrolling && <Track entries={entries} />}
        </div>
      </div>
    </div>
  );
}

type Entry = Clock & { time: string };

function Track({ entries }: { entries: readonly Entry[] }) {
  return (
    <div className={`flex flex-none items-center ${STRIP_HEIGHT}`}>
      {entries.map((entry) => (
        <span
          key={entry.timeZone}
          className="whitespace-nowrap font-mono text-[11.5px] tracking-[.08em] lg:text-[13px]/[16px]"
        >
          <span className="text-[#6d93ac]">{entry.country}</span>{" "}
          <span className="text-[#c2dced] tabular-nums">{entry.time}</span>
          <span className="px-2.5 text-[#456e8b]">·</span>
        </span>
      ))}
    </div>
  );
}
