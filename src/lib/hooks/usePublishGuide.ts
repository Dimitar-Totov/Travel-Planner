"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuideDay, GuideStop } from "@/lib/itinerary";
import type { CreateGuideFormState } from "@/lib/hooks/useCreateGuideForm";
import {
  UploadAuthError,
  isAbortError,
  uploadGuidePhotos,
  type PhotoUploadTask,
} from "@/lib/uploadGuidePhotos";
import {
  nestedFieldErrorsOf,
  publishGuideSchema,
} from "@/lib/validation/guide";

/**
 * Publishing a draft: pre-flight, upload every photo, `POST /api/guides`.
 *
 * Lives here rather than in `CreateGuidePageShell` for the same reason
 * `useCreateGuideForm` does — the shell is already the mode switch, the sticky
 * bar and the map-instance gate — and follows the same convention as it and
 * `useGuideDetail`: flat state plus actions, no reducer, no context.
 *
 * The order of the three steps is load-bearing. The pre-flight runs *before*
 * the uploads so an author with a half-written guide isn't made to wait through
 * twenty megabytes of PUTs only to be told the intro is empty, and the uploads
 * run before the POST because `publishGuideSchema` will not accept a data URL
 * for `coverImageUrl` and the route host-checks every photo URL against the R2
 * bucket. Nothing here is the enforcement point: `POST /api/guides` re-validates
 * with the same schema regardless, exactly as `SignUpForm`'s `registerSchema`
 * pre-flight is only a saved round trip.
 */

/**
 * The pre-flight shape: `publishGuideSchema` minus the one field that cannot
 * exist yet.
 *
 * Derived with `.omit()` rather than written out, so every other rule — bounds,
 * "add an intro before publishing", coordinate ranges — stays the server's
 * single definition of publish-ready. `coverImageUrl` is the sole exception
 * because at pre-flight time the cover is still a `data:` URL that
 * `httpUrlSchema` would (correctly) reject; "is there a cover at all" is
 * checked separately below and the real URL is validated by the route once the
 * upload has produced one.
 */
const PREFLIGHT_SCHEMA = publishGuideSchema.omit({ coverImageUrl: true });

/** Upload-task key for the guide's cover photo. Stop keys are prefixed so they
 *  can never collide with it. */
const COVER_KEY = "cover";
const stopKey = (stopId: string) => `stop:${stopId}`;

const NO_PHOTO_URLS: ReadonlyMap<string, string> = new Map();

const AUTH_MESSAGE =
  "Publishing needs an account, and you're not signed in. Sign in in a new tab, then come back to this one and press Publish again — your draft stays exactly where it is.";

export type PublishPhase = "idle" | "uploading" | "saving" | "done";

export type PublishFailureKind =
  "validation" | "auth" | "conflict" | "network" | "server";

export interface PublishFailure {
  kind: PublishFailureKind;
  /** Always author-facing prose — the UI never has to invent a message. */
  message: string;
  /**
   * Per-field messages keyed by the API's dotted paths (`"days.2.stops.5.lat"`,
   * see `nestedFieldErrorsOf`). Client pre-flight and a server 400 produce the
   * same key space on purpose, so `PublishStatus` renders one of them the same
   * way it renders the other.
   */
  fields?: Record<string, string>;
}

export interface PublishedGuide {
  /** The URL slug the route derived from the title. `null` if the 201 body
   *  didn't parse — the guide is still saved, so that isn't a failure. */
  slug: string | null;
}

export interface PublishGuideState {
  phase: PublishPhase;
  /** `true` while photos are uploading or the POST is in flight. */
  pending: boolean;
  /** Photos finished / photos to upload this attempt, for the progress label. */
  uploaded: number;
  photoTotal: number;
  failure: PublishFailure | null;
  published: PublishedGuide | null;
  publish: (form: CreateGuideFormState) => void;
  /** Clears whichever panel is showing. */
  dismiss: () => void;
}

/** A published stop is a `GuideStop` plus the uploaded photo — `GuideStop`
 *  itself has no photo field (stop images are resolved separately everywhere
 *  else in the app), but `Guide.ts`'s `IGuideStop` persists one. */
type PublishStop = GuideStop & { photoUrl?: string };
type PublishDay = Omit<GuideDay, "stops"> & { stops: PublishStop[] };

interface PublishGuideBody {
  status: "published";
  title: string;
  heroTitle: string;
  heroAccent: string;
  blurb: string;
  intro: string;
  tags: string[];
  generalTips: string[];
  currency: string;
  bestTime: string;
  coverImageUrl?: string;
  days: PublishDay[];
}

/**
 * The exact JSON `POST /api/guides` receives, built from the draft plus a
 * `key -> publicUrl` map of everything uploaded.
 *
 * Called twice per attempt — once with an empty map for the pre-flight, once
 * with the real URLs for the request — so the object that was validated and the
 * object that is sent can't drift apart.
 *
 * `days` is zipped against `form.asGuideDays` rather than rebuilt from
 * `form.days`: `asGuideDays` owns the editor-only-field stripping (and other
 * callers depend on that contract), and it is a plain 1:1 `map` over the same
 * `days` array, so index `[i].stops[j]` addresses the same stop in both. The
 * *photo* lookup then goes through the draft stop's stable `id`, which is the
 * identity everything else in the editor keys off.
 */
function buildGuideBody(
  form: CreateGuideFormState,
  photoUrls: ReadonlyMap<string, string>,
): PublishGuideBody {
  const coverImageUrl = photoUrls.get(COVER_KEY);

  return {
    status: "published",
    // The editor collects one headline, not a separate feed title — and in
    // every hardcoded guide today `DestinationGuide.title` and
    // `GuideItinerary.heroTitle` are the same string. The route slugifies
    // `title`, so this is also what decides the guide's URL.
    title: form.heroTitle.trim(),
    heroTitle: form.heroTitle.trim(),
    heroAccent: form.heroAccent.trim(),
    blurb: form.blurb.trim(),
    intro: form.intro.trim(),
    tags: form.tags,
    generalTips: form.generalTips,
    currency: form.currency.trim() || "€",
    bestTime: form.bestTime.trim(),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    days: form.asGuideDays.map((day, dayIndex) => ({
      ...day,
      stops: day.stops.map((stop, stopIndex) => {
        const draftStop = form.days[dayIndex]?.stops[stopIndex];
        const photoUrl = draftStop
          ? photoUrls.get(stopKey(draftStop.id))
          : undefined;
        return photoUrl ? { ...stop, photoUrl } : stop;
      }),
    })),
  };
}

/** Every photo in the draft, in upload order (cover first — it's the one an
 *  author is most likely to be watching for). */
function photoTasksOf(form: CreateGuideFormState): PhotoUploadTask[] {
  const tasks: PhotoUploadTask[] = [];
  if (form.coverImage) {
    tasks.push({ key: COVER_KEY, dataUrl: form.coverImage.src });
  }
  for (const day of form.days) {
    for (const stop of day.stops) {
      if (stop.photo)
        tasks.push({ key: stopKey(stop.id), dataUrl: stop.photo.src });
    }
  }
  return tasks;
}

function preflightFieldErrors(
  form: CreateGuideFormState,
): Record<string, string> {
  const parsed = PREFLIGHT_SCHEMA.safeParse(
    buildGuideBody(form, NO_PHOTO_URLS),
  );
  const fields = parsed.success ? {} : nestedFieldErrorsOf(parsed.error);

  // `title` is derived from the headline, so a blank headline fails twice and
  // would list the same control under two messages.
  if (fields.heroTitle) delete fields.title;

  if (!form.coverImage) {
    fields.coverImageUrl = "Add a cover photo before publishing.";
  }

  return fields;
}

/**
 * The banner text for a failed pre-flight.
 *
 * The unplaced-stops half is the only rule in the whole publish path that the
 * server genuinely cannot enforce: `DraftStop.placed` is editor-only and never
 * reaches the wire, and an unplaced stop carries a *seeded* coordinate borrowed
 * from its neighbour, which is a perfectly valid lat/lng as far as
 * `publishGuideSchema` and `Guide.ts` are concerned. So it gets explained
 * rather than merely refused.
 */
function preflightMessage(unplaced: number, fieldCount: number): string {
  if (unplaced === 0) {
    return "This guide isn't ready to publish yet — here's what's still missing.";
  }

  const subject =
    unplaced === 1 ? "1 stop hasn't" : `${unplaced} stops haven't`;
  const explanation = `${subject} been placed on the map. Until you place one it borrows a neighbour's coordinates so the preview stays readable — which the server can't tell apart from a real location, so readers would be sent to the wrong place. Open each one in Edit and use "Set location on map".`;

  return fieldCount > 0
    ? `${explanation} A few other details are missing too.`
    : explanation;
}

function readErrorBody(body: unknown): {
  error?: string;
  fields?: Record<string, string>;
} {
  if (typeof body !== "object" || body === null) return {};

  const { error, fields } = body as { error?: unknown; fields?: unknown };
  const result: { error?: string; fields?: Record<string, string> } = {};

  if (typeof error === "string" && error.trim() !== "") result.error = error;

  if (typeof fields === "object" && fields !== null && !Array.isArray(fields)) {
    const parsed: Record<string, string> = {};
    for (const [key, message] of Object.entries(fields)) {
      if (typeof message === "string") parsed[key] = message;
    }
    if (Object.keys(parsed).length > 0) result.fields = parsed;
  }

  return result;
}

function readSlug(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { slug } = body as { slug?: unknown };
  return typeof slug === "string" && slug !== "" ? slug : null;
}

function failureFor(
  status: number,
  body: { error?: string; fields?: Record<string, string> },
): PublishFailure {
  switch (status) {
    case 401:
      return { kind: "auth", message: AUTH_MESSAGE };
    case 409:
      return {
        kind: "conflict",
        message:
          body.error ??
          "A guide with this title already exists. Change the headline and publish again.",
      };
    case 400:
      return {
        kind: "validation",
        message: body.fields
          ? "The server rejected a few details — fix these and publish again."
          : (body.error ?? "The server couldn't read this guide."),
        fields: body.fields,
      };
    default:
      return {
        kind: "server",
        message:
          body.error ??
          `We couldn't save your guide (${status}). Please try again.`,
      };
  }
}

export function usePublishGuide(): PublishGuideState {
  const router = useRouter();
  const [phase, setPhase] = useState<PublishPhase>("idle");
  const [uploaded, setUploaded] = useState(0);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [failure, setFailure] = useState<PublishFailure | null>(null);
  const [published, setPublished] = useState<PublishedGuide | null>(null);

  /** Guards a second click landing before the `phase` state flush. */
  const runningRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  /**
   * `data:` URL -> uploaded public URL, kept across attempts.
   *
   * A 409 ("retitle and try again") is the most likely failure of all, and
   * re-uploading the same bytes for it would be a pointless second wait. A data
   * URL *is* the file's bytes, so it identifies the uploaded object exactly:
   * change the photo and the key changes with it.
   */
  const uploadCache = useRef(new Map<string, string>());

  // A publish in flight when the page goes away has nowhere to report to, and
  // its PUTs are megabytes wide.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const dismiss = useCallback(() => {
    setFailure(null);
    setPublished(null);
    setPhase("idle");
  }, []);

  const publish = useCallback(
    async (form: CreateGuideFormState) => {
      if (runningRef.current) return;

      setFailure(null);
      setPublished(null);

      const fields = preflightFieldErrors(form);
      const unplaced = form.unplacedCount;
      if (unplaced > 0 || Object.keys(fields).length > 0) {
        setPhase("idle");
        setFailure({
          kind: "validation",
          message: preflightMessage(unplaced, Object.keys(fields).length),
          ...(Object.keys(fields).length > 0 ? { fields } : {}),
        });
        return;
      }

      runningRef.current = true;
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const cache = uploadCache.current;
        const pending: PhotoUploadTask[] = [];
        const photoUrls = new Map<string, string>();
        for (const task of photoTasksOf(form)) {
          const cached = cache.get(task.dataUrl);
          if (cached) photoUrls.set(task.key, cached);
          else pending.push(task);
        }

        setUploaded(0);
        setPhotoTotal(pending.length);

        if (pending.length > 0) {
          setPhase("uploading");
          try {
            const fresh = await uploadGuidePhotos(pending, {
              signal: controller.signal,
              onProgress: setUploaded,
            });
            for (const task of pending) {
              const url = fresh.get(task.key);
              if (url === undefined) continue;
              photoUrls.set(task.key, url);
              cache.set(task.dataUrl, url);
            }
          } catch (error) {
            if (isAbortError(error)) return;
            setPhase("idle");
            setFailure(
              error instanceof UploadAuthError
                ? { kind: "auth", message: AUTH_MESSAGE }
                : {
                    kind: "network",
                    message:
                      error instanceof Error
                        ? error.message
                        : "We couldn't upload your photos. Please try again.",
                  },
            );
            return;
          }
        }

        setPhase("saving");

        let response: Response;
        try {
          response = await fetch("/api/guides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildGuideBody(form, photoUrls)),
            signal: controller.signal,
          });
        } catch (error) {
          if (isAbortError(error)) return;
          setPhase("idle");
          setFailure({
            kind: "network",
            message:
              "We couldn't reach the server to save your guide. Your photos are already uploaded, so pressing Publish again only retries the save.",
          });
          return;
        }

        const body: unknown = await response.json().catch(() => null);

        if (response.ok) {
          const slug = readSlug(body);
          setPublished({ slug });
          setPhase("done");

          if (slug) {
            // The feed is a server component rendered per request, and this
            // session's router cache still holds the version from before this
            // guide existed. Without the refresh, navigating back to
            // `/destinations` can show a list the new guide is missing from.
            router.refresh();
            router.push(`/destinations/guide/${slug}/details`);
          }
          // No slug means the 201 body didn't parse — the guide *is* saved, but
          // there's no URL to send anyone to, so `PublishStatus` stays put and
          // says so rather than navigating somewhere invented.
          return;
        }

        setPhase("idle");
        setFailure(failureFor(response.status, readErrorBody(body)));
      } finally {
        runningRef.current = false;
        controllerRef.current = null;
      }
    },
    [router],
  );

  return {
    phase,
    pending: phase === "uploading" || phase === "saving",
    uploaded,
    photoTotal,
    failure,
    published,
    publish,
    dismiss,
  };
}
