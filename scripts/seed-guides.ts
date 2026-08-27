/**
 * One-off script: writes the nineteen guides in `src/lib/destinationGuides.ts`
 * + `src/lib/guideItineraries.ts` into MongoDB as published `Guide` documents,
 * all attributed to one placeholder author this script creates if it doesn't
 * already exist. Run once to give a fresh/empty database the same guides
 * `/destinations` used to render from a hardcoded array.
 *
 * Run with:
 *
 *   npm run seed:guides
 *
 * Safety:
 * - **Idempotent.** `Guide.slug` is uniquely indexed; this script checks for
 *   an existing document with each slug before writing one, and re-running it
 *   against a database that already has some (or all) of these guides
 *   inserts nothing a second time. It never updates or deletes a document it
 *   finds already there, whether that document was created by an earlier run
 *   of this script or by a real author who happens to share a slug.
 * - **Never touches anything else in the collection.** Only inserts new
 *   documents for slugs that don't exist yet; no `deleteMany`/`updateMany`
 *   of any kind.
 * - Writes through the `Guide` model (`Guide.create`), not a raw collection
 *   insert, so `pre("save")` computes `dayCount`/`stopCount` the same way a
 *   real publish would.
 *
 * This script is deliberately the *only* way to run this job — there is no
 * dev-only API route or server action that does the same thing. A permanent
 * HTTP surface for "insert twelve documents as some user" would be a
 * standing security liability for what is a one-time setup step.
 */

import { loadEnvConfig } from "@next/env";

// `tsx` does not read `.env.local` on its own; this is what does, the same way
// `next dev`/`next build` do it (see
// `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`).
//
// Note this does NOT run before the imports below it, despite appearing above
// them — ESM hoists every `import` and evaluates them first, so writing the
// call here buys no ordering guarantee. It works because nothing imported
// reads `process.env` at module scope: `lib/mongodb.ts` reads `MONGODB_URI`
// lazily inside `connectDB()`, which `main()` calls long after this line has
// run. An import that read env eagerly would break, and moving it below this
// call would not fix it.
loadEnvConfig(process.cwd());

import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoServerError } from "mongodb";

import { connectDB } from "@/lib/mongodb";
import Guide from "@/models/Guide";
import User from "@/models/User";
import { destinationGuides } from "@/lib/destinationGuides";
import { guideItineraries } from "@/lib/guideItineraries";

/**
 * The placeholder author every seeded guide is attributed to.
 *
 * Chosen to read obviously as a system account rather than a real traveller
 * — `.internal` isn't a real TLD, so the email can't collide with anyone's
 * actual address, and the username makes the account's purpose legible
 * anywhere it's displayed (it never should be, since every seeded guide's
 * `author` view field renders the *username*, not this constant — but if it
 * ever leaks into the UI, it reads as intentional rather than a bug).
 */
const SEED_AUTHOR_USERNAME = "travel-planner-seed";
const SEED_AUTHOR_EMAIL = "seed@travelplanner.internal";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/**
 * Parses `guideItineraries.ts`'s hand-written `"May 12, 2026"` strings into a
 * real `Date`. Deliberately not `new Date(raw)`: that constructor's handling
 * of an arbitrary string is implementation-defined per the ECMA-262 spec (it
 * happens to work for this exact format in V8, but nothing guarantees every
 * engine parses it the same way), which is precisely the kind of
 * nondeterminism a one-off data-writing script shouldn't depend on. A string
 * that doesn't match the expected `"<Month> <D>, <YYYY>"` shape falls back to
 * the current time and is logged — chosen over aborting the whole run so one
 * unparseable date doesn't block the other eighteen guides.
 */
function parsePublishedAt(raw: string, slug: string): Date {
  const match = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(raw.trim());
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;

  if (!match || month === undefined) {
    console.warn(
      `[seed-guides] "${slug}": couldn't parse publishedAt ${JSON.stringify(raw)} — using the current time instead.`,
    );
    return new Date();
  }

  const day = Number(match[2]);
  const year = Number(match[3]);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Finds the placeholder author, creating it on first run. The password is a
 * random 256-bit value that is never logged and never stored anywhere but
 * this one (bcrypt-hashed, via `User`'s `pre("save")` hook) database record
 * — there is no way to sign in as this account. That's deliberate: it exists
 * only to satisfy `Guide.author`'s required reference, not to be a usable
 * login.
 *
 * Created with `role: "guide"` rather than letting `User.ts`'s schema
 * default hand it the ordinary `"user"` role: this account is the author of
 * record on all nineteen seeded guides, so once `/create-guide` is actually
 * gated on the `"guide"` role (see the TODO in `README.md`), the account
 * that produced this content should already hold it rather than being
 * unable to re-publish or edit its own guides. `ensureSeedAuthor` only runs
 * this branch on first creation — it short-circuits above on an existing
 * user, so a database seeded before this field existed needs
 * `npm run backfill:user-roles` (which only fills in a *missing* role, and
 * would leave this account at the schema default of `"user"`) or a manual
 * update to pick up `"guide"` instead.
 */
async function ensureSeedAuthor(): Promise<mongoose.Types.ObjectId> {
  const existing = await User.findOne({ username: SEED_AUTHOR_USERNAME });
  if (existing) {
    console.log(
      `[seed-guides] using existing seed author "${SEED_AUTHOR_USERNAME}" (${existing.id})`,
    );
    return existing._id;
  }

  const password = randomBytes(32).toString("hex");

  try {
    const created = await User.create({
      username: SEED_AUTHOR_USERNAME,
      email: SEED_AUTHOR_EMAIL,
      password,
      role: "guide",
    });
    console.log(
      `[seed-guides] created seed author "${SEED_AUTHOR_USERNAME}" (${created.id})`,
    );
    return created._id;
  } catch (error) {
    // A concurrent run (or a previous run that raced this same check) may
    // have created it between the `findOne` above and this `create` — fall
    // back to reading it rather than crashing the whole script over a
    // duplicate-key error on a document that already exists and is fine to
    // reuse.
    if (error instanceof MongoServerError && error.code === 11000) {
      const raced = await User.findOne({ username: SEED_AUTHOR_USERNAME });
      if (raced) return raced._id;
    }
    throw error;
  }
}

type SeedResult = "created" | "skipped";

async function seedOne(
  slug: string,
  authorId: mongoose.Types.ObjectId,
): Promise<SeedResult> {
  const guide = destinationGuides.find((g) => g.slug === slug);
  const itinerary = guideItineraries[slug];

  if (!guide || !itinerary) {
    // Shouldn't happen — every slug this function is called with comes from
    // `destinationGuides`, and `getGuideDetail` already assumes the two
    // modules stay in sync — but a missing itinerary is a skip, not a crash.
    console.warn(
      `[seed-guides] "${slug}": missing from destinationGuides.ts or guideItineraries.ts, skipping.`,
    );
    return "skipped";
  }

  const alreadyExists = await Guide.exists({ slug });
  if (alreadyExists) {
    console.log(`[seed-guides] "${slug}": already exists, leaving it as-is.`);
    return "skipped";
  }

  try {
    await Guide.create({
      slug: guide.slug,
      title: guide.title,
      heroTitle: itinerary.heroTitle,
      heroAccent: itinerary.heroAccent,
      blurb: guide.blurb,
      intro: itinerary.intro,
      tags: itinerary.tags,
      generalTips: itinerary.generalTips,
      currency: itinerary.currency,
      bestTime: itinerary.bestTime,
      coverImageUrl: guide.coverImage,
      author: authorId,
      days: itinerary.days,
      status: "published",
      publishedAt: parsePublishedAt(itinerary.publishedAt, slug),
      verified: guide.verified,
      likes: guide.likes,
      views: guide.views,
      place: guide.place,
      approxCostEUR: guide.approxCostEUR,
      // `dayCount`/`stopCount` are deliberately omitted — `Guide.ts`'s
      // `pre("save")` hook recomputes both from `days` on every save, so
      // setting them here would be redundant at best and wrong (drifted from
      // the array) at worst.
    });
  } catch (error) {
    // Same race as `ensureSeedAuthor`: a concurrent insert of this exact slug
    // between the `exists` check above and this `create` loses to the unique
    // index rather than duplicating anything — treat it as an ordinary skip.
    if (error instanceof MongoServerError && error.code === 11000) {
      console.log(
        `[seed-guides] "${slug}": created concurrently by another run, skipping.`,
      );
      return "skipped";
    }
    throw error;
  }

  console.log(`[seed-guides] "${slug}": created.`);
  return "created";
}

async function main(): Promise<void> {
  await connectDB();

  // `finally`, not a trailing `disconnect()`: an open mongoose connection is an
  // active handle, so a throw partway through the loop would otherwise leave
  // the process hanging instead of reporting the failure and exiting.
  try {
    const authorId = await ensureSeedAuthor();

    let created = 0;
    let skipped = 0;

    for (const { slug } of destinationGuides) {
      const result = await seedOne(slug, authorId);
      if (result === "created") created++;
      else skipped++;
    }

    console.log(
      `[seed-guides] done: ${created} created, ${skipped} skipped (of ${destinationGuides.length}).`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed-guides] failed:", error);
  process.exitCode = 1;
});
