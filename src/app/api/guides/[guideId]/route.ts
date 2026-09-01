import mongoose, { type HydratedDocument } from "mongoose";

import { auth } from "@/lib/auth";
import { findInvalidPhotoUrl } from "@/lib/guides/photoUrls";
import { connectDB } from "@/lib/mongodb";
import {
  draftGuideSchema,
  guideStatusSchema,
  nestedFieldErrorsOf,
  publishGuideSchema,
} from "@/lib/validation/guide";
import Guide, { type IGuide } from "@/models/Guide";

/**
 * The author-owned half of the guides API: edit (`PATCH`) and remove
 * (`DELETE`) one existing guide.
 *
 * `[guideId]` is the guide's **slug**, not its `_id` — the same segment value
 * `/destinations/guide/[guideId]/details` uses, so the client already has it
 * from the URL it's sitting on and never has to learn a second identifier.
 * `Guide.slug` is uniquely indexed, so it addresses exactly one document.
 *
 * Both handlers share `POST /api/guides`' conventions: `await auth()` is the
 * only gate (`src/proxy.ts`'s matcher excludes all of `/api/*` and
 * `PROTECTED_PATHS` in `src/lib/auth.ts` is intentionally empty, so a route
 * under `/api` that doesn't guard itself is wide open), the response body is
 * always a small JSON object rather than the whole document, and validation
 * failures come back as `{ error, fields }` with the dotted nested paths
 * `nestedFieldErrorsOf` produces.
 *
 * KNOWN GAP — deleting a guide orphans its photos. A guide document stores the
 * *resolved public URL* of each uploaded image, not the R2 object key (see the
 * Storage section of `CLAUDE.md` for why that trade-off was taken), so there
 * is no key here to hand `DeleteObjectCommand`. Reversing the URL back into a
 * key is possible today but would bake the current `R2_PUBLIC_BASE_URL` layout
 * into a destructive operation, and `R2_PUBLIC_BASE_URL` is explicitly the
 * swap-in seam for a future custom domain. Bucket cleanup is therefore not
 * implemented: deleted guides leave their objects in the bucket. The clean fix
 * is storing the key alongside the URL, which is a schema change and outside
 * this route's blast radius.
 */

/**
 * PATCH /api/guides/[guideId] — save an edit to a guide the caller authored.
 *
 * Body: the same draft/publish shape `POST /api/guides` takes, validated by
 * `src/lib/validation/guide.ts`. `status` is optional here (unlike the POST's
 * "default to draft"): omitting it keeps the guide at whatever status it
 * already has, so a plain edit of a published guide stays published and an
 * edit of a draft stays a draft. Sending `status: "published"` on a draft is
 * how an author publishes it.
 *
 * Responses:
 * - 200 `{ id, slug, status, updatedAt }`
 * - 400 `{ error, fields: { [path]: message } }` on invalid input (nested
 *   paths like `"days.2.stops.5.lat"`), or `{ error }` for a request body that
 *   isn't valid JSON / isn't an object
 * - 401 `{ error }` if there is no signed-in session
 * - 404 `{ error }` if no guide with that slug exists *or* it belongs to
 *   someone else — see `ownsGuide` for why those are one response
 * - 500 `{ error }` on unexpected failure, including R2 misconfiguration
 */
export async function PATCH(
  request: Request,
  // Typed inline rather than with `RouteContext<"/api/guides/[guideId]">`:
  // that helper is *generated* into `types/routes.d.ts` by `next dev`/`next
  // build`/`next typegen`, and this segment is new, so the literal isn't in
  // the generated union yet. CLAUDE.md forbids running a dev server or build
  // just to regenerate it (concurrent runs corrupt those files), and the
  // inline shape is exactly what the generated type resolves to anyway. Swap
  // it for `RouteContext<...>` the next time the app is legitimately rebuilt.
  ctx: { params: Promise<{ guideId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to edit a guide." },
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

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const bodyRecord = body as Record<string, unknown>;
  const { guideId: slug } = await ctx.params;

  let doc: HydratedDocument<IGuide> | null;
  try {
    await connectDB();
    // Deliberately NOT `.lean()`. The write below has to go through
    // `doc.save()` (see the block comment there), and `save()` needs a real
    // hydrated document with change tracking, not a plain object.
    doc = await Guide.findOne({ slug });
  } catch (error) {
    console.error(
      "[api/guides/[guideId]] failed to load guide for edit",
      error,
    );
    return Response.json(
      { error: "Unexpected error while loading the guide." },
      { status: 500 },
    );
  }

  if (!ownsGuide(doc, session.user.id)) {
    return Response.json(
      { error: "Guide not found, or you don't have permission to edit it." },
      { status: 404 },
    );
  }

  // `status` decides *which* schema validates the rest of the body, exactly as
  // in `POST /api/guides`, so it is parsed on its own first. The fallback is
  // the guide's current status rather than `"draft"`: an edit that doesn't
  // mention `status` must not silently unpublish a live guide.
  const statusResult = guideStatusSchema.safeParse(
    bodyRecord.status ?? doc.status,
  );
  if (!statusResult.success) {
    return Response.json(
      {
        error: "Validation failed.",
        fields: nestedFieldErrorsOf(statusResult.error),
      },
      { status: 400 },
    );
  }
  const status = statusResult.data;

  const schema = status === "published" ? publishGuideSchema : draftGuideSchema;
  const result = schema.safeParse(body);
  if (!result.success) {
    return Response.json(
      {
        error: "Validation failed.",
        fields: nestedFieldErrorsOf(result.error),
      },
      { status: 400 },
    );
  }

  const input = result.data;

  // Same host check `POST /api/guides` runs, from the same module
  // (`lib/guides/photoUrls.ts`). An edit can introduce a brand-new photo URL,
  // so it needs the check just as much as a create does — without it an author
  // could swap a legitimately uploaded cover for a URL on any host, which
  // would validate fine as a URL, persist, and only fail later at render time
  // against `next/image`'s `remotePatterns`.
  const photoUrlIssue = findInvalidPhotoUrl(input);
  if (photoUrlIssue === "unconfigured") {
    console.error(
      "[api/guides/[guideId]] R2_PUBLIC_BASE_URL is not configured",
    );
    return Response.json(
      { error: "Photo storage is not configured." },
      { status: 500 },
    );
  }
  if (photoUrlIssue) {
    return Response.json(
      {
        error: "Validation failed.",
        fields: { [photoUrlIssue.field]: photoUrlIssue.message },
      },
      { status: 400 },
    );
  }

  const previousStatus = doc.status;

  doc.title = input.title;
  doc.heroTitle = input.heroTitle;
  doc.heroAccent = input.heroAccent;
  doc.blurb = input.blurb;
  doc.intro = input.intro;
  doc.tags = input.tags;
  doc.generalTips = input.generalTips;
  doc.currency = input.currency;
  doc.bestTime = input.bestTime;
  doc.status = status;

  // `doc.set("days", …)` rather than `doc.days = …`: `IGuideDay`/`IGuideStop`
  // declare the `_id` mongoose mints for every subdocument, so a plain array
  // off the wire isn't assignable to the typed property. `set` is the same
  // code path a property assignment takes anyway, and casts the plain objects
  // into real subdocuments.
  //
  // This replaces the array wholesale, so every day/stop `_id` is regenerated.
  // Nothing references them (the editor keys its own rows by `DraftDay.id`,
  // and no endpoint addresses a single stop), and the payload carries no ids
  // to preserve them by — flagged here so a future per-stop endpoint doesn't
  // assume they're stable across an edit.
  doc.set("days", input.days);

  if (input.coverImageUrl !== undefined) {
    doc.coverImageUrl = input.coverImageUrl;
  } else {
    // Only reachable on a draft save — `publishGuideSchema` makes
    // `coverImageUrl` required, so a published save can never land here and
    // strand a guide with no cover. Setting the path to `undefined` makes
    // `save()` emit a real `$unset` rather than persist an empty string, which
    // is what `getGuideForAuthor` normalises to `null`.
    doc.set("coverImageUrl", undefined);
  }

  // Stamp `publishedAt` only on the draft -> published transition. Re-stamping
  // it on every save would make an edit look like a fresh publication
  // everywhere it's rendered (`formatPublishedAt` in `services/guides.ts`),
  // and clearing it on a published -> draft unpublish would lose the original
  // date if the author re-published later.
  if (previousStatus !== "published" && status === "published") {
    doc.publishedAt = new Date();
  }

  // `author` is never reassigned here, for the same reason `POST` never reads
  // it from the body: it is the authorship claim, and the ownership check
  // above is only meaningful while it stays fixed.
  //
  // `likes`, `views`, `verified`, `dayCount` and `stopCount` are equally
  // untouched. They aren't fields on either Zod schema (see the field-exclusion
  // comment in `lib/validation/guide.ts`), so they're stripped from `input`
  // before this point and there is nothing to assign even by accident.

  try {
    // `save()` is mandatory, not a style choice. `Guide.ts`'s `pre("save")`
    // hook is what recomputes `dayCount`/`stopCount` from `days`, and
    // `findOneAndUpdate`/`updateOne` skip document middleware entirely — an
    // update-path write of `days` would leave both counts stale, which
    // silently breaks `/destinations`' "Weekends" tab (it filters on the
    // stored `dayCount`, precisely so the filter can use an index instead of
    // `$size`). `Guide.ts` says this in its own hook comment; it is repeated
    // here because this is the route that would break it.
    await doc.save();
  } catch (error) {
    // A Mongoose `ValidationError` is the schema's last line of defense
    // firing — the Zod pass above should have caught anything a client can
    // cause, so this is either drift between the two or a constraint only the
    // model expresses. Its `errors` map is already keyed by dotted path
    // (`"days.0.stops.1.lat"`), the same shape `nestedFieldErrorsOf` produces,
    // so it's remapped into `fields` rather than surfaced as a 500: the client
    // renders one error shape regardless of which layer rejected the write.
    if (error instanceof mongoose.Error.ValidationError) {
      return Response.json(
        {
          error: "Validation failed.",
          fields: fieldsFromValidationError(error),
        },
        { status: 400 },
      );
    }

    console.error("[api/guides/[guideId]] failed to save guide", error);
    return Response.json(
      { error: "Unexpected error while saving the guide." },
      { status: 500 },
    );
  }

  return Response.json(
    {
      id: doc.id as string,
      slug: doc.slug,
      status: doc.status,
      updatedAt: doc.updatedAt,
    },
    { status: 200 },
  );
}

/**
 * DELETE /api/guides/[guideId] — permanently remove a guide the caller
 * authored. There is no soft-delete/archive state: `Guide.status` is
 * `"draft" | "published"` and widening it is a schema change, so this is a
 * real delete and the client is expected to confirm before calling it.
 *
 * Responses:
 * - 200 `{ ok: true, slug }` — 200 with a body rather than 204, so the client
 *   gets the slug it just removed back and can reconcile a list without
 *   re-reading the URL it called
 * - 401 `{ error }` if there is no signed-in session
 * - 404 `{ error }` if no guide with that slug exists *or* it belongs to
 *   someone else — see `ownsGuide`
 * - 500 `{ error }` on unexpected failure
 *
 * See the module doc comment: the guide's uploaded R2 objects are **not**
 * removed with it.
 */
export async function DELETE(
  _request: Request,
  // See the PATCH handler for why this is typed inline.
  ctx: { params: Promise<{ guideId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to delete a guide." },
      { status: 401 },
    );
  }

  const { guideId: slug } = await ctx.params;

  try {
    await connectDB();

    const doc = await Guide.findOne({ slug });

    if (!ownsGuide(doc, session.user.id)) {
      return Response.json(
        {
          error: "Guide not found, or you don't have permission to delete it.",
        },
        { status: 404 },
      );
    }

    await doc.deleteOne();

    return Response.json({ ok: true, slug: doc.slug }, { status: 200 });
  } catch (error) {
    console.error("[api/guides/[guideId]] failed to delete guide", error);
    return Response.json(
      { error: "Unexpected error while deleting the guide." },
      { status: 500 },
    );
  }
}

/**
 * True when `doc` exists and `userId` is its author — the single condition
 * both handlers turn into a 404.
 *
 * "Doesn't exist" and "isn't yours" are deliberately collapsed into one
 * response, and it's a 404 rather than a 403. A 403 would confirm that a guide
 * with that slug exists, which is exactly the probe an attacker wants: slugs
 * are derived from titles and therefore guessable, and drafts are otherwise
 * invisible (`getPublishedGuideDetail` filters on `status: "published"`). A
 * distinguishable response would let anyone enumerate other authors' unpublished
 * work by title, so both cases answer identically.
 *
 * Written as a type predicate so the caller keeps the narrowed, non-null
 * document afterwards.
 */
function ownsGuide(
  doc: HydratedDocument<IGuide> | null,
  userId: string,
): doc is HydratedDocument<IGuide> {
  // `author` is an `ObjectId` and `session.user.id` is its hex string, so the
  // comparison has to go through `toString()` — `==`/`===` between the two is
  // always false.
  return doc !== null && doc.author.toString() === userId;
}

/**
 * Remaps a Mongoose `ValidationError` into the same `{ [path]: message }` map
 * `nestedFieldErrorsOf` builds from a `ZodError`, so a client has exactly one
 * error shape to render no matter which layer rejected the write. Mongoose
 * already keys `error.errors` by full dotted path for embedded documents
 * (`"days.0.stops.1.lat"`), which is the format `nestedFieldErrorsOf` produces
 * too, so this only has to pull each entry's message across.
 */
function fieldsFromValidationError(
  error: mongoose.Error.ValidationError,
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const [path, issue] of Object.entries(error.errors)) {
    fields[path] = issue.message;
  }

  return fields;
}
