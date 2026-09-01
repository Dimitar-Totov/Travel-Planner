"use client";

import { useCallback, useMemo, useState } from "react";
import type { GuideDay, GuideStop } from "@/lib/itinerary";
// Type-only, so nothing from the service (mongoose, the model registry) is
// pulled into the client bundle — the import statement is erased outright.
import type { EditableGuide } from "@/services/guides";

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
  /**
   * Already stored in R2 — `usePublishGuide` sends this straight through
   * instead of re-uploading.
   *
   * Only ever set by the edit seed below, where `src` is that same public URL
   * rather than a `data:` string. Re-PUTting bytes that haven't changed would
   * make every save of a photo-heavy guide as slow as its first publish, and
   * would orphan a new object in the bucket on each one. A photo the author
   * swaps in during the edit comes from `newPhoto`, which leaves this unset, so
   * it uploads the normal way.
   */
  uploadedUrl?: string;
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

/**
 * Ids for the rows of a saved guide loaded into the editor
 * (`/guides/guide/[guideId]/edit`).
 *
 * Positional and deterministic for exactly the reason the two literals above
 * are literals: these ids reach the DOM as `id` attributes (`edit-day-<id>`,
 * `stop-<id>-name`, …), the seed runs during SSR *and* again during hydration,
 * and `crypto.randomUUID()` would mint a different set each time — a guaranteed
 * mismatch on a page that can have thirty of them.
 *
 * Position is a safe basis *because* it is only ever read once, at seed time.
 * Every later reorder or removal moves the object — id and all — around inside
 * the array rather than recomputing anything, so `day-3` still identifying a
 * day that is now second is correct, not stale. That is the whole point of
 * these ids existing separately from the index.
 */
const seededDayId = (dayIndex: number) => `day-${dayIndex}`;
const seededStopId = (dayIndex: number, stopIndex: number) =>
  `${seededDayId(dayIndex)}-stop-${stopIndex}`;

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

/**
 * A photo that already lives in R2 — the cover and per-stop photos of a guide
 * being edited.
 *
 * `src` and `uploadedUrl` are the same absolute URL on purpose: `src` is what
 * the thumbnails and the preview hero render (a normal remote image here, not a
 * data URL), and `uploadedUrl` is the marker that keeps `usePublishGuide` from
 * uploading it again. `id` is derived from the row's own seeded id rather than
 * minted, for the hydration reason above.
 */
function hostedPhoto(id: string, url: string): DraftPhoto {
  return { id, src: url, uploadedUrl: url };
}

function seedDay(): DraftDay {
  return {
    id: SEED_DAY_ID,
    title: "Day 1",
    summary: "",
    stops: [newStop(SEED_STOP_ID, WORLD_CENTER)],
  };
}

/**
 * Turns a saved guide's days into editable ones.
 *
 * Every seeded stop is `placed: true`: it carries the coordinates its author
 * actually chose on the map, and `placed` exists only to catch a stop that has
 * *never* been put on one (see `DraftStop`). Marking these unplaced would make
 * `usePublishGuide` refuse to save an untouched guide.
 *
 * `photoUrl` is peeled off rather than spread through — it is the persisted
 * shape's field (`IGuideStop.photoUrl`), and the editor holds a photo as a
 * `DraftPhoto` on `photo` instead, the same as a freshly picked one.
 */
function seedDaysFrom(initial: EditableGuide): DraftDay[] {
  return initial.days.map((day, dayIndex) => ({
    id: seededDayId(dayIndex),
    title: day.title,
    summary: day.summary,
    stops: day.stops.map((stop, stopIndex) => {
      const id = seededStopId(dayIndex, stopIndex);
      const { photoUrl, ...rest } = stop;
      return {
        ...rest,
        id,
        placed: true,
        photo: photoUrl ? hostedPhoto(`${id}-photo`, photoUrl) : null,
      };
    }),
  }));
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
 * context. Editing state itself is **in-memory only** — there is no
 * autosave and no local persistence anywhere in this codebase, so a reload
 * throws away whatever hasn't been sent to `POST`/`PATCH /api/guides` yet.
 *
 * `initial` is what makes the one editor serve two routes. Omitted
 * (`/create-guide`) it starts the blank draft it always has: one empty day with
 * one unplaced stop, open. Supplied (`/guides/guide/[guideId]/edit`,
 * which loads it through `getGuideForAuthor`) every field starts from the saved
 * guide instead — but only *once*: these are `useState` initialisers, so a later
 * change to `initial` deliberately does not clobber what the author has typed
 * since. Re-seeding is a remount, not a prop change.
 */
export function useCreateGuideForm(
  initial?: EditableGuide,
): CreateGuideFormState {
  const [heroTitle, setHeroTitle] = useState(initial?.heroTitle ?? "");
  const [heroAccent, setHeroAccent] = useState(initial?.heroAccent ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  // `||` rather than `??`: a guide saved as a draft can genuinely hold `""`
  // here (`Guide.ts` only requires the field once published), and the editor's
  // resting default is a euro sign, not an empty currency field.
  const [currency, setCurrency] = useState(initial?.currency || "€");
  const [bestTime, setBestTime] = useState(initial?.bestTime ?? "");
  const [coverImage, setCoverImageState] = useState<DraftPhoto | null>(() =>
    initial?.coverImageUrl ? hostedPhoto("cover", initial.coverImageUrl) : null,
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [generalTips, setGeneralTips] = useState<string[]>(
    initial?.generalTips ?? [],
  );
  const [days, setDays] = useState<DraftDay[]>(() =>
    initial ? seedDaysFrom(initial) : [seedDay()],
  );
  // The first day, open, in both modes. `days` is already this render's value,
  // so a seeded guide opens its own day 1 rather than a literal that doesn't
  // exist in it; the fallback only matters for the (API-only) case of a saved
  // guide with no days at all, where nothing is open until one is added.
  const [openDays, setOpenDays] = useState<ReadonlySet<string>>(
    () => new Set([days[0]?.id ?? SEED_DAY_ID]),
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
