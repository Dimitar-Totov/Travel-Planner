"use client";

import { useCallback, useMemo, useState } from "react";
import type { GuideDay, GuideStop } from "@/lib/itinerary";

/** The desktop split point. Kept here because the hook has to answer "is the
 *  map on screen right now?" inside an event handler, where the CSS `lg:`
 *  variant that draws the same line isn't observable. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * A stop lifted out of its day and given the identity the page needs: a stable
 * key, where it came from, and the number printed on its pin.
 *
 * `number` is 1-based *within its day*, not across the whole trip. That is what
 * the design does, and it is the number a reader can act on — "Day 3, stop 2"
 * survives the map being filtered, whereas a global index silently renumbers
 * every pin the moment a filter is applied.
 */
export interface ShownStop {
  /** `"<dayIndex>-<stopIndex>"` — stable for the lifetime of the itinerary. */
  key: string;
  stop: GuideStop;
  dayIndex: number;
  stopIndex: number;
  number: number;
  dayTitle: string;
}

export interface GuideDetailState {
  /** Which day sections are expanded. Multiple at once: this is a document. */
  isDayOpen: (dayIndex: number) => boolean;
  toggleDay: (dayIndex: number) => void;
  tipsOpen: boolean;
  toggleTips: () => void;

  /** `null` = every day is on the map. */
  dayFilter: number | null;
  /** The filtered day's own title, for the map's "Showing …" chip. */
  dayFilterLabel: string | null;
  toggleDayFilter: (dayIndex: number) => void;
  clearDayFilter: () => void;

  /** Every stop of the currently-shown days, in reading order. */
  shownStops: ShownStop[];
  selectedKey: string | null;
  selected: ShownStop | null;
  /** 0-based position of `selected` inside `shownStops`; -1 when nothing is. */
  selectedIndex: number;
  selectStop: (key: string) => void;
  /** As `selectStop`, plus it reveals the map when the map isn't on screen. */
  selectStopFromList: (key: string) => void;
  selectPrev: () => void;
  selectNext: () => void;
  clearSelection: () => void;

  isSaved: (key: string) => boolean;
  toggleSaved: (key: string) => void;

  mapOpen: boolean;
  openMap: () => void;
  closeMap: () => void;
}

/**
 * Every piece of client state behind the two-pane itinerary template — the
 * guide detail page and `/plan` alike.
 *
 * It lives in one hook because all of it is shared across the desktop split:
 * the reading column owns the accordions and the day filter, the map pane owns
 * the pins and the stop card, and each of them can move the other's state — a
 * day header filters the map, a pin selects a row, a row flies the map. Keeping
 * it here means neither pane has to own the other.
 *
 * It takes the `GuideDay[]` rather than a whole `GuideItinerary` because the
 * days are the only thing it ever read, and an AI-generated `TripPlan` carries
 * the same day list without any of a community guide's authorship fields.
 *
 * There is no backend behind any of it. Saved stops, the like/follow toggles in
 * the author bar, and the day filter are all in-memory only and reset on
 * navigation; persisting them needs an accounts API that does not exist yet.
 */
export function useGuideDetail(days: GuideDay[]): GuideDetailState {
  // Day 1 open, the rest closed — enough to show what the page is without
  // dumping a fourteen-day itinerary on the reader at once.
  const [openDays, setOpenDays] = useState<ReadonlySet<number>>(
    () => new Set([0]),
  );
  const [tipsOpen, setTipsOpen] = useState(true);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [mapOpen, setMapOpen] = useState(false);

  const allStops = useMemo<ShownStop[]>(
    () =>
      days.flatMap((day, dayIndex) =>
        day.stops.map((stop, stopIndex) => ({
          key: `${dayIndex}-${stopIndex}`,
          stop,
          dayIndex,
          stopIndex,
          number: stopIndex + 1,
          dayTitle: day.title,
        })),
      ),
    [days],
  );

  const shownStops = useMemo(
    () =>
      dayFilter === null
        ? allStops
        : allStops.filter((item) => item.dayIndex === dayFilter),
    [allStops, dayFilter],
  );

  // Selection is *derived* from the shown set rather than mirrored into it, so
  // filtering the map to a different day closes the stop card by construction
  // instead of needing a cleanup pass.
  const selectedIndex =
    selectedKey === null
      ? -1
      : shownStops.findIndex((item) => item.key === selectedKey);
  const selected = selectedIndex === -1 ? null : shownStops[selectedIndex];

  const selectStop = useCallback(
    (key: string) => {
      const target = allStops.find((item) => item.key === key);
      if (!target) return;
      // A stop the map is currently filtering out is still clickable in the
      // reading column. Opening it drops the filter rather than selecting
      // something the map has no pin for.
      setDayFilter((current) =>
        current === null || current === target.dayIndex ? current : null,
      );
      // …and its day is expanded, so the row the card is describing is
      // actually on screen to scroll to.
      setOpenDays((current) =>
        current.has(target.dayIndex)
          ? current
          : new Set(current).add(target.dayIndex),
      );
      setSelectedKey(key);
    },
    [allStops],
  );

  const selectStopFromList = useCallback(
    (key: string) => {
      selectStop(key);
      // Below `lg` the stop card lives inside the map overlay, so a tap in the
      // list would otherwise select something with nowhere to render.
      if (
        typeof window !== "undefined" &&
        !window.matchMedia(DESKTOP_QUERY).matches
      ) {
        setMapOpen(true);
      }
    },
    [selectStop],
  );

  const selectPrev = useCallback(() => {
    if (selectedIndex <= 0) return;
    setSelectedKey(shownStops[selectedIndex - 1].key);
  }, [selectedIndex, shownStops]);

  const selectNext = useCallback(() => {
    if (selectedIndex === -1 || selectedIndex >= shownStops.length - 1) return;
    setSelectedKey(shownStops[selectedIndex + 1].key);
  }, [selectedIndex, shownStops]);

  const toggleDay = useCallback((dayIndex: number) => {
    setOpenDays((current) => {
      const next = new Set(current);
      if (!next.delete(dayIndex)) next.add(dayIndex);
      return next;
    });
  }, []);

  const toggleDayFilter = useCallback((dayIndex: number) => {
    setDayFilter((current) => (current === dayIndex ? null : dayIndex));
    // Filtering to a day is a request to read it, so open it too.
    setOpenDays((current) =>
      current.has(dayIndex) ? current : new Set(current).add(dayIndex),
    );
  }, []);

  const toggleSaved = useCallback((key: string) => {
    setSavedKeys((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  return {
    isDayOpen: (dayIndex) => openDays.has(dayIndex),
    toggleDay,
    tipsOpen,
    toggleTips: useCallback(() => setTipsOpen((open) => !open), []),

    dayFilter,
    dayFilterLabel:
      dayFilter === null ? null : (days[dayFilter]?.title ?? null),
    toggleDayFilter,
    clearDayFilter: useCallback(() => setDayFilter(null), []),

    shownStops,
    selectedKey,
    selected,
    selectedIndex,
    selectStop,
    selectStopFromList,
    selectPrev,
    selectNext,
    clearSelection: useCallback(() => setSelectedKey(null), []),

    isSaved: (key) => savedKeys.has(key),
    toggleSaved,

    mapOpen,
    openMap: useCallback(() => setMapOpen(true), []),
    closeMap: useCallback(() => setMapOpen(false), []),
  };
}
