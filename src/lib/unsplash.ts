/**
 * Live Unsplash lookups: one hero photo per plan/guide, and — as of the
 * per-stop photo feature — up to two photos per itinerary stop.
 *
 * Server-only — reads `UNSPLASH_ACCESS_KEY` and calls Unsplash's Search API.
 * Never import this from a client component.
 *
 * Mirrors the attribution Unsplash's API guidelines require for the Search
 * endpoint: https://help.unsplash.com/en/articles/2511315
 *   - Show the photographer's name, linking back to their Unsplash profile.
 *   - Link the photo back to its Unsplash page.
 *   - Both links carry `utm_source`/`utm_medium` so Unsplash can attribute the
 *     referral.
 *   - Trigger the photo's `download_location` endpoint when we "use" it (i.e.
 *     pick it for the hero) — required by the "Hotlinking" / triggering a
 *     download section of the API guidelines, fire-and-forget so it never
 *     blocks the page.
 *
 * Rate budget: the free tier is 50 requests/hour. The guide corpus alone is
 * ~300 stops (`src/lib/guideItineraries.ts`), so per-stop lookups are only
 * viable with aggressive caching (`unstable_cache`, long revalidate) and a
 * `per_page=2` trick that gets both a stop's photos in one call instead of
 * two. See `getStopImages`/`resolveStopImages` below.
 *
 * Caching rule that makes this safe (see `fetchStopImagesUncached`): the
 * function wrapped by `unstable_cache` *throws* on a transient failure
 * (network error, timeout, non-2xx — including a 429/403 rate-limit
 * response) and only *returns* when Unsplash genuinely answered, even if
 * that answer is "no results". `unstable_cache` only persists a function's
 * return value, never a thrown error, so a throw is retried on the very next
 * request while a real "nothing found" is cached for weeks. Getting this
 * backwards would mean one quota blip permanently freezes a stop's photos to
 * placeholders.
 */

import { unstable_cache } from "next/cache";
import type { GuideDay } from "@/lib/itinerary";

/**
 * A photo resolved from the Unsplash Search API, plus the attribution their
 * API terms require us to display. Everything but `url`/`alt` is nullable —
 * the static hero fallback used when the API is unavailable has no
 * photographer to credit, and a per-stop lookup that found nothing returns
 * `null` outright rather than this shape (see `StopImagePair`).
 */
export interface DestinationImage {
  /** Ready to hand to `next/image` — sized and cropped via Unsplash's URL params. */
  url: string;
  /** Alt text; the photo's own description when Unsplash gave us one. */
  alt: string;
  /** Photographer's display name, e.g. "Jane Doe". */
  photographer: string | null;
  /** Their Unsplash profile URL, with our UTM params appended. */
  photographerUrl: string | null;
  /** The photo's page on Unsplash, with our UTM params appended. */
  unsplashUrl: string | null;
}

/**
 * The two photos resolved for one itinerary stop: `thumb` for the stop row's
 * `StopThumb`, `about` — a genuinely different photo, never `thumb` reused —
 * for the larger image in the stop detail card's About tab. Either or both
 * are `null` when Unsplash had nothing (or only one result, or the call
 * failed); callers fall back to `StopThumb`'s existing gradient placeholder
 * per slot, independently. Never the static `FALLBACK_IMAGE` below — that
 * single photo repeated across dozens of stops on one page would look like a
 * bug, not a fallback.
 */
export interface StopImagePair {
  thumb: DestinationImage | null;
  about: DestinationImage | null;
}

const UNSPLASH_API_BASE = "https://api.unsplash.com";
const UTM_PARAMS = "utm_source=travel_planner&utm_medium=referral";
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Static fallback used whenever Unsplash is unavailable (no key, network
 * failure, non-2xx, empty results). Same photo id already relied on
 * elsewhere in the app (`destinationGuides.ts`'s Kyoto cover) so it's a known
 * good, high-quality landscape photo — sized here for a full-width hero.
 */
const FALLBACK_IMAGE: DestinationImage = {
  url: "https://images.unsplash.com/photo-1558870832-c8db4b5b47d1?w=1600&q=80&auto=format&fit=crop",
  alt: "Travel photography",
  photographer: null,
  photographerUrl: null,
  unsplashUrl: null,
};

interface UnsplashUser {
  name?: string;
  links?: { html?: string };
}

interface UnsplashPhoto {
  urls?: { raw?: string };
  alt_description?: string | null;
  description?: string | null;
  user?: UnsplashUser;
  links?: { html?: string; download_location?: string };
}

interface UnsplashSearchResponse {
  results?: UnsplashPhoto[];
}

function withUtm(url: string): string {
  return url.includes("?") ? `${url}&${UTM_PARAMS}` : `${url}?${UTM_PARAMS}`;
}

/**
 * Fires Unsplash's required download-tracking ping. Deliberately
 * fire-and-forget: failures here must never affect the page render, so
 * errors are swallowed after a warning.
 */
function trackDownload(downloadLocation: string | undefined, apiKey: string) {
  if (!downloadLocation) return;
  fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${apiKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((err) => {
    console.warn("[unsplash] download-tracking ping failed:", err);
  });
}

/**
 * Looks up a live hero photo for `destination` on Unsplash. Never throws —
 * any failure resolves to a static fallback image so `/plan` always renders.
 */
export async function getDestinationImage(
  destination: string,
): Promise<DestinationImage> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    console.warn(
      "[unsplash] UNSPLASH_ACCESS_KEY is not set, using fallback hero image.",
    );
    return FALLBACK_IMAGE;
  }

  const query = `${destination} travel`;
  const url = `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(
    query,
  )}&orientation=landscape&content_filter=high&per_page=5`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[unsplash] search request failed, using fallback:", err);
    return FALLBACK_IMAGE;
  }

  if (!res.ok) {
    console.warn(
      `[unsplash] search request failed (${res.status}), using fallback.`,
    );
    return FALLBACK_IMAGE;
  }

  let data: UnsplashSearchResponse;
  try {
    data = (await res.json()) as UnsplashSearchResponse;
  } catch (err) {
    console.warn("[unsplash] could not parse search response:", err);
    return FALLBACK_IMAGE;
  }

  const photo = data.results?.[0];
  const rawUrl = photo?.urls?.raw;
  if (!photo || !rawUrl) {
    console.warn(`[unsplash] no results for "${query}", using fallback image.`);
    return FALLBACK_IMAGE;
  }

  trackDownload(photo.links?.download_location, apiKey);

  const photographerName = photo.user?.name?.trim() || null;
  const photographerProfile = photo.user?.links?.html;
  const photoPage = photo.links?.html;

  return {
    url: `${rawUrl}&w=1600&q=80&auto=format&fit=crop`,
    alt:
      photo.alt_description?.trim() ||
      photo.description?.trim() ||
      `${destination} travel photography`,
    photographer: photographerName,
    photographerUrl: photographerProfile ? withUtm(photographerProfile) : null,
    unsplashUrl: photoPage ? withUtm(photoPage) : null,
  };
}

// ---------------------------------------------------------------------------
// Per-stop photos (`getStopImages` / `resolveStopImages`)
// ---------------------------------------------------------------------------

/**
 * How long a resolved stop-photo pair stays cached before Next revalidates it
 * in the background. Stop photography is effectively static — a landmark's
 * name and appearance don't change week to week — so this is set to 30 days
 * rather than anything tuned for freshness. Only reachable for a *successful*
 * Unsplash answer; see the module doc comment for why failures never hit this
 * path at all.
 */
const STOP_IMAGE_REVALIDATE_SECONDS = 60 * 60 * 24 * 30;

/** Concurrency cap for resolving a whole itinerary's stops at once. Matches
 *  the free-tier's need to not burst the full 50 req/hour budget in one
 *  page render, while still resolving a 15–30 stop guide in a handful of
 *  round trips rather than one-at-a-time. */
const STOP_IMAGE_CONCURRENCY = 8;

let warnedMissingKeyForStops = false;

/** Same "no key configured" story as `getDestinationImage`, but logged once
 *  per process rather than once per stop — `resolveStopImages` can be asked
 *  about dozens of stops in a single call, and a per-stop warning would just
 *  be log spam once the first one has said everything there is to say. */
function warnMissingKeyForStopsOnce() {
  if (warnedMissingKeyForStops) return;
  warnedMissingKeyForStops = true;
  console.warn(
    "[unsplash] UNSPLASH_ACCESS_KEY is not set, skipping per-stop photo lookups.",
  );
}

/**
 * One resolved photo plus its `download_location` — kept internal to this
 * module (never returned to callers) because the ping has to fire on *every*
 * display of the photo, cache hit or not, per Unsplash's API guidelines. The
 * public `DestinationImage` shape has no room for it, so `getStopImages`
 * strips it off after triggering the ping.
 */
interface StopPhotoResult {
  /** The Unsplash `raw` URL, un-sized — sizing is applied per slot (thumb vs.
   *  about) when converting to the public `DestinationImage`. */
  rawUrl: string;
  alt: string;
  photographer: string | null;
  photographerUrl: string | null;
  unsplashUrl: string | null;
  downloadLocation: string | null;
}

interface StopPhotoFetchResult {
  thumb: StopPhotoResult | null;
  about: StopPhotoResult | null;
}

function toStopPhotoResult(
  photo: UnsplashPhoto | undefined,
  altFallback: string,
): StopPhotoResult | null {
  const rawUrl = photo?.urls?.raw;
  if (!photo || !rawUrl) return null;

  const photographerName = photo.user?.name?.trim() || null;
  const photographerProfile = photo.user?.links?.html;
  const photoPage = photo.links?.html;

  return {
    rawUrl,
    alt:
      photo.alt_description?.trim() || photo.description?.trim() || altFallback,
    photographer: photographerName,
    photographerUrl: photographerProfile ? withUtm(photographerProfile) : null,
    unsplashUrl: photoPage ? withUtm(photoPage) : null,
    downloadLocation: photo.links?.download_location ?? null,
  };
}

/**
 * The function `unstable_cache` wraps for one stop. This is the load-bearing
 * boundary described in the module doc comment: it *throws* on anything
 * transient (network failure, timeout, non-2xx — a 429/403 rate-limit
 * response included) so `unstable_cache` never persists that outcome, and it
 * only *returns* — `results[0]`/`results[1]` mapped to `thumb`/`about`, either
 * possibly `null` — once Unsplash has genuinely answered, including a genuine
 * zero-result answer. That return value, and only that one, is what gets
 * cached for `STOP_IMAGE_REVALIDATE_SECONDS`.
 *
 * `per_page=2` gets both a stop's photos in the single request instead of
 * two — `about` is simply never a duplicate of `thumb`; if Unsplash only had
 * one match, `about` is `null`.
 */
async function fetchStopImagesUncached(
  placeName: string,
  destination: string,
  apiKey: string,
): Promise<StopPhotoFetchResult> {
  const query = `${placeName} ${destination}`;
  const url = `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(
    query,
  )}&orientation=landscape&content_filter=high&per_page=2`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    // Transient (network error, timeout): throw so unstable_cache never
    // persists this outcome — the very next request retries it for real.
    throw new Error(
      `[unsplash] stop-image request failed for "${query}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    // Also transient by definition here — a 429/403 rate-limit response is
    // exactly the case that must never freeze into a cached null. Throw.
    throw new Error(
      `[unsplash] stop-image request failed for "${query}" (${res.status})`,
    );
  }

  let data: UnsplashSearchResponse;
  try {
    data = (await res.json()) as UnsplashSearchResponse;
  } catch (err) {
    throw new Error(
      `[unsplash] could not parse stop-image response for "${query}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Unsplash answered. Whether it found two, one, or zero results, this is a
  // stable fact worth caching — return (not throw) from here on.
  const results = data.results ?? [];
  return {
    thumb: toStopPhotoResult(results[0], placeName),
    about: toStopPhotoResult(results[1], placeName),
  };
}

function toDisplayImage(
  photo: StopPhotoResult | null,
  width: number,
): DestinationImage | null {
  if (!photo) return null;
  return {
    url: `${photo.rawUrl}&w=${width}&q=80&auto=format&fit=crop`,
    alt: photo.alt,
    photographer: photo.photographer,
    photographerUrl: photo.photographerUrl,
    unsplashUrl: photo.unsplashUrl,
  };
}

/**
 * Resolves both photos for one itinerary stop: `thumb` (small, for
 * `StopThumb`) and `about` (larger, for the stop detail card's About tab) —
 * genuinely different photos, never the same one twice. Never throws to its
 * caller: a failed or uncached-and-erroring lookup resolves to
 * `{ thumb: null, about: null }` so the UI's existing placeholder is the
 * fallback, exactly like a stop Unsplash has no photos for at all. The
 * difference is invisible to callers and deliberate — see the module doc
 * comment for why that failure case must stay uncached while a genuine
 * "nothing found" gets cached for weeks.
 */
export async function getStopImages(
  placeName: string,
  destination: string,
): Promise<StopImagePair> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    warnMissingKeyForStopsOnce();
    return { thumb: null, about: null };
  }

  const getCached = unstable_cache(
    (name: string, place: string) =>
      fetchStopImagesUncached(name, place, apiKey),
    ["stop-image", destination, placeName],
    { revalidate: STOP_IMAGE_REVALIDATE_SECONDS },
  );

  let result: StopPhotoFetchResult;
  try {
    result = await getCached(placeName, destination);
  } catch (err) {
    console.warn(
      `[unsplash] stop-image lookup failed for "${placeName}, ${destination}", leaving uncached for retry:`,
      err,
    );
    return { thumb: null, about: null };
  }

  // Fire the required download-tracking ping for both photos actually
  // displayed, on every call — cache hit or not — not just the first fetch.
  if (result.thumb)
    trackDownload(result.thumb.downloadLocation ?? undefined, apiKey);
  if (result.about)
    trackDownload(result.about.downloadLocation ?? undefined, apiKey);

  return {
    thumb: toDisplayImage(result.thumb, 480),
    about: toDisplayImage(result.about, 1400),
  };
}

/** Runs `task` over `items` with at most `limit` in flight at once. A small
 *  worker-pool: each of `limit` workers pulls the next item off a shared
 *  cursor until the list is drained, rather than chunking into fixed-size
 *  batches (which stalls a whole batch on its slowest request). No new
 *  dependency — this is the entire concurrency cap `resolveStopImages`
 *  needs. */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Resolves every stop's photo pair across a whole itinerary, keyed exactly
 * `` `${dayIndex}-${stopIndex}` `` — the same format `useGuideDetail.ts`'s
 * `ShownStop.key` uses, so the frontend can look an entry up directly by that
 * key with no reshaping.
 *
 * Identical `(placeName, destination)` pairs within the itinerary are
 * deduped (an itinerary rarely repeats a stop name, but it's cheap
 * insurance), and unique stops are resolved with a concurrency cap of
 * `STOP_IMAGE_CONCURRENCY` rather than all at once, to stay inside
 * Unsplash's free-tier rate limit on a 15–30 stop guide page.
 */
export async function resolveStopImages(
  days: GuideDay[],
  destination: string,
): Promise<Record<string, StopImagePair>> {
  const entries = days.flatMap((day, dayIndex) =>
    day.stops.map((stop, stopIndex) => ({
      key: `${dayIndex}-${stopIndex}`,
      placeName: stop.name,
    })),
  );

  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    warnMissingKeyForStopsOnce();
    const empty: StopImagePair = { thumb: null, about: null };
    return Object.fromEntries(entries.map((entry) => [entry.key, empty]));
  }

  const uniquePlaceNames = Array.from(
    new Set(entries.map((entry) => entry.placeName)),
  );
  const resultsByPlaceName = new Map<string, StopImagePair>();

  await runWithConcurrency(
    uniquePlaceNames,
    STOP_IMAGE_CONCURRENCY,
    async (placeName) => {
      resultsByPlaceName.set(
        placeName,
        await getStopImages(placeName, destination),
      );
    },
  );

  const fallback: StopImagePair = { thumb: null, about: null };
  const out: Record<string, StopImagePair> = {};
  for (const entry of entries) {
    out[entry.key] = resultsByPlaceName.get(entry.placeName) ?? fallback;
  }
  return out;
}
