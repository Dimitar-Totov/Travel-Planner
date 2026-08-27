import { z } from "zod";
import type { TransferMode } from "@/lib/itinerary";

/**
 * Validation for the guides-write API (`POST /api/guides`).
 *
 * Mirrors `src/models/Guide.ts`'s own draft/published split: `Guide.ts` makes
 * `heroTitle`/`heroAccent`/`blurb`/`intro`/`bestTime`/`coverImageUrl` and a
 * non-empty `days` array `required` only when `status === "published"`
 * (`requiredWhenPublished`), because `useCreateGuideForm` starts a draft
 * completely empty and a half-written guide has to be saveable. This module
 * has to accept the same half-written shape for a draft POST while still
 * being able to reject an incomplete `published` one with proper per-field
 * errors — the Mongoose-level `required` check is documented in `Guide.ts`
 * as the *last* line of defense, not the primary one.
 *
 * `draftGuideSchema` is the lenient shape. `publishGuideSchema` is built from
 * it with `.extend()` rather than a hand-duplicated field list, so the two
 * can never drift apart: every field publishing tightens is declared once in
 * the base schema and only *overridden* to be non-empty/required in the
 * extension, everything else (bounds, array limits, coordinate ranges) is
 * inherited unchanged. `status` itself is deliberately *not* a field on
 * either schema — see the note above `guideStatusSchema` below.
 *
 * Dependency-free apart from Zod, like `lib/validation/auth.ts` — this module
 * is safe to import from a client component (a future wiring of
 * `/create-guide` to this API will want the same pre-flight-before-round-trip
 * pattern `SignUpForm` uses today), so it must never pull in mongoose,
 * `node:crypto`, or anything else that only resolves on the server. In
 * particular, the R2-bucket host check for `coverImageUrl`/`photoUrl` is
 * deliberately NOT here — it needs `R2_PUBLIC_BASE_URL`, a server-only env
 * var, and lives in `src/app/api/guides/route.ts` instead.
 */

// ---------------------------------------------------------------------------
// Bounds
//
// A Mongo document is capped at 16MB, and every array/string below is
// attacker-controlled input from an authenticated-but-untrusted client, so
// each one gets an explicit ceiling rather than relying on the 16MB cap to
// eventually kick in. Sized generously against `Guide.ts`'s own reference
// point for a large *real* guide — "the largest hardcoded guide today is
// ~30 stops across 7 days" — with headroom for a longer trip than anything
// currently in `guideItineraries.ts`, not against a worst-case attacker
// payload (that's what the ceiling itself is for).
// ---------------------------------------------------------------------------

/** ~3x the longest hardcoded guide (7 days). */
export const MAX_DAYS = 21;
/** ~30 stops / 7 days is ~4-5/day for the largest hardcoded guide; well over 2x that per day. */
export const MAX_STOPS_PER_DAY = 12;

export const MAX_TITLE_LENGTH = 150;
export const MAX_HERO_TITLE_LENGTH = 150;
/** Short accent word/phrase rendered next to the hero title, e.g. "Amalfi". */
export const MAX_HERO_ACCENT_LENGTH = 60;
/** The feed-card one-liner — short by design. */
export const MAX_BLURB_LENGTH = 300;
/** Long-form prose under the hero. */
export const MAX_INTRO_LENGTH = 6000;
/** A currency symbol or ISO code ("€", "USD"), not free text. */
export const MAX_CURRENCY_LENGTH = 8;
export const MAX_BEST_TIME_LENGTH = 120;

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;
export const MAX_GENERAL_TIPS = 20;
export const MAX_GENERAL_TIP_LENGTH = 300;

export const MAX_DAY_TITLE_LENGTH = 120;
export const MAX_DAY_SUMMARY_LENGTH = 300;

export const MAX_STOP_NAME_LENGTH = 120;
export const MAX_STOP_ABOUT_LENGTH = 2000;
export const MAX_STOP_ADDRESS_LENGTH = 300;
export const MAX_STOP_TAGS = 8;
export const MAX_STOP_NOTES = 10;
export const MAX_NOTE_LENGTH = 300;
export const MAX_TRANSFER_TEXT_LENGTH = 40;

/** Generous headroom over a normal image CDN URL; guards against a pathological string reaching Mongo. */
export const MAX_URL_LENGTH = 2048;

/**
 * The image content types the guide-photo flow accepts, end to end.
 *
 * Lives in this module — not `lib/storage/r2.ts`, which owns the upload
 * mechanics — precisely because it has to be readable from **both** sides:
 * `POST /api/uploads` validates against it and derives the stored object's
 * extension from it, and `components/create-guide/imageUpload.ts` screens a
 * picked file against it in the browser. `storage/r2.ts` is server-only, so a
 * client component importing the list from there would drag the R2 client into
 * the bundle. This module is already dependency-free for exactly that reason.
 *
 * One list matters more than it looks: if the picker were more permissive than
 * the endpoint, an author could add a `.bmp`, see it preview correctly, write
 * the whole guide, and only be told at Publish that the photo was never
 * uploadable.
 *
 * Deliberately five concrete raster types, not an `image/*` prefix match.
 * `image/svg+xml` is the notable exclusion: an SVG can embed `<script>` and
 * event-handler attributes, and these objects are served back from the app's
 * own bucket domain, which is close enough to same-origin script execution to
 * treat as a real risk.
 */
export const GUIDE_PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export type GuidePhotoContentType = (typeof GUIDE_PHOTO_CONTENT_TYPES)[number];

/** Ready for a file input's `accept` attribute, so the OS picker filters too. */
export const GUIDE_PHOTO_ACCEPT = GUIDE_PHOTO_CONTENT_TYPES.join(",");

export function isGuidePhotoContentType(
  value: string,
): value is GuidePhotoContentType {
  return (GUIDE_PHOTO_CONTENT_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * `TransferMode`'s nine values, hand-duplicated from `src/lib/itinerary.ts`.
 *
 * `itinerary.ts` is a type-only module (interfaces and a union type, no
 * runtime exports), so there is nothing to `import` at runtime — only the
 * type itself, which Zod's `z.enum` can't read. `Guide.ts` hits the same
 * wall and duplicates the list by hand for the same reason (see its
 * `TRANSFER_MODES` comment); this is that module's copy.
 *
 * `satisfies TransferMode[]` alone only catches half the drift — it rejects a
 * mode that isn't in the union, but an entry *added* to `TransferMode` and
 * forgotten here would still compile and then silently reject a valid
 * transfer at runtime. `AllModesCovered` below closes that half: it resolves
 * to `never` only when every union member appears in the array, and a
 * non-`never` argument to `AssertNever` is a compile error.
 */
const TRANSFER_MODES = [
  "walk",
  "metro",
  "bus",
  "tram",
  "train",
  "car",
  "ferry",
  "bike",
  "flight",
] satisfies TransferMode[];

type AssertNever<T extends never> = T;
/** Exported only so it counts as used; its value is the compile-time check. */
export type AllModesCovered = AssertNever<
  Exclude<TransferMode, (typeof TRANSFER_MODES)[number]>
>;

/** A bounded free-text entry — one tag, one tip, one note. */
function shortText(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(maxLength, {
      error: `${label} must be at most ${maxLength} characters long.`,
    });
}

const tagSchema = shortText(MAX_TAG_LENGTH, "Tag").min(1, {
  error: "Tag cannot be empty.",
});
const generalTipSchema = shortText(MAX_GENERAL_TIP_LENGTH, "Tip").min(1, {
  error: "Tip cannot be empty.",
});
const noteSchema = shortText(MAX_NOTE_LENGTH, "Note").min(1, {
  error: "Note cannot be empty.",
});

/**
 * An absolute `http(s)` URL, bounded in length. `z.httpUrl()` (not the more
 * permissive `z.url()`) because every use here — `coverImageUrl`, a stop's
 * `photoUrl` — is a link the app will hand straight to `next/image`, which
 * has no use for a `data:`/`ftp:`/etc. URL.
 */
const httpUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, {
    error: `URL must be at most ${MAX_URL_LENGTH} characters long.`,
  })
  .pipe(z.httpUrl({ error: "Must be a valid http(s) URL." }));

const latSchema = z
  .number({ error: "Latitude is required." })
  .min(-90, {
    error: "Latitude must be between -90 and 90.",
  })
  .max(90, {
    error: "Latitude must be between -90 and 90.",
  });

const lngSchema = z
  .number({ error: "Longitude is required." })
  .min(-180, {
    error: "Longitude must be between -180 and 180.",
  })
  .max(180, {
    error: "Longitude must be between -180 and 180.",
  });

const priceLevelSchema = z
  .number()
  .int({ error: "Price level must be a whole number." })
  .min(1, { error: "Price level must be between 1 and 4." })
  .max(4, { error: "Price level must be between 1 and 4." });

const stopTransferSchema = z.object({
  mode: z.enum(TRANSFER_MODES, {
    error: `Transfer mode must be one of: ${TRANSFER_MODES.join(", ")}.`,
  }),
  duration: shortText(MAX_TRANSFER_TEXT_LENGTH, "Transfer duration").min(1, {
    error: "Transfer duration is required.",
  }),
  distance: shortText(MAX_TRANSFER_TEXT_LENGTH, "Transfer distance").min(1, {
    error: "Transfer distance is required.",
  }),
});

// ---------------------------------------------------------------------------
// Stop
//
// `lat`/`lng` are required at *every* status, not just when published —
// this matches `guideStopSchema` in `Guide.ts`, whose coordinate fields are
// `required: true` unconditionally. That's not an oversight there: a
// `DraftStop` is never actually coordinate-less client-side either — it's
// seeded with a real (if placeholder) point the moment it's created
// (`newStop` in `useCreateGuideForm.ts`), so `toGuideStop` always sends a
// real `lat`/`lng` pair regardless of whether the author has genuinely
// placed it. `DraftStop.placed` is the flag that tracks "genuinely placed"
// client-side, but it is not part of `GuideStop`/`IGuideStop` and never
// reaches the wire — so this schema, like the model, can only validate that
// the coordinates it *does* receive are in-range, at every status. The
// "every stop ... placed" requirement for publishing reduces to exactly
// that: valid-range coordinates, which are already mandatory on a draft too.
// `name`, by contrast, genuinely is optional-then-required — draft stops are
// created blank and named later — so that's the one field the strict variant
// below tightens.
// ---------------------------------------------------------------------------

const stopSchema = z.object({
  name: shortText(MAX_STOP_NAME_LENGTH, "Stop name").default(""),
  lat: latSchema,
  lng: lngSchema,
  tags: z
    .array(tagSchema)
    .max(MAX_STOP_TAGS, {
      error: `A stop can have at most ${MAX_STOP_TAGS} tags.`,
    })
    .default([]),
  notes: z
    .array(noteSchema)
    .max(MAX_STOP_NOTES, {
      error: `A stop can have at most ${MAX_STOP_NOTES} notes.`,
    })
    .default([]),
  about: shortText(MAX_STOP_ABOUT_LENGTH, "About").optional(),
  address: shortText(MAX_STOP_ADDRESS_LENGTH, "Address").optional(),
  priceLevel: priceLevelSchema.optional(),
  transfer: stopTransferSchema.optional(),
  highlight: z.boolean().optional(),
  // Host-checked against R2_PUBLIC_BASE_URL in the route, not here — see the
  // module doc comment.
  photoUrl: httpUrlSchema.optional(),
});

/** Publishing requires a real name — the one stop field that's genuinely blank-then-filled. */
const strictStopSchema = stopSchema.extend({
  name: shortText(MAX_STOP_NAME_LENGTH, "Stop name").min(1, {
    error: "Every stop needs a name before publishing.",
  }),
});

// ---------------------------------------------------------------------------
// Day
// ---------------------------------------------------------------------------

const daySchema = z.object({
  // Matches `guideDaySchema` in `Guide.ts`: title/summary are never
  // `required`, even on a published guide (a blank summary is legitimate
  // content, and `asGuideDays` falls back to "Day N" client-side rather than
  // rejecting a blank title). Bounding length is still worth doing —
  // unbounded free text is unbounded free text regardless of status.
  title: shortText(MAX_DAY_TITLE_LENGTH, "Day title").default(""),
  summary: shortText(MAX_DAY_SUMMARY_LENGTH, "Day summary").default(""),
  stops: z
    .array(stopSchema)
    .max(MAX_STOPS_PER_DAY, {
      error: `A day can have at most ${MAX_STOPS_PER_DAY} stops.`,
    })
    .default([]),
});

const strictDaySchema = daySchema.extend({
  stops: z
    .array(strictStopSchema)
    .max(MAX_STOPS_PER_DAY, {
      error: `A day can have at most ${MAX_STOPS_PER_DAY} stops.`,
    })
    .default([]),
});

// ---------------------------------------------------------------------------
// Guide
//
// Deliberately absent from both schemas below, and therefore stripped by
// Zod's default object behavior (a plain `z.object()` strips unrecognized
// keys rather than erroring on or passing them through) even if a client
// sends them:
//   - `author`   — set by the route from `session.user.id`. Accepting it
//                  from the body is an authorship-forgery hole.
//   - `slug`     — derived by the route from `title`. It's the unique-index
//                  URL identity; letting a client pick it invites squatting
//                  and collisions.
//   - `likes` / `views`   — engagement counters the app itself owns.
//   - `verified`          — an editorial flag, not an authoring input.
//   - `dayCount` / `stopCount` — maintained by `Guide.ts`'s `pre("save")`
//                  hook from `days`; a client-supplied value could disagree
//                  with the array it's summarizing.
//   - `status` as a schema field — see `guideStatusSchema` below.
//   - `place` / `approxCostEUR` — real `Guide.ts` fields, but
//                  `useCreateGuideForm` doesn't collect either yet (flagged
//                  in `Guide.ts`'s own `IGuide.place` doc comment), so
//                  there's nothing for this schema to validate today.
// ---------------------------------------------------------------------------

/**
 * The lenient, draft-safe shape. `title` is the one content field required
 * even here — `Guide.ts` requires it unconditionally too, since it is what
 * the slug is derived from and the only thing a future "your drafts" list
 * could show a row by.
 */
export const draftGuideSchema = z.object({
  title: shortText(MAX_TITLE_LENGTH, "Title").min(1, {
    error: "Title is required.",
  }),
  heroTitle: shortText(MAX_HERO_TITLE_LENGTH, "Hero title").default(""),
  heroAccent: shortText(MAX_HERO_ACCENT_LENGTH, "Hero accent").default(""),
  blurb: shortText(MAX_BLURB_LENGTH, "Blurb").default(""),
  intro: shortText(MAX_INTRO_LENGTH, "Intro").default(""),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS, {
      error: `A guide can have at most ${MAX_TAGS} tags.`,
    })
    .default([]),
  generalTips: z
    .array(generalTipSchema)
    .max(MAX_GENERAL_TIPS, {
      error: `A guide can have at most ${MAX_GENERAL_TIPS} general tips.`,
    })
    .default([]),
  // Required at every status in `Guide.ts` (`default: "€"`), not
  // `requiredWhenPublished` — matched here with the same always-has-a-value
  // default rather than `.optional()`.
  currency: shortText(MAX_CURRENCY_LENGTH, "Currency").default("€"),
  bestTime: shortText(MAX_BEST_TIME_LENGTH, "Best time").default(""),
  // Host-checked against R2_PUBLIC_BASE_URL in the route, not here.
  coverImageUrl: httpUrlSchema.optional(),
  days: z
    .array(daySchema)
    .max(MAX_DAYS, {
      error: `A guide can have at most ${MAX_DAYS} days.`,
    })
    .default([]),
});

/**
 * The strict, publish-ready shape — every field `Guide.ts` marks
 * `requiredWhenPublished`, plus at least one day. Built with `.extend()`
 * over `draftGuideSchema` rather than a second field list: every bound
 * (max lengths, array limits) is inherited unchanged from the draft schema,
 * and only the "must not be empty" tightening is written out here, so the
 * two can't silently drift apart the way two independently maintained
 * schemas could.
 */
export const publishGuideSchema = draftGuideSchema.extend({
  heroTitle: shortText(MAX_HERO_TITLE_LENGTH, "Hero title").min(1, {
    error: "Add a hero title before publishing.",
  }),
  heroAccent: shortText(MAX_HERO_ACCENT_LENGTH, "Hero accent").min(1, {
    error: "Add a hero accent before publishing.",
  }),
  blurb: shortText(MAX_BLURB_LENGTH, "Blurb").min(1, {
    error: "Add a blurb before publishing.",
  }),
  intro: shortText(MAX_INTRO_LENGTH, "Intro").min(1, {
    error: "Add an intro before publishing.",
  }),
  bestTime: shortText(MAX_BEST_TIME_LENGTH, "Best time").min(1, {
    error: "Add a best-time-to-visit note before publishing.",
  }),
  coverImageUrl: httpUrlSchema,
  days: z
    .array(strictDaySchema)
    .min(1, {
      error: "Add at least one day before publishing.",
    })
    .max(MAX_DAYS, {
      error: `A guide can have at most ${MAX_DAYS} days.`,
    }),
});

export type DraftGuideInput = z.infer<typeof draftGuideSchema>;
export type PublishGuideInput = z.infer<typeof publishGuideSchema>;
export type GuideInput = DraftGuideInput | PublishGuideInput;

/**
 * Validates the raw `status` value from a request body before either guide
 * schema runs, so the route can pick which one to run.
 *
 * `status` is deliberately not a field on `draftGuideSchema`/
 * `publishGuideSchema` themselves: which schema to validate *against* is a
 * function of `status`, so folding it into either schema as a field would
 * make the schema selection and the field's own validation two separate
 * checks of the same value, able to disagree (e.g. a discriminated union
 * needs the discriminant to match one branch exactly, which just re-invents
 * this same up-front check one layer down). The route parses `status` with
 * this schema first, uses the result to choose `draftGuideSchema` or
 * `publishGuideSchema`, and passes the already-known-good status straight to
 * `Guide.create` alongside `slug`/`author` — all three are server-decided
 * values, not fields the client-shaped schema owns.
 */
export const guideStatusSchema = z.enum(["draft", "published"], {
  error: 'Status must be "draft" or "published".',
});

export type GuideStatusInput = z.infer<typeof guideStatusSchema>;

/**
 * Collapses a `ZodError` into a `{ path: message }` map for a *nested*
 * payload, where `fieldErrorsOf` (`lib/validation/auth.ts`) would collapse
 * everything under one top-level key. `fieldErrorsOf` keys by
 * `issue.path[0]` alone, which is correct for a flat credentials form (every
 * field *is* top-level) but wrong here: a bad coordinate 40 stops deep would
 * collapse to the single key `"days"`, giving an author one generic message
 * for a problem in one specific stop. This joins the full path instead —
 * `["days", 2, "stops", 5, "lat"]` becomes `"days.2.stops.5.lat"` — so a
 * client can point at the exact control.
 *
 * Lives here rather than next to `fieldErrorsOf` in `auth.ts` because
 * dotted-index paths are only meaningful for a nested payload like a guide;
 * every existing consumer of `fieldErrorsOf` (`POST /api/users`,
 * `SignUpForm`, `SignInForm`) is a flat form with no nesting to disambiguate,
 * so adding this next to it would suggest a use it doesn't have. Explicitly
 * a *different* function, not a parameter added to `fieldErrorsOf` — the
 * task requires `fieldErrorsOf`'s existing flat behavior stay unchanged for
 * its current callers.
 */
export function nestedFieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    // An issue about the payload as a whole (empty path) has no field to
    // key it by, same as `fieldErrorsOf`'s handling.
    if (issue.path.length === 0) {
      continue;
    }

    const field = issue.path.join(".");
    if (field in result) {
      continue;
    }

    result[field] = issue.message;
  }

  return result;
}
