import {
  Schema,
  model,
  models,
  Types,
  type Document,
  type Model,
} from "mongoose";
import type { TransferMode } from "@/lib/itinerary";

/**
 * The `guides` collection — the persisted counterpart of the two hardcoded
 * data modules `/guides` currently reads from, merged into one
 * document: `DestinationGuide` (`src/lib/destinationGuides.ts`, what the feed
 * card needs) and `GuideItinerary` (`src/lib/guideItineraries.ts`, what the
 * detail page adds on top). Nothing imports this model yet — it exists ahead
 * of the guides API that will read/write it.
 *
 * Days and stops are embedded, not referenced. A guide is always read whole:
 * the detail page renders every day and every stop, and the map plots every
 * stop's coordinates in one pass. There's no independent query pattern for a
 * single day or stop, and cardinality is bounded (the largest hardcoded guide
 * today is ~30 stops across 7 days) — kilobytes of JSON against Mongo's 16MB
 * document cap. Referencing them would just buy a `$lookup` per page view for
 * no benefit.
 *
 * The author is referenced, not embedded. Denormalizing the username/avatar
 * onto every guide (the "extended reference" pattern) would save one
 * `populate` on an 8-item feed page, which isn't worth the fan-out update
 * path this app has no machinery for today (a username change would need to
 * rewrite every guide by that author). If the feed's `populate` ever measures
 * slow, that denormalization is the escape hatch — add a cached
 * `authorUsername`/`authorAvatar` pair here and accept the update fan-out.
 *
 * `dayCount`/`stopCount` are maintained fields, not derived on read.
 * `/guides`' "Weekends" tab filters on `days <= 4`; filtering on an
 * embedded array's length needs `$expr: { $lte: [{ $size: "$days" }, 4] } }`,
 * which can't use an index. Storing the count keeps that filter indexable and
 * is why the `pre("save")` hook below recomputes both off `this.days` on
 * every save — the alternative (setting them by hand at the call site) can
 * drift from the array.
 */

/**
 * Typed against `TransferMode` (`src/lib/itinerary.ts`) so a value that isn't
 * in that union is a compile error rather than a silent mismatch between the
 * app's type and this schema's `enum` validator. Mongoose can't read a TS
 * union at runtime, so the list still has to be written out by hand.
 *
 * Note the annotation only catches a *wrong* entry, not a *missing* one — a
 * mode added to `TransferMode` and forgotten here would compile and then be
 * rejected at write time. `lib/validation/guide.ts` carries the same list and
 * an `AllModesCovered` assertion that does catch that; adding a mode means
 * updating both.
 */
const TRANSFER_MODES: TransferMode[] = [
  "walk",
  "metro",
  "bus",
  "tram",
  "train",
  "car",
  "ferry",
  "bike",
  "flight",
];

export type GuideStatus = "draft" | "published";
const GUIDE_STATUSES: GuideStatus[] = ["draft", "published"];

/**
 * `required` for the content fields a *published* guide must have, but which a
 * draft is expected to be missing.
 *
 * A draft starts empty — `useCreateGuideForm` seeds `heroTitle`/`blurb`/
 * `intro`/`bestTime` as `""` and has no cover photo — and Mongoose treats `""`
 * as absent for a `required` String. Marking these unconditionally required
 * would make the first save of a new draft throw a ValidationError, i.e. make
 * the `status: "draft"` default unusable. Conditioning on `status` is what
 * lets a half-written guide persist while still guaranteeing that anything
 * reaching `/guides` is complete.
 *
 * Note this is the *last* line of defense, not the primary one: the publish
 * endpoint should reject an incomplete guide with per-field errors (the way
 * `lib/validation/auth.ts` does for credentials) rather than surfacing a raw
 * Mongoose validation error.
 */
function requiredWhenPublished(this: IGuide): boolean {
  return this.status === "published";
}

export interface IStopTransfer {
  mode: TransferMode;
  duration: string;
  distance: string;
}

export interface IGuideStop {
  _id: Types.ObjectId;
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
  /**
   * New relative to `GuideStop` (`src/lib/itinerary.ts`), which has no photo
   * field — every hardcoded guide renders a placeholder there today. This is
   * the persistence counterpart of the editor's `DraftStop.photo`
   * (`src/lib/hooks/useCreateGuideForm.ts`): an R2 public URL
   * (`src/lib/storage/r2.ts`'s `r2PublicUrl`), not a data URL or a presigned
   * upload URL.
   */
  photoUrl?: string;
}

export interface IGuideDay {
  _id: Types.ObjectId;
  title: string;
  summary: string;
  stops: IGuideStop[];
}

export interface IGuide extends Document {
  slug: string;

  // Content
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

  author: Types.ObjectId;

  days: IGuideDay[];

  // Publication
  status: GuideStatus;
  /** Unset until published. A real `Date` — the hardcoded data stores a
   *  pre-formatted string (`GuideItinerary.publishedAt`); format at render. */
  publishedAt?: Date | null;
  verified: boolean;

  // Engagement
  likes: number;
  views: number;

  /**
   * Optional: `useCreateGuideForm` (`src/lib/hooks/useCreateGuideForm.ts`)
   * doesn't collect either `place` or `approxCostEUR` today, but
   * `/guides`' budget filter and thumbnail description
   * (`DestinationGuide.place`/`approxCostEUR`) need them. The authoring form
   * has to grow these two fields before the feed can filter/display real
   * data for a guide created through it — flagged here rather than papered
   * over with a fabricated default.
   */
  place?: string;
  approxCostEUR?: number;

  /** Maintained by the `pre("save")` hook below — see the module comment. */
  dayCount: number;
  stopCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const stopTransferSchema = new Schema<IStopTransfer>(
  {
    mode: { type: String, required: true, enum: TRANSFER_MODES },
    duration: { type: String, required: true },
    distance: { type: String, required: true },
  },
  // Not a day/stop: it has no identity of its own worth keeping stable, so
  // skip the default subdocument `_id` rather than mint one that's never used.
  { _id: false },
);

// Nothing in here is `required`, including `name`. A draft's stops are created
// blank and filled in later (`useCreateGuideForm`'s `newStop`), and the
// `requiredWhenPublished` trick used on the parent can't work at this depth:
// inside a subdocument `this` is the stop, which has no `status` to read. So
// completeness of a published guide's stops is the publish endpoint's job, and
// this schema only enforces the constraints that are wrong at *any* status —
// the coordinate ranges and `priceLevel`'s scale.
const guideStopSchema = new Schema<IGuideStop>({
  name: { type: String, default: "", trim: true },
  // A transposed lat/lng pair silently puts a pin in the sea — both
  // `guideItineraries.ts` and `LocationPickerModal.tsx` call this out as a
  // live hazard, hence the range validation rather than trusting the caller.
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  tags: { type: [String], default: [] },
  notes: { type: [String], default: [] },
  about: { type: String },
  address: { type: String },
  priceLevel: { type: Number, min: 1, max: 4 },
  transfer: { type: stopTransferSchema },
  highlight: { type: Boolean },
  photoUrl: { type: String },
});
// Subdocument `_id` left on its Mongoose default — free, and it's the stable
// per-stop identity a future per-stop edit endpoint needs, the same problem
// `DraftStop.id` solves client-side in the editor.

const guideDaySchema = new Schema<IGuideDay>({
  title: { type: String, default: "", trim: true },
  // Blank is legitimate content even on a published guide — `summary` is the
  // optional one-liner under a day's title, and `asGuideDays` emits `""` for a
  // day the author didn't write one for. `required` would reject that, since
  // Mongoose counts `""` as missing.
  summary: { type: String, default: "", trim: true },
  stops: { type: [guideStopSchema], default: [] },
});
// Same reasoning as `guideStopSchema` above: default `_id` kept.

const guideSchema = new Schema<IGuide>(
  {
    // The identity the detail route (`/guides/guide/[guideId]/details`)
    // keys off — unique index is the constraint that makes a slug usable as
    // a URL segment at all.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // `title` is required even for a draft: it's what the slug is derived from
    // and the only thing a "your drafts" list could show a row by.
    title: { type: String, required: true, trim: true },
    heroTitle: { type: String, required: requiredWhenPublished, trim: true },
    heroAccent: { type: String, required: requiredWhenPublished, trim: true },
    blurb: { type: String, required: requiredWhenPublished, trim: true },
    intro: { type: String, required: requiredWhenPublished, trim: true },
    tags: { type: [String], default: [] },
    generalTips: { type: [String], default: [] },
    currency: { type: String, required: true, default: "€" },
    bestTime: { type: String, required: requiredWhenPublished, trim: true },
    coverImageUrl: { type: String, required: requiredWhenPublished },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    days: { type: [guideDaySchema], default: [] },

    status: {
      type: String,
      required: true,
      enum: GUIDE_STATUSES,
      default: "draft",
    },
    publishedAt: { type: Date, default: null },
    verified: { type: Boolean, required: true, default: false },

    likes: { type: Number, required: true, default: 0, min: 0 },
    views: { type: Number, required: true, default: 0, min: 0 },

    // See `IGuide.place`/`approxCostEUR` doc comment: optional until the
    // authoring form collects them.
    place: { type: String, trim: true },
    approxCostEUR: { type: Number, min: 0 },

    dayCount: { type: Number, required: true, default: 0, min: 0 },
    stopCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Recomputes `dayCount`/`stopCount` from the arrays they summarize, so a
// caller can never set them by hand and get them wrong — see the module
// comment for why they're stored (indexable filtering) rather than derived.
//
// This covers `save()` only. `findOneAndUpdate`/`updateOne`/`updateMany` skip
// document middleware entirely, so a write that touches `days` through one of
// those would leave the counts stale. Guide writes should go through
// `save()` for that reason; if an update-path write of `days` ever becomes
// necessary, it has to recompute both counts in the same `$set`.
guideSchema.pre("save", function (this: IGuide) {
  this.dayCount = this.days.length;
  this.stopCount = this.days.reduce(
    (total, day) => total + day.stops.length,
    0,
  );
});

// `slug`'s index comes from `unique: true` above; `author`'s from `index:
// true` above. Declaring either again here would be a duplicate index.

// The feed's default ordering (`useDestinationsExplorer`'s "recent" tab):
// published guides, newest first.
guideSchema.index({ status: 1, createdAt: -1 });

// The feed's "Loved" tab: published guides, most-liked first. Added because
// this tab exists today and sorts on exactly this pair, not speculatively.
guideSchema.index({ status: 1, likes: -1 });

// Not indexed, on purpose: nothing queries `approxCostEUR` or `dayCount`
// yet — `useDestinationsExplorer`'s "Budget"/"Weekends" tabs currently
// filter the hardcoded array in the browser. Candidates for
// `{ status: 1, approxCostEUR: 1 }` / `{ status: 1, dayCount: 1 }` once that
// filtering moves server-side; adding them now would be speculative
// over-indexing against zero real query load.

// `models.Guide ||` avoids `OverwriteModelError` on hot reload / repeated
// import in dev, where this module can be re-evaluated without the
// underlying mongoose connection/registry being reset.
const Guide: Model<IGuide> =
  models.Guide || model<IGuide>("Guide", guideSchema);

export default Guide;
