import { Types } from "mongoose";

import { connectDB } from "@/lib/mongodb";
import Guide, { type IStopTransfer } from "@/models/Guide";
// Side-effect import, and load-bearing: `.populate("author")` below resolves
// `Guide.author`'s `ref: "User"` through mongoose's model registry, and a model
// only lands in that registry when its module is evaluated. Without this the
// populate throws `MissingSchemaError: Schema hasn't been registered for model
// "User"`. It currently *appears* to work in the app without it only because
// `SiteNav`'s `NavAccount` calls `auth()`, and `lib/auth.ts` imports `User` —
// an accidental dependency on unrelated render order that would break the feed
// the moment that changed. Registering it here makes this module self-contained.
import "@/models/User";
import type { DestinationGuide } from "@/lib/destinationGuides";
import type { GuideItinerary } from "@/lib/guideItineraries";
import type { GuideDay, GuideStop } from "@/lib/itinerary";
import type { DestinationImage, StopImagePair } from "@/lib/unsplash";

/**
 * The read side of the `guides` collection — the Mongo counterpart of the
 * hardcoded `destinationGuides.ts` + `guideItineraries.ts` modules `/destinations`
 * used to read from directly. This is the **only** module that talks to the
 * collection; everything downstream (`/destinations`, the guide detail route)
 * gets plain `DestinationGuide`/`GuideItinerary` view objects and never sees a
 * mongoose document, an `ObjectId`, or a `Date`.
 *
 * Every exported function returns plain, JSON-serializable data on purpose —
 * these cross into client components as props (`DestinationsExplorer`,
 * `ItineraryDetailView`), and a mongoose document or an `ObjectId` surviving
 * that boundary is a runtime error, not a type error.
 */

interface LeanAuthor {
  _id: Types.ObjectId;
  username: string;
}

interface LeanGuideStop {
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  notes: string[];
  about?: string;
  address?: string;
  priceLevel?: number;
  transfer?: IStopTransfer;
  highlight?: boolean;
  photoUrl?: string;
}

interface LeanGuideDay {
  title: string;
  summary: string;
  stops: LeanGuideStop[];
}

/**
 * The shape a published `Guide` document takes after `.populate("author")` +
 * `.lean()`. Intentionally hand-written rather than derived from `IGuide`:
 * `IGuide` is a mongoose `Document` (methods, subdocument `_id`s, etc.), and
 * fighting mongoose's generic `Lean<...>` inference to reproduce this exact,
 * narrower shape isn't worth it when the fields are this easy to name
 * directly. This type never leaves the module.
 */
interface LeanPublishedGuide {
  slug: string;
  title: string;
  heroTitle: string;
  heroAccent: string;
  blurb: string;
  intro: string;
  tags: string[];
  generalTips: string[];
  currency: string;
  bestTime: string;
  coverImageUrl: string;
  author: LeanAuthor | null;
  days: LeanGuideDay[];
  publishedAt?: Date | null;
  verified: boolean;
  likes: number;
  views: number;
  place?: string;
  approxCostEUR?: number;
  dayCount: number;
  createdAt: Date;
  _id: Types.ObjectId;
}

/**
 * Shown in place of a username when a guide's `author` reference doesn't
 * resolve (populate returns `null` for a deleted/missing user). Not expected
 * in normal operation — `POST /api/guides` always stamps the signed-in
 * user's id — but the feed has to render *something* rather than crash.
 */
const FALLBACK_AUTHOR_NAME = "Traveler";

const PUBLISHED_AT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  // Fixed, not the server's local zone: this string is computed once at
  // render time and handed down as a plain prop (there is no client-side
  // recompute to mismatch against), but pinning the zone still keeps the
  // value identical across regions/instances instead of drifting with
  // wherever the request happened to be served from.
  timeZone: "UTC",
});

/**
 * `publishedAt` is nullable in the schema even though `POST /api/guides`
 * always sets it for `status: "published"` (see `Guide.ts`) — this stays
 * defensive rather than assuming every document in the collection went
 * through that route. Falls back to `createdAt`, which is never null.
 */
function formatPublishedAt(
  doc: Pick<LeanPublishedGuide, "publishedAt" | "createdAt">,
): string {
  return PUBLISHED_AT_FORMATTER.format(doc.publishedAt ?? doc.createdAt);
}

/**
 * Deterministic per-author avatar gradient — Mongo has no author photo field,
 * so this is the live counterpart of `destinationGuides.ts`'s hand-picked
 * `linear-gradient(150deg,<light>,<dark>)` values. Hashing the author's own
 * id (not the guide's) means every guide by the same person gets the same
 * gradient, matching how a real avatar would behave.
 *
 * Falls back to hashing `guide:<guideId>` when the author reference doesn't
 * resolve (see `FALLBACK_AUTHOR_NAME`) — the original author id is gone by
 * then (populate already collapsed it to `null`), so this is the closest
 * deterministic seed still available. It means two guides by the same
 * vanished author get different gradients, which is an acceptable edge case
 * for a state that shouldn't occur in normal operation.
 */
function avatarGradientSeed(
  guideId: Types.ObjectId,
  author: LeanAuthor | null,
): string {
  return author ? author._id.toString() : `guide:${guideId.toString()}`;
}

/** FNV-1a-ish string hash — small, dependency-free, and stable across runs
 *  (unlike `Array.prototype.sort`'s engine-dependent ordering, this doesn't
 *  rely on anything the runtime could change). */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Every hand-picked gradient in `destinationGuides.ts` is the same recipe: a
 * lighter tone at ~55-65% lightness paired with a darker one at ~30-40%,
 * both roughly the same hue, on a 150deg diagonal. This reproduces that
 * recipe from a hash of `seed` instead of picking the pair by eye.
 */
function deriveAvatarGradient(seed: string): string {
  const hue = hashString(seed) % 360;
  const light = hslToHex(hue, 46, 63);
  const dark = hslToHex(hue, 47, 33);
  return `linear-gradient(150deg,${light},${dark})`;
}

/**
 * `DestinationGuide.place` is required and doubles as the cover thumbnail's
 * accessible description (`GuideCard`) and the hero image's `alt`
 * (`GuideDetailView`/`ItineraryDetailView`). `useCreateGuideForm` never
 * collects it — same gap as `approxCostEUR`, see `IGuide.place`'s doc
 * comment — so a guide published through `/create-guide` has none. Falling
 * back to the guide's own title keeps the alt text meaningful instead of
 * inventing a location that was never entered.
 */
function resolvePlace(
  doc: Pick<LeanPublishedGuide, "place" | "title">,
): string {
  const place = doc.place?.trim();
  return place ? place : doc.title;
}

/**
 * A guide's cost per travel day above which the hardcoded guides' `meta`
 * strings double the currency symbol ("€€" vs "€") rather than repeat it
 * once — see the extended derivation note on `formatMeta`.
 */
const DOUBLED_SYMBOL_DAILY_COST_EUR = 150;

/**
 * Derives the feed thumbnail's `"7 days · ¥¥"` pill.
 *
 * The hardcoded guides don't follow one clean rule — Switzerland's "CHF" and
 * Iceland's "kr" never double no matter the cost, while Kyoto's "¥" and
 * Paris's "€" double once the trip reads as pricier per day — but the
 * closest approximation across all nineteen is: a single-character currency
 * symbol doubles once the guide's cost-per-day clears
 * `DOUBLED_SYMBOL_DAILY_COST_EUR`; a multi-character currency code (`"CHF"`,
 * `"kr"`, `"S/"`, …) never doubles, and neither does a guide with no
 * disclosed cost (nothing to base a tier on). This is a stated approximation
 * of hand-authored copy, not a reproduction of it — one hardcoded guide
 * (Cape Town, single-char "R" above the threshold) doesn't fit even this
 * rule, which is fine: `meta` is now computed at read time, not stored, so
 * it no longer has to match the original copy exactly.
 */
function formatMeta(
  dayCount: number,
  currency: string,
  approxCostEUR: number | undefined,
): string {
  const dayLabel = `${dayCount} ${dayCount === 1 ? "day" : "days"}`;
  const costPerDay =
    approxCostEUR === undefined
      ? undefined
      : approxCostEUR / Math.max(dayCount, 1);
  const doubled =
    costPerDay !== undefined &&
    currency.length === 1 &&
    costPerDay >= DOUBLED_SYMBOL_DAILY_COST_EUR;
  return `${dayLabel} · ${doubled ? currency.repeat(2) : currency}`;
}

function toDestinationGuide(doc: LeanPublishedGuide): DestinationGuide {
  const approxCostEUR = doc.approxCostEUR;

  return {
    slug: doc.slug,
    title: doc.title,
    blurb: doc.blurb,
    author: doc.author?.username ?? FALLBACK_AUTHOR_NAME,
    avatarGradient: deriveAvatarGradient(
      avatarGradientSeed(doc._id, doc.author),
    ),
    likes: doc.likes,
    views: doc.views,
    days: doc.dayCount,
    approxCostEUR,
    meta: formatMeta(doc.dayCount, doc.currency, approxCostEUR),
    place: resolvePlace(doc),
    coverImage: doc.coverImageUrl,
    verified: doc.verified,
  };
}

function toGuideStop(stop: LeanGuideStop): GuideStop {
  return {
    name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
    tags: stop.tags,
    notes: stop.notes,
    about: stop.about,
    address: stop.address,
    priceLevel: stop.priceLevel,
    transfer: stop.transfer,
    highlight: stop.highlight,
  };
}

function toGuideDay(day: LeanGuideDay): GuideDay {
  return {
    title: day.title,
    summary: day.summary,
    stops: day.stops.map(toGuideStop),
  };
}

function toGuideItinerary(doc: LeanPublishedGuide): GuideItinerary {
  return {
    slug: doc.slug,
    heroTitle: doc.heroTitle,
    heroAccent: doc.heroAccent,
    publishedAt: formatPublishedAt(doc),
    tags: doc.tags,
    intro: doc.intro,
    bestTime: doc.bestTime,
    currency: doc.currency,
    generalTips: doc.generalTips,
    days: doc.days.map(toGuideDay),
  };
}

/**
 * Builds `ItineraryDetailView`'s `stopImages` prop straight from each stop's
 * stored `photoUrl` — no Unsplash call, so none of the rate-limit concerns
 * that keep `GuideDetailView` passing an empty map today apply here. Keyed
 * `"<dayIndex>-<stopIndex>"`, exactly like `DaySection`/`useGuideDetail`
 * already key every other per-stop lookup.
 *
 * A stop with no stored `photoUrl` is simply absent from the map (not a
 * `null`-valued entry) — `StopThumb` already renders its gradient
 * placeholder for a missing key, which is the routine case for anything
 * published before per-stop uploads existed, or by an author who skipped
 * them.
 *
 * Unlike `resolveStopImages` (`src/lib/unsplash.ts`), which resolves two
 * genuinely different photos per stop (`thumb` for the row, a different
 * `about` photo for the detail card), a guide stop only ever has the one
 * uploaded `photoUrl` — reused for both slots rather than leaving `about`
 * `null` and showing an inconsistent detail card next to a photographed row.
 */
function toStopImages(doc: LeanPublishedGuide): Record<string, StopImagePair> {
  const stopImages: Record<string, StopImagePair> = {};

  doc.days.forEach((day, dayIndex) => {
    day.stops.forEach((stop, stopIndex) => {
      if (!stop.photoUrl) return;

      const image: DestinationImage = {
        url: stop.photoUrl,
        alt: stop.name || "Stop photo",
        // Not an Unsplash photo, so there is no photographer to credit —
        // every consumer of `DestinationImage` already treats these three as
        // optional-for-display (see `PhotoCredit`/`StopDetailCard`).
        photographer: null,
        photographerUrl: null,
        unsplashUrl: null,
      };

      stopImages[`${dayIndex}-${stopIndex}`] = { thumb: image, about: image };
    });
  });

  return stopImages;
}

/**
 * The `/destinations` feed. Sorted newest-first — the "recent" tab's default
 * order, matching `Guide.ts`'s `{ status: 1, createdAt: -1 }` index. Every
 * other tab (loved/budget/weekends) still filters/sorts this same array
 * client-side in `useDestinationsExplorer`, unchanged.
 */
export async function listPublishedGuides(): Promise<DestinationGuide[]> {
  await connectDB();

  const docs = await Guide.find({ status: "published" })
    .sort({ createdAt: -1 })
    .populate({ path: "author", select: "username" })
    .lean<LeanPublishedGuide[]>();

  return docs.map(toDestinationGuide);
}

export interface PublishedGuideDetail {
  guide: DestinationGuide;
  itinerary: GuideItinerary;
  /** See `toStopImages` — resolved from each stop's stored `photoUrl`, not
   *  Unsplash. Extends the `{ guide, itinerary }` pair the hardcoded
   *  `getGuideDetail` returned, rather than making the detail route
   *  re-derive this separately (it would need the same raw `photoUrl` data
   *  this service already has and the view types deliberately don't carry). */
  stopImages: Record<string, StopImagePair>;
}

/** One published guide by slug, or `null` if it doesn't exist / isn't
 *  published — a draft is invisible to this lookup on purpose, the same way
 *  it's invisible to the feed above. */
export async function getPublishedGuideDetail(
  slug: string,
): Promise<PublishedGuideDetail | null> {
  await connectDB();

  const doc = await Guide.findOne({ slug, status: "published" })
    .populate({ path: "author", select: "username" })
    .lean<LeanPublishedGuide | null>();

  if (!doc) return null;

  return {
    guide: toDestinationGuide(doc),
    itinerary: toGuideItinerary(doc),
    stopImages: toStopImages(doc),
  };
}
