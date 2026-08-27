/**
 * One-off script: sets `role` on every existing `User` document that doesn't
 * already have one.
 *
 * Why this is needed at all despite `models/User.ts`'s `default:
 * DEFAULT_USER_ROLE` on the schema: a Mongoose `default` is applied when a
 * document is *hydrated* - i.e. when a query result is turned into a
 * document instance and a path is found missing on it. So `user.role` in
 * application code already reads back as `"user"` for every account created
 * before this field existed, and nothing looks broken. But the field is
 * genuinely absent from the raw document in Mongo, which shows up the moment
 * anything reads around Mongoose's hydration instead of through it:
 * `.lean()` queries return the bare object with no `role` key at all, and -
 * the case this script actually exists for - `User.find({ role: "admin" })`
 * (exactly what the coming admin panel will run) matches nothing for these
 * accounts, because there's no `role` key in the stored document for the
 * query engine to compare against. A schema default only helps code that
 * goes through Mongoose's document layer; it does nothing for a raw query
 * filter. This script closes that gap once, for accounts that predate the
 * field, rather than leaving every future role-filtered query to quietly
 * skip them.
 *
 * Run with:
 *
 *   npm run backfill:user-roles
 *
 * Safety:
 * - **Idempotent.** The filter is `{ role: { $exists: false } }`, so a
 *   second run finds nothing left to touch and reports zero modified.
 * - **Only ever adds the field, never overwrites one that's already
 *   there** - an account whose role was already set (by this script, by
 *   `models/User.ts`'s default on a fresh signup, or by hand) is excluded
 *   by the filter and left completely alone.
 */

import { loadEnvConfig } from "@next/env";

// Same bootstrapping note as `scripts/seed-guides.ts`: this has to run before
// anything below reads `process.env`, but ESM hoists the imports below this
// line ahead of it regardless - it works only because none of them read env
// vars at module scope (`lib/mongodb.ts` reads `MONGODB_URI` lazily, inside
// `connectDB()`, which `main()` doesn't call until after this line has run).
loadEnvConfig(process.cwd());

import mongoose from "mongoose";

import { connectDB } from "@/lib/mongodb";
import { DEFAULT_USER_ROLE } from "@/lib/roles";
import User from "@/models/User";

async function main(): Promise<void> {
  await connectDB();

  // `finally`, not a trailing `disconnect()`: an open mongoose connection is
  // an active handle, so a throw partway through would otherwise leave the
  // process hanging instead of reporting the failure and exiting.
  try {
    const result = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: DEFAULT_USER_ROLE } },
    );

    console.log(
      `[backfill-user-roles] done: ${result.modifiedCount} document(s) updated (matched ${result.matchedCount}).`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[backfill-user-roles] failed:", error);
  process.exitCode = 1;
});
