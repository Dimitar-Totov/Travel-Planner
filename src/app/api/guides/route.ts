import { MongoServerError } from "mongodb";

import { auth } from "@/lib/auth";
import { findInvalidPhotoUrl } from "@/lib/guides/photoUrls";
import { connectDB } from "@/lib/mongodb";
import {
  draftGuideSchema,
  guideStatusSchema,
  nestedFieldErrorsOf,
  publishGuideSchema,
} from "@/lib/validation/guide";
import Guide from "@/models/Guide";

/**
 * POST /api/guides — create a guide, as a draft or published straight away.
 *
 * Body: the draft/publish shape validated by `src/lib/validation/guide.ts`
 * (`draftGuideSchema` for `status: "draft"` or an omitted `status`,
 * `publishGuideSchema` for `status: "published"`) — everything
 * `useCreateGuideForm` produces, minus every server-owned field (`author`,
 * `slug`, `likes`, `views`, `verified`, `dayCount`, `stopCount` — see that
 * module for why each is excluded).
 *
 * Responses:
 * - 201 `{ id, slug, status, createdAt }` (the full document is never echoed
 *   back — the client already holds the draft it just sent)
 * - 400 `{ error, fields: { [path]: message } }` on invalid input (nested
 *   paths like `"days.2.stops.5.lat"` — see `nestedFieldErrorsOf`), or
 *   `{ error }` for a request body that isn't valid JSON / isn't an object
 * - 401 `{ error }` if there is no signed-in session
 * - 409 `{ error }` if the derived slug collides with an existing guide
 * - 500 `{ error }` on unexpected failure, including R2 misconfiguration
 */
export async function POST(request: Request): Promise<Response> {
  // This is the only gate on this route. `src/proxy.ts`'s matcher excludes
  // all of `/api/*`, and `PROTECTED_PATHS` in `src/lib/auth.ts` is
  // intentionally empty (API routes are documented there as having to guard
  // themselves) — so without this check, any anonymous request could write a
  // guide document.
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "You must be signed in to create a guide." },
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

  // `status` defaults to "draft" (matching `Guide.ts`'s schema default) when
  // absent, and is validated on its own before either guide schema runs, so
  // its result decides *which* schema validates the rest of the body — a
  // "published" request has to satisfy every `requiredWhenPublished` field,
  // a "draft" one doesn't.
  const statusResult = guideStatusSchema.safeParse(
    bodyRecord.status ?? "draft",
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

  // Host-check every photo URL against R2's public bucket domain. This can't
  // live in `lib/validation/guide.ts` — that module is safe for a client
  // component to import and must stay free of server-only env reads — so it
  // lives in `lib/guides/photoUrls.ts` and runs here, right before the write.
  // (`PATCH /api/guides/[guideId]` runs the same check from the same module,
  // which is why it isn't a local function anymore.) Without it, an author could POST
  // `coverImageUrl: "https://anywhere.example/x.jpg"`, which would validate
  // fine (it *is* a URL), persist, and only fail later at render time against
  // `next/image`'s `remotePatterns` — a confusing failure far from its cause.
  const photoUrlIssue = findInvalidPhotoUrl(input);
  if (photoUrlIssue === "unconfigured") {
    // `src/lib/storage/r2.ts` has no exported getter for the base URL by
    // itself — `r2PublicUrl` builds a full URL from an object key, which
    // isn't useful for comparing an arbitrary incoming URL's host — and
    // adding one is outside this task's scope, so this route reads the same
    // `R2_PUBLIC_BASE_URL` env var `r2.ts` uses directly.
    console.error("[api/guides] R2_PUBLIC_BASE_URL is not configured");
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

  const slug = slugify(input.title);
  if (!slug) {
    return Response.json(
      {
        error: "Validation failed.",
        fields: { title: "Title must contain at least one letter or number." },
      },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    const guide = await Guide.create({
      ...input,
      slug,
      status,
      publishedAt: status === "published" ? new Date() : null,
      // The single most important line in this route: `author` comes from
      // the authenticated session, never from the request body. Trusting a
      // client-supplied `author` would let anyone forge authorship of a
      // guide onto another user's account.
      author: session.user.id,
    });

    return Response.json(
      {
        id: guide.id as string,
        slug: guide.slug,
        status: guide.status,
        createdAt: guide.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    // Rely on the unique index + this catch instead of a racy
    // find-then-create slug check, exactly as `/api/users` does for
    // username/email. A 409 asking the author to retitle (rather than
    // silently appending a discriminator to the slug) keeps the guide's URL
    // exactly what the title implies, and mirrors the convention
    // `/api/users` already established for a unique-index collision instead
    // of introducing a second one.
    if (error instanceof MongoServerError && error.code === 11000) {
      return Response.json(
        {
          error:
            "A guide with a matching URL slug already exists. Try a different title.",
        },
        { status: 409 },
      );
    }

    console.error("[api/guides] failed to create guide", error);
    return Response.json(
      { error: "Unexpected error while creating the guide." },
      { status: 500 },
    );
  }
}

/**
 * Slugifies `title` into a lowercase, hyphenated, URL-safe string — the
 * server-derived counterpart of `Guide.ts`'s unique `slug` index. Clients
 * never supply a slug (see `lib/validation/guide.ts`'s field-exclusion
 * comment); this is the only place one is produced.
 */
function slugify(title: string): string {
  const MAX_SLUG_LENGTH = 80;

  return (
    title
      .normalize("NFKD")
      // Strip the combining marks NFKD just split off, e.g. "é" -> "e".
      // Written as escapes, not literal combining characters: those are
      // invisible in an editor and a normalising tool could silently eat them.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, "")
  ); // the length cut above can re-expose a trailing hyphen
}
