import { connectDB } from "@/lib/mongodb";
import RateLimit from "@/models/RateLimit";

/**
 * Server-side rate limiting on top of the `ratelimits` collection
 * (`src/models/RateLimit.ts`). Mongo-only, fixed-window, TTL-reaped — no
 * Redis or in-process store anywhere in this stack, because `lib/mongodb.ts`
 * already documents why an in-process store would be wrong here: the client
 * is cached on `globalThis` specifically to survive warm serverless
 * invocations, which is exactly the situation where "in memory" doesn't mean
 * "one persistent process" and a per-instance limiter would silently under-
 * or over-count.
 *
 * Never import this module from a client component — it calls `connectDB()`
 * directly, the same as every exported function in
 * `src/services/refreshTokens.ts`.
 */

export interface RateLimitPolicy {
  /** Requests allowed per window, inclusive. The (limit + 1)th is denied. */
  limit: number;
  windowMs: number;
}

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** 30 likes/minute across every guide, per user. */
export const LIKE_GLOBAL_LIMIT: RateLimitPolicy = {
  limit: 30,
  windowMs: 60_000,
};

/** 6 likes/minute against one specific guide, per user. */
export const LIKE_PER_GUIDE_LIMIT: RateLimitPolicy = {
  limit: 6,
  windowMs: 60_000,
};

/**
 * 5 comments per 10 minutes, per user, across every guide. Burst-only by
 * design — there is deliberately no companion daily/hourly tier. A second
 * tier adds a second bucket to check (and reason about ordering for) for a
 * limit this app doesn't otherwise need; the burst window alone was judged
 * sufficient to stop a script hammering the endpoint, which is the actual
 * threat model here, not a prolific-but-slow human commenter.
 */
export const COMMENT_BURST_LIMIT: RateLimitPolicy = {
  limit: 5,
  windowMs: 10 * 60_000,
};

/**
 * Same length cap `slugify` (`src/app/api/guides/route.ts`) applies when it
 * mints a slug. `[guideId]` in the like/comment routes is arbitrary,
 * attacker-controlled path input — it is never validated against a real
 * guide before the rate-limit check runs (the whole point is to cap the cost
 * of hammering a slug that doesn't exist) — so without a cap here a long
 * enough path segment could build a key past Mongo's 1024-byte index-key
 * limit. Truncating loses nothing real: no published guide's slug is longer
 * than this anyway, so two different overlong inputs sharing a truncated key
 * only ever collide on requests that couldn't have matched a guide either.
 */
const MAX_SLUG_LENGTH = 80;

export function likeGlobalKey(userId: string): string {
  return `like:all:${userId}`;
}

export function likeGuideKey(userId: string, slug: string): string {
  return `like:guide:${userId}:${slug.slice(0, MAX_SLUG_LENGTH)}`;
}

export function commentBurstKey(userId: string): string {
  return `comment:burst:${userId}`;
}

/**
 * Consumes one request against `key`'s current fixed window, creating the
 * window's document on first use.
 *
 * Buckets belonging to the same request must be checked **sequentially**,
 * never with `Promise.all`. Checking two buckets for one action in parallel
 * means a request already blocked by one bucket still spends its budget in
 * the other — e.g. a user hammering the like endpoint while blocked by their
 * global limit would keep burning their per-guide budget on every attempt,
 * a silent escalation the ordered/sequential check in the route handlers is
 * built to avoid. See the like route for the concrete case.
 *
 * Denied requests still increment their window's counter (there is no
 * separate "rejected" counter), but `retryAfterSeconds` only ever shrinks
 * toward the window's fixed end as more of it elapses — it never grows, and
 * repeated hits never escalate the penalty. There is no lockout/ban state
 * anywhere in this module and none should be added; a fixed window that
 * simply closes is the entire mechanism.
 *
 * Fails open on any error other than the upsert race handled below: if
 * Mongo is unreachable, logs once and returns `{ allowed: true }` rather
 * than denying the request. The write this is guarding will itself hit the
 * same unreachable database moments later and fail with its own 500, so
 * failing open here doesn't hand an attacker anything extra — the request
 * doesn't actually succeed either way — while failing closed would block a
 * legitimate user for an infrastructure fault that has nothing to do with
 * them. Same philosophy `rotateRefreshToken` documents for a database blip
 * on an unrelated query.
 */
export async function consumeRateLimit(
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  try {
    await connectDB();

    const now = Date.now();
    const windowStart = new Date(
      Math.floor(now / policy.windowMs) * policy.windowMs,
    );
    const expiresAt = new Date(windowStart.getTime() + policy.windowMs);

    const count = await incrementWindow(key, windowStart, expiresAt);

    if (count > policy.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (windowStart.getTime() + policy.windowMs - Date.now()) / 1000,
        ),
      );
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[services/rateLimit] failed to check rate limit", error);
    return { allowed: true };
  }
}

/**
 * The single `findOneAndUpdate` upsert, factored out so the one expected
 * race — two concurrent first-requests of a brand-new window both trying to
 * insert — can retry once. Mongo reports that race as an E11000 duplicate-
 * key error on the `{ key, windowStart }` unique index, exactly the
 * "unique index + catch the collision" pattern `POST /api/users` and
 * `POST /api/guides` already use for email/slug collisions rather than a
 * racy pre-check. The retry finds the winner's now-existing document and
 * simply `$inc`s it.
 */
async function incrementWindow(
  key: string,
  windowStart: Date,
  expiresAt: Date,
): Promise<number> {
  try {
    return await upsertAndIncrement(key, windowStart, expiresAt);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return await upsertAndIncrement(key, windowStart, expiresAt);
    }
    throw error;
  }
}

async function upsertAndIncrement(
  key: string,
  windowStart: Date,
  expiresAt: Date,
): Promise<number> {
  const doc = await RateLimit.findOneAndUpdate(
    { key, windowStart },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, new: true },
  )
    .select("count")
    .lean<{ count: number } | null>();

  // `doc` is only ever null if `findOneAndUpdate` somehow neither found nor
  // created a document, which upsert:true rules out — narrowed for the
  // type checker, not a real runtime branch.
  return doc?.count ?? 1;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
