/**
 * The R2-bucket host check for a guide's photo URLs, shared by every write
 * endpoint on the `guides` collection (`POST /api/guides`,
 * `PATCH /api/guides/[guideId]`).
 *
 * Deliberately *not* part of `src/lib/validation/guide.ts`, even though it
 * reads like validation: that module is safe for a client component to import
 * (a pre-flight parse before the round trip, the pattern `SignUpForm` uses)
 * and must stay free of server-only env reads. This check needs
 * `R2_PUBLIC_BASE_URL`, a server-only var, so it lives here instead — one
 * definition rather than a copy per route, since two copies of a host
 * allowlist are two chances to fix only one of them.
 *
 * Server-only. Never import this from a client component.
 */

export type PhotoUrlIssue =
  null | "unconfigured" | { field: string; message: string };

/**
 * The only part of a validated guide payload this check reads. Structural
 * rather than `DraftGuideInput | PublishGuideInput` so both of those (and
 * anything else carrying the same two photo-bearing shapes) satisfy it
 * without this module having to depend on the validation schemas — and so a
 * caller holding the *union* of the two doesn't have to convince TypeScript
 * that `days.forEach` is callable across it.
 */
export interface GuidePhotoUrlSource {
  coverImageUrl?: string;
  days: ReadonlyArray<{ stops: ReadonlyArray<{ photoUrl?: string }> }>;
}

/**
 * Walks every photo URL in a validated guide input (`coverImageUrl`, each
 * stop's `photoUrl`) and confirms it points at this app's own R2 public
 * bucket rather than an arbitrary host. Returns the first problem found:
 * `"unconfigured"` if `R2_PUBLIC_BASE_URL` itself isn't set (a server
 * misconfiguration, not a client error), a `{ field, message }` pair naming
 * the offending path (e.g. `"days.2.stops.5.photoUrl"`) if a URL doesn't
 * match, or `null` if every photo URL present is fine (including the common
 * case of no photo URLs at all).
 *
 * The env var is read at call time, not at module evaluation, following the
 * convention `lib/mongodb.ts` and `lib/storage/r2.ts` already set — a build
 * without it configured must not crash before this is ever invoked.
 */
export function findInvalidPhotoUrl(input: GuidePhotoUrlSource): PhotoUrlIssue {
  const candidates: Array<{ field: string; url: string | undefined }> = [
    { field: "coverImageUrl", url: input.coverImageUrl },
  ];

  input.days.forEach((day, dayIndex) => {
    day.stops.forEach((stop, stopIndex) => {
      candidates.push({
        field: `days.${dayIndex}.stops.${stopIndex}.photoUrl`,
        url: stop.photoUrl,
      });
    });
  });

  const present = candidates.filter(
    (candidate): candidate is { field: string; url: string } =>
      typeof candidate.url === "string",
  );
  if (present.length === 0) {
    return null;
  }

  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    return "unconfigured";
  }

  let baseHost: string;
  try {
    baseHost = new URL(base).host;
  } catch {
    return "unconfigured";
  }

  for (const candidate of present) {
    // Already validated as a well-formed http(s) URL by `httpUrlSchema`, so
    // this `new URL` cannot itself throw — but guard it anyway rather than
    // assume a validator upstream never changes.
    let host: string;
    try {
      host = new URL(candidate.url).host;
    } catch {
      return { field: candidate.field, message: "Must be a valid URL." };
    }

    if (host !== baseHost) {
      return {
        field: candidate.field,
        message: "Photo URL must point to this app's storage bucket.",
      };
    }
  }

  return null;
}
