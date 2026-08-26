"use client";

import { useCallback, useMemo, useState } from "react";
import type { GuideDay, GuideStop } from "@/lib/itinerary";

/**
 * A stop while it is being written.
 *
 * `id` is the identity every editor control keys off — React keys, the
 * `CollapsibleSection` ids, and the location picker's target — because indices
 * shift the moment a day or stop is reordered or removed and would re-key the
 * whole subtree under an author mid-edit.
 *
 * `placed` is the part `GuideStop` cannot express. `lat`/`lng` are non-optional
 * numbers there, so "the author hasn't chosen a point yet" needs its own flag;
 * a new stop is seeded with a plausible coordinate (the previous stop in its
 * day, else the last placed stop anywhere) purely so the preview map has
 * somewhere sane to draw it instead of dropping a pin in the Atlantic and
 * zooming the whole itinerary out to fit it. The editor and the preview notice
 * both say plainly that such a stop still needs a location.
 *
 * `photo` is editor-only too, for the same reason `coverImage` lives outside
 * `GuideStop`: it isn't part of the published shape, it's resolved separately
 * (`stopImages`, normally an Unsplash lookup). `CreateGuidePreview` turns a
 * placed `photo` into that same shape so a stop with an uploaded photo previews
 * with a real image instead of `StopThumb`'s placeholder.
 */
export interface DraftStop extends GuideStop {
  id: string;
  placed: boolean;
  photo: DraftPhoto | null;
}

export interface DraftDay {
  id: string;
  title: string;
  summary: string;
  stops: DraftStop[];
}

/**
 * An uploaded photo while it is being written.
 *
 * `src` cannot be the identity the way a tag or a tip string is: it is the
 * file's own bytes, so picking the same image twice yields two entries that are
 * `===` equal. As a React key those collide, and as a remove predicate they
 * delete both thumbnails on one click. `id` is what `PhotoUploadField` keys and
 * removes by instead.
 */
export interface DraftPhoto {
  id: string;
  src: string;
}

/** Which stop the location picker is currently placing. */
export interface PickerTarget {
  dayId: string;
  stopId: string;
}

export type MoveDirection = "up" | "down";

/**
 * Fixed ids for the row the form starts with.
 *
 * `crypto.randomUUID()` everywhere would be generated once on the server during
 * SSR and again in the browser during hydration, and these ids reach the DOM as
 * `id` attributes on the day accordions — a guaranteed hydration mismatch.
 * Every id minted after mount comes from an event handler, which only ever runs
 * in the browser, so a literal seed is enough to keep the first render stable.
 */
const SEED_DAY_ID = "day-seed";
const SEED_STOP_ID = "stop-seed";

/** Where the map opens when the draft has nothing placed at all. */
const WORLD_CENTER = { lat: 20, lng: 0 };

function newStop(id: string, seed: { lat: number; lng: number }): DraftStop {
  return {
    id,
    name: "",
    lat: seed.lat,
    lng: seed.lng,
    placed: false,
    photo: null,
    tags: [],
    notes: [],
  };
}

/** Every photo is minted from a file-picker change handler, so `randomUUID`
 *  here never runs during SSR and can't mismatch on hydration. */
function newPhoto(src: string): DraftPhoto {
  return { id: crypto.randomUUID(), src };
}

function seedDay(): DraftDay {
  return {
    id: SEED_DAY_ID,
    title: "Day 1",
    summary: "",
    stops: [newStop(SEED_STOP_ID, WORLD_CENTER)],
  };
}

/** Adds `value` unless it is blank or already present. Both the stop rows and
 *  the tips list render these strings keyed by their own value, so a duplicate
 *  is a React key collision as well as noise. */
function withEntry(list: string[], value: string): string[] {
  const trimmed = value.trim();
  if (trimmed === "" || list.includes(trimmed)) return list;
  return [...list, trimmed];
}

function moved<T>(list: T[], index: number, direction: MoveDirection): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Drops the editor-only fields and any optional field the author left empty,
 *  so the preview renders exactly what a published guide would. */
function toGuideStop(stop: DraftStop): GuideStop {
  const result: GuideStop = {
    name: stop.name.trim() || "Untitled stop",
    lat: stop.lat,
    lng: stop.lng,
    tags: stop.tags,
    notes: stop.notes,
  };
  if (stop.about?.trim()) result.about = stop.about.trim();
  if (stop.address?.trim()) result.address = stop.address.trim();
  if (stop.priceLevel !== undefined) result.priceLevel = stop.priceLevel;
  if (stop.transfer) result.transfer = stop.transfer;
  if (stop.highlight) result.highlight = true;
  return result;
}

export interface CreateGuideFormState {
  heroTitle: string;
  setHeroTitle: (value: string) => void;
  heroAccent: string;
  setHeroAccent: (value: string) => void;
  blurb: string;
  setBlurb: (value: string) => void;
  intro: string;
  setIntro: (value: string) => void;
  currency: string;
  setCurrency: (value: string) => void;
  bestTime: string;
  setBestTime: (value: string) => void;
  /** The hero photo, or `null` before one is picked. A `DraftPhoto` like a
   *  stop's own `photo`, so both upload fields take the same prop shape. */
  coverImage: DraftPhoto | null;
  setCoverImage: (dataUrl: string) => void;
  clearCoverImage: () => void;

  tags: string[];
  addTag: (value: string) => void;
  removeTag: (value: string) => void;

  generalTips: string[];
  addGeneralTip: (value: string) => void;
  removeGeneralTip: (value: string) => void;

  days: DraftDay[];
  addDay: () => void;
  removeDay: (dayId: string) => void;
  moveDay: (dayId: string, direction: MoveDirection) => void;
  updateDay: (dayId: string, patch: Partial<Omit<DraftDay, "id">>) => void;

  addStop: (dayId: string) => void;
  removeStop: (dayId: string, stopId: string) => void;
  moveStop: (dayId: string, stopId: string, direction: MoveDirection) => void;
  updateStop: (
    dayId: string,
    stopId: string,
    patch: Partial<Omit<DraftStop, "id">>,
  ) => void;
  setStopPhoto: (dayId: string, stopId: string, dataUrl: string) => void;
  clearStopPhoto: (dayId: string, stopId: string) => void;

  isDayOpen: (dayId: string) => boolean;
  toggleDay: (dayId: string) => void;

  pickerTarget: PickerTarget | null;
  openPicker: (dayId: string, stopId: string) => void;
  closePicker: () => void;
  confirmPickedLocation: (lat: number, lng: number) => void;

  /** The publish/preview shape: editor-only fields stripped. */
  asGuideDays: GuideDay[];
  stopCount: number;
  /** Stops the author has not put on the map yet. */
  unplacedCount: number;
}

/**
 * Every piece of state behind `/create-guide`.
 *
 * One hook rather than per-section state because the page has two faces over
 * the same draft — the form and the live `ItineraryDetailView` preview — plus a
 * modal map picker that writes back into a stop it was handed by id. Splitting
 * it would mean lifting most of it back up to the shell anyway.
 *
 * Follows `useGuideDetail`'s convention: flat state and actions, no reducer, no
 * context. And like everything else authored in this app, it is **in-memory
 * only** — there is no guides-write API and no local persistence anywhere in
 * the codebase, so a reload starts a fresh draft.
 */
export function useCreateGuideForm(): CreateGuideFormState {
  const [heroTitle, setHeroTitle] = useState("");
  const [heroAccent, setHeroAccent] = useState("");
  const [blurb, setBlurb] = useState("");
  const [intro, setIntro] = useState("");
  const [currency, setCurrency] = useState("€");
  const [bestTime, setBestTime] = useState("");
  const [coverImage, setCoverImageState] = useState<DraftPhoto | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [generalTips, setGeneralTips] = useState<string[]>([]);
  const [days, setDays] = useState<DraftDay[]>(() => [seedDay()]);
  const [openDays, setOpenDays] = useState<ReadonlySet<string>>(
    () => new Set([SEED_DAY_ID]),
  );
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const setCoverImage = useCallback(
    (dataUrl: string) => setCoverImageState(newPhoto(dataUrl)),
    [],
  );
  const clearCoverImage = useCallback(() => setCoverImageState(null), []);

  const addTag = useCallback(
    (value: string) => setTags((current) => withEntry(current, value)),
    [],
  );
  const removeTag = useCallback(
    (value: string) =>
      setTags((current) => current.filter((tag) => tag !== value)),
    [],
  );
  const addGeneralTip = useCallback(
    (value: string) => setGeneralTips((current) => withEntry(current, value)),
    [],
  );
  const removeGeneralTip = useCallback(
    (value: string) =>
      setGeneralTips((current) => current.filter((tip) => tip !== value)),
    [],
  );

  const addDay = useCallback(() => {
    const id = crypto.randomUUID();
    setDays((current) => [
      ...current,
      { id, title: `Day ${current.length + 1}`, summary: "", stops: [] },
    ]);
    // A day you just asked for should be the one you can type into.
    setOpenDays((current) => new Set(current).add(id));
  }, []);

  const removeDay = useCallback((dayId: string) => {
    setDays((current) => current.filter((day) => day.id !== dayId));
  }, []);

  const moveDay = useCallback((dayId: string, direction: MoveDirection) => {
    setDays((current) =>
      moved(
        current,
        current.findIndex((day) => day.id === dayId),
        direction,
      ),
    );
  }, []);

  const updateDay = useCallback(
    (dayId: string, patch: Partial<Omit<DraftDay, "id">>) => {
      setDays((current) =>
        current.map((day) => (day.id === dayId ? { ...day, ...patch } : day)),
      );
    },
    [],
  );

  const addStop = useCallback((dayId: string) => {
    setDays((current) => {
      const day = current.find((item) => item.id === dayId);
      if (!day) return current;
      // Seeded from the nearest thing the author has already placed, so the
      // preview map stays readable before this stop gets its own point.
      const seed =
        [...day.stops].reverse().find((stop) => stop.placed) ??
        current
          .flatMap((item) => item.stops)
          .reverse()
          .find((stop) => stop.placed) ??
        WORLD_CENTER;

      return current.map((item) =>
        item.id === dayId
          ? {
              ...item,
              stops: [
                ...item.stops,
                newStop(crypto.randomUUID(), { lat: seed.lat, lng: seed.lng }),
              ],
            }
          : item,
      );
    });
    setOpenDays((current) => new Set(current).add(dayId));
  }, []);

  const removeStop = useCallback((dayId: string, stopId: string) => {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? { ...day, stops: day.stops.filter((stop) => stop.id !== stopId) }
          : day,
      ),
    );
  }, []);

  const moveStop = useCallback(
    (dayId: string, stopId: string, direction: MoveDirection) => {
      setDays((current) =>
        current.map((day) =>
          day.id === dayId
            ? {
                ...day,
                stops: moved(
                  day.stops,
                  day.stops.findIndex((stop) => stop.id === stopId),
                  direction,
                ),
              }
            : day,
        ),
      );
    },
    [],
  );

  const updateStop = useCallback(
    (dayId: string, stopId: string, patch: Partial<Omit<DraftStop, "id">>) => {
      setDays((current) =>
        current.map((day) =>
          day.id === dayId
            ? {
                ...day,
                stops: day.stops.map((stop) =>
                  stop.id === stopId ? { ...stop, ...patch } : stop,
                ),
              }
            : day,
        ),
      );
    },
    [],
  );

  const setStopPhoto = useCallback(
    (dayId: string, stopId: string, dataUrl: string) =>
      updateStop(dayId, stopId, { photo: newPhoto(dataUrl) }),
    [updateStop],
  );
  const clearStopPhoto = useCallback(
    (dayId: string, stopId: string) =>
      updateStop(dayId, stopId, { photo: null }),
    [updateStop],
  );

  const toggleDay = useCallback((dayId: string) => {
    setOpenDays((current) => {
      const next = new Set(current);
      if (!next.delete(dayId)) next.add(dayId);
      return next;
    });
  }, []);

  const openPicker = useCallback((dayId: string, stopId: string) => {
    setPickerTarget({ dayId, stopId });
  }, []);
  const closePicker = useCallback(() => setPickerTarget(null), []);

  const confirmPickedLocation = useCallback(
    (lat: number, lng: number) => {
      if (!pickerTarget) return;
      updateStop(pickerTarget.dayId, pickerTarget.stopId, {
        lat,
        lng,
        placed: true,
      });
      setPickerTarget(null);
    },
    [pickerTarget, updateStop],
  );

  const asGuideDays = useMemo<GuideDay[]>(
    () =>
      days.map((day, index) => ({
        title: day.title.trim() || `Day ${index + 1}`,
        summary: day.summary.trim(),
        stops: day.stops.map(toGuideStop),
      })),
    [days],
  );

  const stopCount = useMemo(
    () => days.reduce((total, day) => total + day.stops.length, 0),
    [days],
  );

  const unplacedCount = useMemo(
    () =>
      days.reduce(
        (total, day) => total + day.stops.filter((stop) => !stop.placed).length,
        0,
      ),
    [days],
  );

  return {
    heroTitle,
    setHeroTitle,
    heroAccent,
    setHeroAccent,
    blurb,
    setBlurb,
    intro,
    setIntro,
    currency,
    setCurrency,
    bestTime,
    setBestTime,
    coverImage,
    setCoverImage,
    clearCoverImage,

    tags,
    addTag,
    removeTag,

    generalTips,
    addGeneralTip,
    removeGeneralTip,

    days,
    addDay,
    removeDay,
    moveDay,
    updateDay,

    addStop,
    removeStop,
    moveStop,
    updateStop,
    setStopPhoto,
    clearStopPhoto,

    isDayOpen: (dayId) => openDays.has(dayId),
    toggleDay,

    pickerTarget,
    openPicker,
    closePicker,
    confirmPickedLocation,

    asGuideDays,
    stopCount,
    unplacedCount,
  };
}
