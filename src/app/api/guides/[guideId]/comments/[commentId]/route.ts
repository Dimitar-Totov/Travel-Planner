import mongoose, { Types, type HydratedDocument } from "mongoose";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { createCommentSchema } from "@/lib/validation/comment";
import Comment, { type IComment } from "@/models/Comment";
import Guide from "@/models/Guide";

/**
 * The author-owned half of the comments API: edit (`PATCH`) and remove
 * (`DELETE`) one existing comment on a published guide.
 *
 * `[guideId]` is the guide's **slug**, matching every other route under
 * `/api/guides/[guideId]` (including the parent `comments` route this one is
 * a sibling of). `[commentId]` is the `Comment` document's `_id` as a hex
 * string — there is no second, human-facing identifier for a single comment
 * the way a guide has a slug, so the client is handed this one straight off
 * the `GET`/`POST` responses on the parent route.
 *
 * Both handlers share the parent route's conventions: `await auth()` is the
 * only gate (`src/proxy.ts`'s matcher excludes all of `/api/*` and
 * `PROTECTED_PATHS` in `src/lib/auth.ts` is intentionally empty, so a route
 * under `/api` that doesn't guard itself is wide open), and the response body
 * on success deliberately matches the shape `GET`/`POST
 * /api/guides/[guideId]/comments` already return, so the existing
 * client-side parser can be reused unchanged.
 *
 * Ownership here answers **403**, not 404 — the opposite of
 * `ownsGuide`'s choice in `src/app/api/guides/[guideId]/route.ts`. That route
 * collapses "no such guide" and "not yours" into one 404 because a guide's
 * slug is guessable and a *draft* is otherwise completely invisible
 * (`getPublishedGuideDetail` filters on `status: "published"`) — a
 * distinguishable 403 there would be a working oracle for enumerating other
 * authors' unpublished work by title. None of that applies to a comment: its
 * existence, its text, and the guide it's on are already fully public via the
 * `GET` on the parent route, with no auth required to read any of it. There
 * is nothing left to hide behind an identical-looking 404, so a non-owner
 * gets a plain, honest 403.
 */

/**
 * PATCH /api/guides/[guideId]/comments/[commentId] — edit a comment the
 * caller authored.
 *
 * Body: `{ comment: string }`, validated by `createCommentSchema`
 * (`src/lib/validation/comment.ts`) — the identical shape `POST` on the
 * parent route takes, reused as-is since an edit's input constraints are the
 * same as a create's.
 *
 * Responses:
 * - 200 `{ id, username, comment, createdAt }` — the same shape `GET`/`POST`
 *   on the parent route return (no `updatedAt`), so the existing
 *   client-side parser can be reused unchanged
 * - 400 `{ error, fields: { [path]: message } }` on invalid input, or
 *   `{ error }` for a request body that isn't valid JSON / isn't an object
 * - 401 `{ error }` if there is no signed-in session
 * - 403 `{ error }` if the comment exists but belongs to someone else — see
 *   the module doc comment for why this is a 403 and not a 404
 * - 404 `{ error: "Guide not found." }` if no guide with that slug is
 *   published — mirrors `getPublishedGuideDetail`'s own visibility rule
 * - 404 `{ error: "Comment not found." }` if no comment with that id exists
 *   on that guide, **or** `commentId` isn't a syntactically valid ObjectId —
 *   a malformed id behaves identically to "not found" from the caller's
 *   perspective rather than surfacing as a 500
 * - 500 `{ error }` on unexpected failure
 */
export async function PATCH(
  request: Request,
  // Typed inline rather than with
  // `RouteContext<"/api/guides/[guideId]/comments/[commentId]">`: that helper
  // is *generated* into `types/routes.d.ts` by `next dev`/`next build`/`next
  // typegen`, and this segment is brand new, so the literal isn't in the
  // generated union yet. See the parent `comments/route.ts` for the same
  // convention.
  ctx: { params: Promise<{ guideId: string; commentId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to edit a comment." },
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

  const { guideId: slug, commentId } = await ctx.params;

  try {
    await connectDB();

    const guideDoc = await Guide.findOne({ slug, status: "published" })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    if (!guideDoc) {
      return Response.json({ error: "Guide not found." }, { status: 404 });
    }

    const comment = await findOwnComment(commentId, guideDoc._id);

    if (comment === "not-found") {
      return Response.json({ error: "Comment not found." }, { status: 404 });
    }

    if (comment.user.toString() !== session.user.id) {
      return Response.json(
        { error: "You can only edit your own comments." },
        { status: 403 },
      );
    }

    comment.comment = result.data.comment;
    await comment.save();

    return Response.json(
      {
        id: comment.id as string,
        // The comment's author *is* the signed-in user, so there's nothing
        // to look up — no extra query/populate needed, same as the parent
        // route's `POST`.
        username: session.user.username,
        comment: comment.comment,
        createdAt: comment.createdAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[api/guides/[guideId]/comments/[commentId]] failed to edit comment",
      error,
    );
    return Response.json(
      { error: "Unexpected error while editing your comment." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/guides/[guideId]/comments/[commentId] — remove a comment the
 * caller authored.
 *
 * Responses:
 * - 200 `{ ok: true, id }` — mirrors the guide `DELETE` route's
 *   `{ ok: true, slug }` convention
 * - 401 `{ error }` if there is no signed-in session
 * - 403 `{ error }` if the comment exists but belongs to someone else — see
 *   the module doc comment for why this is a 403 and not a 404
 * - 404 `{ error: "Guide not found." }` if no guide with that slug is
 *   published
 * - 404 `{ error: "Comment not found." }` if no comment with that id exists
 *   on that guide, or `commentId` isn't a syntactically valid ObjectId
 * - 500 `{ error }` on unexpected failure
 */
export async function DELETE(
  _request: Request,
  // See the PATCH handler above for why this is typed inline.
  ctx: { params: Promise<{ guideId: string; commentId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to delete a comment." },
      { status: 401 },
    );
  }

  const { guideId: slug, commentId } = await ctx.params;

  try {
    await connectDB();

    const guideDoc = await Guide.findOne({ slug, status: "published" })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    if (!guideDoc) {
      return Response.json({ error: "Guide not found." }, { status: 404 });
    }

    const comment = await findOwnComment(commentId, guideDoc._id);

    if (comment === "not-found") {
      return Response.json({ error: "Comment not found." }, { status: 404 });
    }

    if (comment.user.toString() !== session.user.id) {
      return Response.json(
        { error: "You can only delete your own comments." },
        { status: 403 },
      );
    }

    await comment.deleteOne();

    return Response.json({ ok: true, id: commentId }, { status: 200 });
  } catch (error) {
    console.error(
      "[api/guides/[guideId]/comments/[commentId]] failed to delete comment",
      error,
    );
    return Response.json(
      { error: "Unexpected error while deleting your comment." },
      { status: 500 },
    );
  }
}

/**
 * Looks up one comment by id, scoped to the guide it must belong to, and
 * normalizes the "malformed id" and "no such document" cases into a single
 * `"not-found"` sentinel so every caller treats them identically — a
 * transposed character in a URL path isn't distinguishable from a comment
 * that was already deleted, and neither should surface as a 500.
 *
 * Deliberately NOT `.lean()`: both callers need a real hydrated document —
 * `PATCH` calls `.save()`, `DELETE` calls `.deleteOne()` — and `.lean()`
 * returns a plain object with neither method.
 */
async function findOwnComment(
  commentId: string,
  guideId: Types.ObjectId,
): Promise<HydratedDocument<IComment> | "not-found"> {
  if (!mongoose.isValidObjectId(commentId)) {
    return "not-found";
  }

  const comment = await Comment.findOne({ _id: commentId, guide: guideId });

  return comment ?? "not-found";
}
