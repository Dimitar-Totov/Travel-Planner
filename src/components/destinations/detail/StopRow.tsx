"use client";

import type { GuideStop } from "@/lib/guideItineraries";
import type { DestinationImage } from "@/lib/unsplash";
import { BookmarkIcon } from "@/components/icons";
import StopPin from "./StopPin";
import StopThumb from "./StopThumb";

/**
 * The mockup's scale is three symbols. A level-4 stop needs a fourth, so the
 * scale grows to fit rather than clipping the top of the range.
 */
function priceScale(level: number): number {
  return Math.max(3, level);
}

interface StopRowProps {
  stop: GuideStop;
  /** 1-based position within its day — the number on the pin. */
  number: number;
  stopKey: string;
  /** Symbol the itinerary prices in, e.g. "€". */
  currency: string;
  saved: boolean;
  selected: boolean;
  /** Zebra tint. Highlighted stops ignore it and keep their warm card. */
  alternate: boolean;
  /**
   * Photo for the row's thumbnail. `null`/omitted keeps the gradient
   * placeholder. Deliberately *no* attribution overlay here — at 88px tall on
   * `lg` there is no room for a legible credit; the About tab's larger image is
   * where this stop's photographer is credited.
   */
  thumbImage?: DestinationImage | null;
  onSelect: () => void;
  onToggleSaved: () => void;
}

/**
 * One stop in the reading column.
 *
 * Selection uses the stretched-link pattern: the stop title is the real
 * `<button>` and its `::after` covers the whole row, so the entire card is a
 * click target while the accessible name, the focus ring and the tab stop all
 * stay on the words. The Save pill is lifted above that overlay with `z-1` so
 * it remains its own control.
 */
export default function StopRow({
  stop,
  number,
  stopKey,
  currency,
  saved,
  selected,
  alternate,
  thumbImage,
  onSelect,
  onToggleSaved,
}: StopRowProps) {
  const tone = stop.highlight ? "gold" : "brand";

  const surface = stop.highlight
    ? "bg-gold-warm/[.07] ring-1 ring-inset ring-gold-warm/25"
    : alternate
      ? "bg-surface-3 hover:bg-surface"
      : "hover:bg-surface-3";

  return (
    <div
      id={`stop-${stopKey}`}
      data-selected={selected}
      className={`tp-stop relative flex gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4 ${surface} ${
        selected ? "outline-2 -outline-offset-2 outline-brand-500/50" : ""
      }`}
    >
      <span className="mt-0.5 flex-none">
        <StopPin n={number} tone={tone} size={24} />
      </span>

      {/* `flex-col-reverse` puts the thumbnail above the text on phones while
          keeping the text first in the DOM, which is the order a screen reader
          and a keyboard should get. */}
      <div className="flex min-w-0 flex-1 flex-col-reverse gap-3 sm:flex-row sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-[16.5px] font-bold leading-[1.25] tracking-[-.014em] text-ink sm:text-[17.5px]">
              <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className="rounded-sm text-left outline-offset-4 outline-brand-500 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2"
              >
                {stop.name}
              </button>
            </h3>

            {/* Colour-only hover: deliberately not `.tp-btn`, whose -2px lift
                made every Save pill twitch as the pointer crossed a row on the
                way to something else. */}
            <button
              type="button"
              onClick={onToggleSaved}
              aria-pressed={saved}
              className={`relative z-1 inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold outline-offset-2 outline-brand-500 transition-colors duration-200 focus-visible:outline-2 sm:text-[12.5px] ${
                saved
                  ? "border-gold-warm bg-gold-warm text-white shadow-[0_10px_20px_-12px_rgba(160,100,30,.9)]"
                  : "border-[#d5e2ea] bg-white text-brand-700 hover:border-brand-700 hover:bg-brand-700 hover:text-white"
              }`}
            >
              <BookmarkIcon size={13} filled={saved} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          {(stop.priceLevel !== undefined || stop.tags.length > 0) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {stop.priceLevel !== undefined && (
                <span
                  className="rounded-md bg-success/10 px-2 py-1 text-[11.5px] font-bold text-success"
                  title={`Price level ${stop.priceLevel} of ${priceScale(stop.priceLevel)}`}
                >
                  {currency.repeat(stop.priceLevel)}
                  <span className="text-[#b9c6cd]">
                    {currency.repeat(
                      priceScale(stop.priceLevel) - stop.priceLevel,
                    )}
                  </span>
                </span>
              )}
              {stop.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-md px-2 py-1 text-[11.5px] font-semibold ${
                    stop.highlight
                      ? "bg-gold-warm/15 text-gold-deep"
                      : "bg-surface text-[#5c6b76]"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {stop.notes.length > 0 && (
            <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-[19px] text-[13.5px] leading-[1.55] text-muted sm:text-[14px]">
              {stop.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Sized off the viewport rather than a container query because the
            reading column is itself a fixed fraction of the viewport from `lg`
            up: 170px would squeeze the text to ~230px at exactly 1024. */}
        <StopThumb
          name={stop.name}
          tone={tone}
          image={thumbImage}
          sizes="(min-width: 1280px) 170px, (min-width: 1024px) 132px, (min-width: 640px) 170px, 100vw"
          className="h-[128px] w-full flex-none sm:h-[112px] sm:w-[170px] lg:h-[88px] lg:w-[132px] xl:h-[112px] xl:w-[170px]"
        />
      </div>
    </div>
  );
}
