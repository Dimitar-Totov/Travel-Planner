/**
 * One-off script: seeds sample data into the `likes` and `comments`
 * collections (`src/models/Like.ts` / `src/models/Comment.ts`) against
 * whatever guides and users already exist in the database. There is no
 * write path for either collection yet (no `POST /api/guides/[guideId]/like`
 * or `.../comments` route) — this exists purely to give the schemas real
 * data to develop the read/render side against.
 *
 * Run with:
 *
 *   npm run seed:likes-comments
 *
 * Requires at least one `Guide` and one `User` document to already exist
 * (`npm run seed:guides` for the former; sign up for the latter) — it reads
 * both collections rather than creating placeholder rows of its own the way
 * `seed-guides.ts` does for its one placeholder author.
 *
 * Safety:
 * - **Idempotent.** Likes: `Like.guide` is uniquely indexed, so each guide's
 *   like document is an upsert plus a `$addToSet` on `users` — re-running
 *   adds nothing a user was already credited with. Comments: before
 *   inserting, checks for an existing document with the same
 *   `(guide, user, comment)` triple and skips it — re-running the script
 *   never duplicates a seeded comment.
 * - **Never touches a `Guide` or `User` document, and never deletes
 *   anything** — only inserts into `likes`/`comments`.
 */

import { loadEnvConfig } from "@next/env";

// Same bootstrapping note as `scripts/seed-guides.ts`: this has to run before
// anything below reads `process.env`, but ESM hoists the imports below this
// line ahead of it regardless — it works only because none of them read env
// vars at module scope (`lib/mongodb.ts` reads `MONGODB_URI` lazily, inside
// `connectDB()`, which `main()` doesn't call until after this line has run).
loadEnvConfig(process.cwd());

import mongoose from "mongoose";

import { connectDB } from "@/lib/mongodb";
import Guide from "@/models/Guide";
import User from "@/models/User";
import Like from "@/models/Like";
import Comment from "@/models/Comment";

const CANNED_COMMENTS = [
  "This itinerary is exactly what I needed for my trip — thank you!",
  "Loved the pacing on this one, nothing felt rushed.",
  "Saving this for next year. The food stops alone make it worth it.",
  "Did most of this last month and it matched the guide almost stop for stop.",
  "Any tips for doing this on a tighter budget?",
  "The photos don't do it justice — even better in person.",
  "Underrated guide, more people should see this.",
  "Bookmarked. Which stop would you cut if you only had one day less?",
];

async function main(): Promise<void> {
  await connectDB();

  // `finally`, not a trailing `disconnect()`: an open mongoose connection is
  // an active handle, so a throw partway through the loop would otherwise
  // leave the process hanging instead of reporting the failure and exiting.
  try {
    const guides = await Guide.find().select("_id slug").lean();
    const users = await User.find().select("_id username").lean();

    if (guides.length === 0 || users.length === 0) {
      console.warn(
        "[seed-likes-comments] no guides or no users found — nothing to seed. Run `npm run seed:guides` first, or sign up a user.",
      );
      return;
    }

    let likeDocsTouched = 0;
    let likesAdded = 0;
    let commentsCreated = 0;
    let commentsSkipped = 0;

    for (let i = 0; i < guides.length; i++) {
      const guide = guides[i];

      // Deterministic per-guide subset of likers — not random, so re-seeding
      // a dropped collection reproduces the same intended data. The
      // `$addToSet` upsert below is what actually makes reruns idempotent;
      // this determinism just keeps the *content* stable too.
      const likerCount = 1 + (i % Math.min(users.length, 4));
      const likers = Array.from(
        { length: likerCount },
        (_, k) => users[(i + k) % users.length]._id,
      );

      const before = await Like.findOne({ guide: guide._id })
        .select("users")
        .lean();
      const beforeCount = before?.users.length ?? 0;

      const likeDoc = await Like.findOneAndUpdate(
        { guide: guide._id },
        { $addToSet: { users: { $each: likers } } },
        { upsert: true, returnDocument: "after" },
      );
      likeDocsTouched++;
      likesAdded += likeDoc.users.length - beforeCount;

      // One or two comments per guide, from different users, cycled through
      // the canned list so guides don't all read identically.
      const commentCount = 1 + (i % 2);
      for (let c = 0; c < commentCount; c++) {
        const user = users[(i + c + 1) % users.length];
        const text = CANNED_COMMENTS[(i + c) % CANNED_COMMENTS.length];

        const alreadyExists = await Comment.exists({
          guide: guide._id,
          user: user._id,
          comment: text,
        });
        if (alreadyExists) {
          commentsSkipped++;
          continue;
        }

        await Comment.create({
          guide: guide._id,
          user: user._id,
          comment: text,
        });
        commentsCreated++;
      }
    }

    console.log(
      `[seed-likes-comments] done: ${likeDocsTouched} like document(s) touched (${likesAdded} new like(s) added), ${commentsCreated} comment(s) created (${commentsSkipped} already present).`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed-likes-comments] failed:", error);
  process.exitCode = 1;
});
