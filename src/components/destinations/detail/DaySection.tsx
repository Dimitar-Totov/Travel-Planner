"use client";

import { Fragment } from "react";
import type { GuideDay } from "@/lib/guideItineraries";
import type { StopImagePair } from "@/lib/unsplash";
import { MapPinIcon } from "@/components/icons";
import CollapsibleSection from "./CollapsibleSection";
import StopRow from "./StopRow";
import TransferConnector from "./TransferConnector";

interface DaySectionProps {
  day: GuideDay;
  dayIndex: number;
  currency: string;
  open: boolean;
  onToggle: () => void;
  /** True when the map is currently showing only this day. */
  filtered: boolean;
  onToggleFilter: () => void;
  selectedKey: string | null;
  onSelectStop: (key: string) => void;
  isSaved: (key: string) => boolean;
  onToggleSaved: (key: string) => void;
  /**
   * Resolved photos for the whole itinerary, keyed `"<dayIndex>-<stopIndex>"`
   * — the same key this component already computes for every other per-stop
   * lookup. A missing entry is the ordinary case (no Unsplash key, no results,
   * a failed call), and reads as `undefined` straight into `StopThumb`'s
   * placeholder branch.
   */
  stopImages: Record<string, StopImagePair>;
}

/**
 * One day of the itinerary: a collapsible header, the map-filter action, then
 * the day's stops with a transfer connector between each consecutive pair.
 *
 * The filter action deliberately sits *outside* the header button — a control
 * inside a control is invalid HTML and unreachable by keyboard.
 */
export default function DaySection({
  day,
  dayIndex,
  currency,
  open,
  onToggle,
  filtered,
  onToggleFilter,
  selectedKey,
  onSelectStop,
  isSaved,
  onToggleSaved,
  stopImages,
}: DaySectionProps) {
  const stopCount = day.stops.length;

  return (
    <CollapsibleSection
      id={`day-${dayIndex}`}
      size="lg"
      title={day.title}
      subtitle={`${day.summary} · ${stopCount} ${stopCount === 1 ? "stop" : "stops"}`}
      open={open}
      onToggle={onToggle}
      action={
        <button
          type="button"
          onClick={onToggleFilter}
          aria-pressed={filtered}
          className={`tp-chip ml-3.5 mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 sm:ml-4 ${
            filtered
              ? "border-brand-500 bg-brand-500/12 text-brand-700"
              : "border-transparent text-brand-500 hover:border-brand-500/25 hover:bg-brand-500/8"
          }`}
        >
          <MapPinIcon size={14} strokeWidth={2.1} />
          {filtered ? "Showing only these" : "Show only these on map"}
        </button>
      }
    >
      <div className="pb-1 pt-1.5">
        {day.stops.map((stop, stopIndex) => {
          const key = `${dayIndex}-${stopIndex}`;
          return (
            <Fragment key={key}>
              {stopIndex > 0 && stop.transfer && (
                <TransferConnector transfer={stop.transfer} />
              )}
              <StopRow
                stop={stop}
                number={stopIndex + 1}
                stopKey={key}
                currency={currency}
                saved={isSaved(key)}
                selected={selectedKey === key}
                alternate={stopIndex % 2 === 1}
                thumbImage={stopImages[key]?.thumb}
                onSelect={() => onSelectStop(key)}
                onToggleSaved={() => onToggleSaved(key)}
              />
            </Fragment>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
