import type { Types } from "mongoose";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { createCommentSchema } from "@/lib/validation/comment";
// Side-effect import, and load-bearing: `.populate({ path: "user", ... })`
// below resolves `Comment.user`'s `ref: "User"` through mongoose's model
// registry, and a model only lands in that registry when its module is
// evaluated. Without this the populate throws `MissingSchemaError: Schema
// hasn't been registered for model "User"`. `src/services/guides.ts` carries
// the same import for the same reason against `Guide.author` — this route
// needs its own copy since it's its own module and can't rely on another
// module having been evaluated first.
import "@/models/User";
import Comment from "@/models/Comment";
import Guide from "@/models/Guide";

/**
 * GET /api/guides/[guideId]/comments — a published guide's comment thread,
 * newest first.
 *
 * `[guideId]` is the guide's **slug**, matching every other route under
 * `/api/guides/[guideId]`. No auth required — reading a published guide's
 * comments is anonymous-friendly, exactly like the guide detail page itself
 * (`src/proxy.ts`'s matcher already excludes all of `/api/*`, and
 * `PROTECTED_PATHS` in `src/lib/auth.ts` is empty).
 *
 * Responses:
 * - 200 `{ comments: [{ id, username, comment, createdAt }] }`, sorted
 *   newest-first — load-bearing: consumers trust this order and do not
 *   re-sort client-side.
 * - 404 `{ error }` if no guide with that slug is published — mirrors
 *   `getPublishedGuideDetail`'s own visibility rule (a draft or unknown slug
 *   is invisible).
 * - 500 `{ error }` on unexpected failure
 */
export async function GET(
  _request: Request,
  // Typed inline rather than with `RouteContext<"/api/guides/[guideId]/comments">`:
  // that helper is *generated* into `types/routes.d.ts` by `next dev`/`next
  // build`/`next typegen`, and this segment is brand new, so the literal isn't
  // in the generated union yet. See `src/app/api/guides/[guideId]/route.ts`
  // for the same convention.
  ctx: { params: Promise<{ guideId: string }> },
): Promise<Response> {
  try {
    await connectDB();

    const { guideId: slug } = await ctx.params;

    const guideDoc = await Guide.findOne({ slug, status: "published" })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    if (!guideDoc) {
      return Response.json({ error: "Guide not found." }, { status: 404 });
    }

    const commentDocs = await Comment.find({ guide: guideDoc._id })
      .sort({ createdAt: -1 })
      .populate({ path: "user", select: "username" })
      .lean<
        {
          _id: Types.ObjectId;
          user: { username: string } | null;
          comment: string;
          createdAt: Date;
        }[]
      >();

    const comments = commentDocs.map((doc) => ({
      id: String(doc._id),
      // "Traveler" mirrors `FALLBACK_AUTHOR_NAME` in `src/services/guides.ts`
      // — same fallback for a populated reference that no longer resolves
      // (a deleted user).
      username: doc.user?.username ?? "Traveler",
      comment: doc.comment,
      createdAt: doc.createdAt.toISOString(),
    }));

    return Response.json({ comments }, { status: 200 });
  } catch (error) {
    console.error(
      "[api/guides/[guideId]/comments] failed to load comments",
      error,
    );
    return Response.json(
      { error: "Unexpected error while loading comments." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/guides/[guideId]/comments — leave a comment on a published guide.
 *
 * `[guideId]` is the guide's **slug**, matching every other route under
 * `/api/guides/[guideId]`. Auth-gated — commenting requires a signed-in
 * session, unlike the `GET` above.
 *
 * Body: `{ comment: string }`, validated by `createCommentSchema`
 * (`src/lib/validation/comment.ts`).
 *
 * Responses:
 * - 201 `{ id, username, comment, createdAt }`
 * - 400 `{ error, fields: { [path]: message } }` on invalid input, or
 *   `{ error }` for a request body that isn't valid JSON / isn't an object
 * - 401 `{ error }` if there is no signed-in session
 * - 404 `{ error }` if no guide with that slug is published — mirrors
 *   `getPublishedGuideDetail`'s own visibility rule
 * - 500 `{ error }` on unexpected failure
 */
export async function POST(
  request: Request,
  // See the `GET` handler above for why this is typed inline.
  ctx: { params: Promise<{ guideId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to comment." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const result = createCommentSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      {
        error: "Validation failed.",
        fields: fieldErrorsOf(result.error),
      },
      { status: 400 },
    );
  }

  const { guideId: slug } = await ctx.params;

  try {
    await connectDB();

    const guideDoc = await Guide.findOne({ slug, status: "published" })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    if (!guideDoc) {
      return Response.json({ error: "Guide not found." }, { status: 404 });
    }

    const created = await Comment.create({
      guide: guideDoc._id,
      user: session.user.id,
      comment: result.data.comment,
    });

    return Response.json(
      {
        id: created.id as string,
        // The comment's author *is* the signed-in user, so there's nothing
        // to look up — no extra query/populate needed.
        username: session.user.username,
        comment: created.comment,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "[api/guides/[guideId]/comments] failed to create comment",
      error,
    );
    return Response.json(
      { error: "Unexpected error while posting your comment." },
      { status: 500 },
    );
  }
}
