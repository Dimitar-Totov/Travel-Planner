"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MapPinIcon,
} from "@/components/icons";
import type { ShownStop } from "@/lib/hooks/useGuideDetail";
import StopPin from "./StopPin";
import StopThumb from "./StopThumb";

const TABS = ["About", "Photos", "Mentions"] as const;
type Tab = (typeof TABS)[number];

/** The house easing curve. */
const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];

/**
 * External destinations for the "Open in" row. The design's are dead spans;
 * these are real. Google Maps gets the coordinates — a name search can land on
 * the wrong branch of a chain, a lat/lng cannot.
 */
function openInLinks(stop: ShownStop["stop"]) {
  const query = encodeURIComponent(
    stop.address ? `${stop.name}, ${stop.address}` : stop.name,
  );
  return [
    {
      label: "Google Maps",
      href: `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`,
    },
    {
      label: "Google",
      href: `https://www.google.com/search?q=${query}`,
    },
  ];
}

interface StopDetailCardProps {
  selected: ShownStop | null;
  /** 0-based position of `selected` within the shown stops. */
  index: number;
  total: number;
  saved: boolean;
  onToggleSaved: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/**
 * The floating card along the bottom of the map pane.
 *
 * `AnimatePresence` is what earns Motion here, exactly as it does for the
 * feed's scroll-to-top button: an exit animation needs the card to stay mounted
 * while it slides away, which conditional rendering alone cannot do.
 *
 * The contents are a separate component keyed on the stop. That remount is
 * load-bearing twice over — it replays the enter animation so moving between
 * stops reads as a change rather than a repaint, and it resets the tab to About
 * without an effect, so nobody lands on an empty Photos tab for the next stop.
 */
export default function StopDetailCard(props: StopDetailCardProps) {
  const { selected } = props;
  const reduceMotion = useReducedMotion();

  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 26 };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          key="stop-detail-card"
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={{ duration: reduceMotion ? 0.12 : 0.34, ease: EASE }}
          className="absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-[20px] bg-white shadow-[0_34px_70px_-34px_rgba(11,36,56,.7),0_0_0_1px_rgba(20,52,78,.07)] sm:inset-x-5 sm:bottom-5"
        >
          <StopCardBody
            key={selected.key}
            {...props}
            selected={selected}
            reduceMotion={Boolean(reduceMotion)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StopCardBody({
  selected,
  index,
  total,
  saved,
  onToggleSaved,
  onPrev,
  onNext,
  onClose,
  reduceMotion,
}: Omit<StopDetailCardProps, "selected"> & {
  selected: ShownStop;
  reduceMotion: boolean;
}) {
  const [tab, setTab] = useState<Tab>("About");
  const stop = selected.stop;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[#eef1f4] px-3 sm:px-4">
        {/* `overflow-x-auto` is a guard, not a feature: at 360px the tab strip
            and the pager together are within a few pixels of the card's inner
            width, and a long counter ("12 of 27") is what tips it over. */}
        <div
          role="tablist"
          aria-label="Stop details"
          className="flex min-w-0 items-center gap-3 overflow-x-auto sm:gap-[22px]"
        >
          {TABS.map((name) => {
            const active = name === tab;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                id={`stop-tab-${name}`}
                aria-selected={active}
                aria-controls="stop-tabpanel"
                onClick={() => setTab(name)}
                className={`whitespace-nowrap border-b-2 px-0.5 pb-3 pt-3.5 text-[12.5px] outline-offset-2 outline-brand-500 transition-colors focus-visible:outline-2 sm:text-[13.5px] ${
                  active
                    ? "border-brand-500 font-bold text-brand-700"
                    : "border-transparent font-semibold text-[#7c8a93] hover:text-ink"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-none items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={index <= 0}
            aria-label="Previous stop"
            className="tp-chip inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[#68767f] outline-offset-2 outline-brand-500 hover:bg-[#eaf3f9] hover:text-brand-700 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-2 disabled:hover:text-[#68767f] sm:h-[27px] sm:w-[27px]"
          >
            <ChevronLeftIcon size={13} />
          </button>
          <span className="whitespace-nowrap text-[11.5px] font-bold tabular-nums text-[#68767f] sm:text-[12px]">
            {index + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={index >= total - 1}
            aria-label="Next stop"
            className="tp-chip inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[#68767f] outline-offset-2 outline-brand-500 hover:bg-[#eaf3f9] hover:text-brand-700 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-2 disabled:hover:text-[#68767f] sm:h-[27px] sm:w-[27px]"
          >
            <ChevronRightIcon size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stop details"
            className="tp-chip ml-1 inline-flex h-[27px] w-[27px] items-center justify-center rounded-full bg-surface-2 text-[#68767f] outline-offset-2 outline-brand-500 hover:bg-[#eaf3f9] hover:text-brand-700 focus-visible:outline-2"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      </div>

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: EASE }}
        id="stop-tabpanel"
        role="tabpanel"
        aria-labelledby={`stop-tab-${tab}`}
        className="tp-scroll max-h-[52vh] overflow-y-auto px-4 pb-4 pt-3.5 sm:px-[18px] sm:pb-[18px] sm:pt-4"
      >
        {tab === "About" && (
          <div className="flex gap-4 sm:gap-[18px]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="flex-none">
                  <StopPin
                    n={selected.number}
                    tone={stop.highlight ? "gold" : "brand"}
                    size={20}
                    selected
                  />
                </span>
                <h3 className="min-w-0 text-[16px] font-bold tracking-[-.014em] text-ink sm:text-[17px]">
                  {stop.name}
                </h3>
              </div>

              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-muted sm:text-[14px]">
                {stop.about ?? stop.notes[0]}
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onToggleSaved}
                  aria-pressed={saved}
                  className={`tp-btn inline-flex items-center gap-[7px] rounded-full border px-4 py-2 text-[13px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 ${
                    saved
                      ? "border-gold-warm bg-gold-warm text-white shadow-[0_12px_24px_-14px_rgba(160,100,30,.95)]"
                      : "border-[#d5e2ea] bg-white text-brand-700 hover:border-brand-700 hover:bg-brand-700 hover:text-white"
                  }`}
                >
                  <BookmarkIcon size={13} filled={saved} />
                  {saved ? "Saved" : "Save"}
                </button>

                {stop.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-[#5c6b76]"
                  >
                    {tag}
                  </span>
                ))}

                {stop.address && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#8b98a1]">
                    <MapPinIcon size={13} />
                    {stop.address}
                  </span>
                )}
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-[#f1f4f6] pt-3.5">
                <span className="text-[12px] font-bold text-[#8b98a1]">
                  Open in
                </span>
                {openInLinks(stop).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tp-btn inline-flex items-center gap-1.5 rounded-full border border-[#e2e9ee] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#3a4a54] outline-offset-2 outline-brand-500 hover:border-brand-500/40 hover:text-brand-700 focus-visible:outline-2"
                  >
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </div>
            </div>

            <StopThumb
              name={stop.name}
              tone={stop.highlight ? "gold" : "brand"}
              className="hidden h-[132px] w-[150px] flex-none rounded-[13px] sm:block"
            />
          </div>
        )}

        {/* Both non-About tabs are honest empty states, not upload affordances
            — there is no media pipeline and no comments API. */}
        {tab === "Photos" && (
          <EmptyTab
            title="Photos arrive with uploads"
            body="Traveller photos of each stop land here once uploads ship."
          />
        )}
        {tab === "Mentions" && (
          <EmptyTab
            title="No mentions yet"
            body="When other guides link to this stop, they'll show up here."
          />
        )}
      </motion.div>
    </>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-3 px-6 py-8 text-center">
      <span className="text-[14px] font-bold text-ink">{title}</span>
      <span className="mt-1.5 max-w-[38ch] text-[13px] leading-[1.55] text-muted-2">
        {body}
      </span>
    </div>
  );
}
