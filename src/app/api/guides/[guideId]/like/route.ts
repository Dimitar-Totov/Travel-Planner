import type { Types } from "mongoose";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Guide from "@/models/Guide";
import Like from "@/models/Like";
import {
  consumeRateLimit,
  likeGlobalKey,
  likeGuideKey,
  LIKE_GLOBAL_LIMIT,
  LIKE_PER_GUIDE_LIMIT,
} from "@/services/rateLimit";

/**
 * POST /api/guides/[guideId]/like — toggle the signed-in user's like on one
 * published guide.
 *
 * `[guideId]` is the guide's **slug**, matching every other route under
 * `/api/guides/[guideId]`.
 *
 * Responses:
 * - 200 `{ liked, likeCount }` — `liked` is the *new* membership state after
 *   the toggle, `likeCount` is the guide's up-to-date like count
 * - 401 `{ error }` if there is no signed-in session
 * - 404 `{ error }` if no guide with that slug is published — mirrors
 *   `getPublishedGuideDetail`'s own visibility rule
 * - 429 `{ error, retryAfterSeconds }` if the signed-in user is liking too
 *   quickly — see the rate-limit check below
 * - 500 `{ error }` on unexpected failure
 *
 * The rate-limit check runs before the guide lookup on purpose, for two
 * reasons: it caps the cost of hammering a slug that doesn't exist or isn't
 * published (a `Guide.findOne` per attempt otherwise), and it can never leak
 * slug-existence information to an unauthenticated caller, since the 401
 * check above it already turns those away first.
 *
 * A benign, acceptable race exists between the membership read and the
 * find-and-update write under a rapid double-click — this app doesn't reach
 * for transactions anywhere else for a similarly low-stakes toggle, so this
 * doesn't either.
 */
export async function POST(
  _request: Request,
  // Typed inline rather than with `RouteContext<...>`: that helper is
  // *generated* into `types/routes.d.ts` by `next dev`/`next build`/`next
  // typegen`, and this segment is brand new, so the literal isn't in the
  // generated union yet. See `src/app/api/guides/[guideId]/route.ts` for the
  // same convention.
  ctx: { params: Promise<{ guideId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to like a guide." },
      { status: 401 },
    );
  }

  const { guideId: slug } = await ctx.params;

  // Sequential, not `Promise.all`'d — this order is load-bearing. If both
  // buckets were consumed in parallel, a request already blocked by the
  // global limit would still burn its per-guide budget on every hammered
  // attempt, a silent escalation. Checking the global bucket first and only
  // consuming the per-guide bucket when it allows keeps a blocked user's
  // per-guide budget untouched.
  const globalResult = await consumeRateLimit(
    likeGlobalKey(session.user.id),
    LIKE_GLOBAL_LIMIT,
  );
  if (!globalResult.allowed) {
    return Response.json(
      {
        error: "You're liking too quickly. Try again in about a minute.",
        retryAfterSeconds: globalResult.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  const perGuideResult = await consumeRateLimit(
    likeGuideKey(session.user.id, slug),
    LIKE_PER_GUIDE_LIMIT,
  );
  if (!perGuideResult.allowed) {
    return Response.json(
      {
        error:
          "You're liking this guide too quickly. Try again in about a minute.",
        retryAfterSeconds: perGuideResult.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  try {
    await connectDB();

    const guideDoc = await Guide.findOne({ slug, status: "published" })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    if (!guideDoc) {
      return Response.json({ error: "Guide not found." }, { status: 404 });
    }

    const alreadyLiked = Boolean(
      await Like.exists({ guide: guideDoc._id, users: session.user.id }),
    );

    const updated = await Like.findOneAndUpdate(
      { guide: guideDoc._id },
      alreadyLiked
        ? { $pull: { users: session.user.id } }
        : { $addToSet: { users: session.user.id } },
      { upsert: true, returnDocument: "after" },
    )
      .select("users")
      .lean<{ users: unknown[] } | null>();

    return Response.json(
      { liked: !alreadyLiked, likeCount: updated?.users.length ?? 0 },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/guides/[guideId]/like] failed to toggle like", error);
    return Response.json(
      { error: "Unexpected error while updating your like." },
      { status: 500 },
    );
  }
}
