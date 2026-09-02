import { Types } from "mongoose";

import { connectDB } from "@/lib/mongodb";
import Guide, { type GuideStatus, type IStopTransfer } from "@/models/Guide";
// Side-effect import, and load-bearing: `.populate("author")` below resolves
// `Guide.author`'s `ref: "User"` through mongoose's model registry, and a model
// only lands in that registry when its module is evaluated. Without this the
// populate throws `MissingSchemaError: Schema hasn't been registered for model
// "User"`. It currently *appears* to work in the app without it only because
// `SiteNav`'s `NavAccount` calls `auth()`, and `lib/auth.ts` imports `User` —
// an accidental dependency on unrelated render order that would break the feed
// the moment that changed. Registering it here makes this module self-contained.
import "@/models/User";
import Like from "@/models/Like";
import Comment from "@/models/Comment";
import type { DestinationGuide } from "@/lib/destinationGuides";
import type { GuideItinerary } from "@/lib/guideItineraries";
import type { GuideDay, GuideStop, TransferMode } from "@/lib/itinerary";
import type { DestinationImage, StopImagePair } from "@/lib/unsplash";

/**
 * Re-exported so a caller of `getGuideForAuthor` can name the `status` it gets
 * back without importing `@/models/Guide` (and, with it, mongoose) just for a
 * two-member string union.
 */
export type { GuideStatus } from "@/models/Guide";

/**
 * The read side of the `guides` collection — the Mongo counterpart of the
 * hardcoded `destinationGuides.ts` + `guideItineraries.ts` modules `/guides`
 * used to read from directly. This is the **only** module that talks to the
 * collection; everything downstream (`/guides`, the guide detail route)
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
 * The `/guides` feed. Sorted newest-first — the "recent" tab's default
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
  /**
   * The author's user id as a plain string — `null` when the author reference
   * doesn't resolve (a deleted user; see `FALLBACK_AUTHOR_NAME`).
   *
   * Compared against `session.user.id` by the detail page to decide whether to
   * render the owner's Edit/Delete controls. It is *only* a rendering hint:
   * hiding a button is not authorization, and both mutating endpoints
   * (`PATCH`/`DELETE /api/guides/[guideId]`) re-check ownership against the
   * database themselves.
   *
   * Deliberately not folded into `DestinationGuide` — that view type is the
   * feed card's shape and is spread into client components wholesale; a raw
   * user id belongs to the detail page's ownership check, not to every card.
   */
  authorId: string | null;
  /**
   * The guide's live like count, sourced from the `Like` collection
   * (`src/models/Like.ts`) — one document per guide, `users.length` is the
   * count — rather than the older, denormalized `Guide.likes` counter.
   * `Guide.likes` is left untouched here and still backs the feed's sort and
   * "Loved" tab; this is a separately-read, up-to-date figure for the detail
   * page. `0` when the guide has never been liked (no `Like` document at all).
   */
  likeCount: number;
  /**
   * The raw list of user ids (as strings) who liked the guide, sourced from
   * the same `Like` document `likeCount` above already reads — no second
   * query. Analogous to `authorId`: a raw id exposed so the *page* (not this
   * service) can compare it against the signed-in viewer's id without this
   * module knowing anything about sessions. Empty when the guide has never
   * been liked.
   */
  likedUserIds: string[];
  /**
   * The guide's total comment count, sourced from the `Comment` collection
   * (`src/models/Comment.ts`) — one document per comment, so this is a
   * `countDocuments` rather than a single document's field the way
   * `likeCount` reads `Like.users.length`. `0` when the guide has no
   * comments yet.
   */
  commentCount: number;
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

  // Two independent reads keyed off the same already-resolved `doc._id` —
  // neither depends on the other's result, so they run concurrently rather
  // than serialized one after the other (same convention as the page-level
  // `Promise.all([getPublishedGuideDetail(...), auth()])` one layer up).
  const [likeDoc, commentCount] = await Promise.all([
    Like.findOne({ guide: doc._id })
      .select("users")
      .lean<{ users: Types.ObjectId[] } | null>(),
    Comment.countDocuments({ guide: doc._id }),
  ]);

  return {
    guide: toDestinationGuide(doc),
    itinerary: toGuideItinerary(doc),
    stopImages: toStopImages(doc),
    // Straight off the already-populated author — no extra query. `.toString()`
    // is what keeps this side of the boundary JSON-serializable: an `ObjectId`
    // handed to a client component is a runtime error, not a type error.
    authorId: doc.author ? doc.author._id.toString() : null,
    likeCount: likeDoc?.users.length ?? 0,
    likedUserIds: likeDoc?.users.map((id) => id.toString()) ?? [],
    commentCount,
  };
}

// ---------------------------------------------------------------------------
// The editor's read path
//
// `getPublishedGuideDetail` above answers "what does a reader see". The types
// and function below answer "what does the author load back into
// `/create-guide`'s editor", which is a different question with a different
// shape: every field the form collects, at *any* status (an author edits their
// drafts too), and none of the derived/presentational values
// (`avatarGradient`, `meta`, the formatted `publishedAt`) the reader's view
// types carry.
// ---------------------------------------------------------------------------

export interface EditableGuideStop {
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  notes: string[];
  about?: string;
  address?: string;
  priceLevel?: number;
  transfer?: { mode: TransferMode; duration: string; distance: string };
  highlight?: boolean;
  /** The stored R2 public URL — what the editor shows in place of a freshly
   *  picked `data:` URL, and what `PATCH` will send straight back unchanged if
   *  the author doesn't replace the photo. */
  photoUrl?: string;
}

export interface EditableGuideDay {
  title: string;
  summary: string;
  stops: EditableGuideStop[];
}

/** One guide as its own author edits it — every field `/create-guide`'s editor
 *  collects, at any `status`, plus the identity the save endpoint needs. */
export interface EditableGuide {
  id: string;
  slug: string;
  status: GuideStatus;
  title: string;
  heroTitle: string;
  heroAccent: string;
  blurb: string;
  intro: string;
  tags: string[];
  generalTips: string[];
  currency: string;
  bestTime: string;
  /** `null` when the author never uploaded one (only possible on a draft —
   *  `publishGuideSchema` and `Guide.ts`'s `requiredWhenPublished` both make it
   *  mandatory to publish). */
  coverImageUrl: string | null;
  days: EditableGuideDay[];
}

/**
 * The shape an *editable* `Guide` document takes after `.lean()`. Separate
 * from `LeanPublishedGuide` rather than a widened version of it, for two
 * reasons: this read never populates the author (ownership is settled by the
 * query filter, so there is nothing to look up in `users`), and the content
 * fields `Guide.ts` marks `requiredWhenPublished` are genuinely optional here
 * because a draft is allowed to be missing them. Never leaves the module.
 */
interface LeanEditableGuide {
  _id: Types.ObjectId;
  slug: string;
  status: GuideStatus;
  title: string;
  heroTitle?: string;
  heroAccent?: string;
  blurb?: string;
  intro?: string;
  tags: string[];
  generalTips: string[];
  currency: string;
  bestTime?: string;
  coverImageUrl?: string;
  days: LeanGuideDay[];
}

function toEditableStop(stop: LeanGuideStop): EditableGuideStop {
  return {
    name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
    tags: stop.tags,
    notes: stop.notes,
    about: stop.about,
    address: stop.address,
    priceLevel: stop.priceLevel,
    // Rebuilt field by field rather than passed through: `transfer` is an
    // embedded subdocument, and spreading whatever `.lean()` handed back
    // would risk carrying a non-serializable extra across the client
    // boundary if the schema ever grows one.
    transfer: stop.transfer
      ? {
          mode: stop.transfer.mode,
          duration: stop.transfer.duration,
          distance: stop.transfer.distance,
        }
      : undefined,
    highlight: stop.highlight,
    photoUrl: stop.photoUrl,
  };
}

function toEditableDay(day: LeanGuideDay): EditableGuideDay {
  return {
    title: day.title,
    summary: day.summary,
    stops: day.stops.map(toEditableStop),
  };
}

/**
 * The guide `slug`, but only if `userId` is its author. Returns `null` for an
 * unknown slug **and** for a guide owned by someone else — the caller cannot
 * tell those apart, on purpose, so a 404 never leaks the existence of another
 * author's draft.
 *
 * Ownership is part of the query filter rather than a post-fetch comparison:
 * one indexed round trip, and there is no window in which a non-owner's guide
 * exists in memory to be accidentally returned.
 *
 * Unlike `getPublishedGuideDetail` this deliberately does **not** filter on
 * `status: "published"` — an author edits their drafts too, and a draft that
 * couldn't be reloaded would be unfinishable.
 */
export async function getGuideForAuthor(
  slug: string,
  userId: string,
): Promise<EditableGuide | null> {
  // A malformed id would make mongoose throw a `CastError` on the filter
  // rather than simply match nothing. Callers pass `session.user.id`, which is
  // always well-formed today, but a thrown 500 is the wrong answer to "is this
  // yours?" regardless — the honest answer for an id that can't own anything
  // is the same `null` a non-owner gets.
  if (!Types.ObjectId.isValid(userId)) return null;

  await connectDB();

  const doc = await Guide.findOne({
    slug,
    author: new Types.ObjectId(userId),
  }).lean<LeanEditableGuide | null>();

  if (!doc) return null;

  return {
    id: doc._id.toString(),
    slug: doc.slug,
    status: doc.status,
    title: doc.title,
    // `?? ""` across the `requiredWhenPublished` fields: absent on a draft, and
    // the editor's controls are all controlled inputs that need a string, not
    // `undefined` (which would flip them to uncontrolled mid-render).
    heroTitle: doc.heroTitle ?? "",
    heroAccent: doc.heroAccent ?? "",
    blurb: doc.blurb ?? "",
    intro: doc.intro ?? "",
    tags: doc.tags,
    generalTips: doc.generalTips,
    currency: doc.currency,
    bestTime: doc.bestTime ?? "",
    // `""` and "absent" both mean "no cover" — see the clearing branch in
    // `PATCH /api/guides/[guideId]`, which unsets the path on a draft save
    // with no cover. Normalised to `null` so the caller has one case to check.
    coverImageUrl: doc.coverImageUrl ? doc.coverImageUrl : null,
    days: doc.days.map(toEditableDay),
  };
}
