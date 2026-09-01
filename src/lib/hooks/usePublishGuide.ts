"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuideDay, GuideStop } from "@/lib/itinerary";
import type {
  CreateGuideFormState,
  DraftPhoto,
} from "@/lib/hooks/useCreateGuideForm";
import {
  UploadAuthError,
  isAbortError,
  uploadGuidePhotos,
  type PhotoUploadTask,
} from "@/lib/uploadGuidePhotos";
import {
  draftGuideSchema,
  nestedFieldErrorsOf,
  publishGuideSchema,
} from "@/lib/validation/guide";

/**
 * Sending a draft to the server: pre-flight, upload every photo, then either
 * `POST /api/guides` (a new guide) or `PATCH /api/guides/<slug>` (an edit).
 *
 * Lives here rather than in `CreateGuidePageShell` for the same reason
 * `useCreateGuideForm` does — the shell is already the mode switch, the sticky
 * bar and the map-instance gate — and follows the same convention as it and
 * `useGuideDetail`: flat state plus actions, no reducer, no context.
 *
 * The order of the three steps is load-bearing. The pre-flight runs *before*
 * the uploads so an author with a half-written guide isn't made to wait through
 * twenty megabytes of PUTs only to be told the intro is empty, and the uploads
 * run before the request because `publishGuideSchema` will not accept a data URL
 * for `coverImageUrl` and the route host-checks every photo URL against the R2
 * bucket. Nothing here is the enforcement point: the API re-validates
 * with the same schema regardless, exactly as `SignUpForm`'s `registerSchema`
 * pre-flight is only a saved round trip.
 *
 * The two modes are one pipeline with a `target`, not two pipelines. Everything
 * that differs — the method, the URL, where success navigates to, whether a 409
 * is even possible, and the words the author reads — is a branch on that single
 * argument; the pre-flight, the upload batching, the body builder and the
 * abort/cache handling are shared verbatim, because a second copy of them is
 * exactly where the two would drift.
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

/**
 * The same trick over `draftGuideSchema`, used when the guide being saved is
 * (and stays) a draft.
 *
 * Nothing in the UI can create a draft today — `/create-guide` only ever
 * publishes — but `getGuideForAuthor` deliberately loads a guide at *any*
 * status so an author can finish one that exists, and holding an unfinished
 * draft to publish-grade completeness before it may be saved is precisely how
 * such a draft becomes unfinishable.
 */
const DRAFT_PREFLIGHT_SCHEMA = draftGuideSchema.omit({ coverImageUrl: true });

/** Upload-task key for the guide's cover photo. Stop keys are prefixed so they
 *  can never collide with it. */
const COVER_KEY = "cover";
const stopKey = (stopId: string) => `stop:${stopId}`;

const NO_PHOTO_URLS: ReadonlyMap<string, string> = new Map();

/**
 * Which of the two things the author is doing. Everything author-facing in this
 * module and in `PublishStatus` is keyed off it, because "publish" and "save"
 * are not interchangeable words to someone whose guide is already live.
 */
export type PublishMode = "create" | "edit";

/** The guide an edit is being saved back onto. Absent = a brand-new guide. */
export interface PublishTarget {
  /**
   * The guide's URL slug. Immutable by design — `PATCH /api/guides/<slug>`
   * never moves a guide's address, because a published guide's links are
   * already out in the world — so it is both the request path and, on success,
   * exactly where the author is sent back to.
   */
  slug: string;
  /**
   * The status the guide already has, sent back unchanged. Saving an edit is
   * not a publish action: a live guide stays live and a draft stays a draft.
   */
  status: "draft" | "published";
  /**
   * The guide's stored feed title and headline, as they are in the database
   * right now. Both are needed only to decide whether this save is allowed to
   * touch `title` at all — see `resolveTitle`.
   */
  title: string;
  heroTitle: string;
}

const AUTH_MESSAGE: Record<PublishMode, string> = {
  create:
    "Publishing needs an account, and you're not signed in. Sign in in a new tab, then come back to this one and press Publish again — your draft stays exactly where it is.",
  edit: "Saving needs an account, and you're not signed in. Sign in in a new tab, then come back to this one and press Save changes again — your edits stay exactly where they are.",
};

export type PublishPhase = "idle" | "uploading" | "saving" | "done";

export type PublishFailureKind =
  | "validation"
  | "auth"
  /** POST only — `PATCH` can't collide, since it never re-derives the slug. */
  | "conflict"
  /** PATCH only — the guide was deleted, or was never this author's. */
  | "missing"
  | "network"
  | "server";

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
  /**
   * The guide's URL slug. On a create that's the one the route derived from
   * the title, and it is `null` if the 201 body didn't parse — the guide is
   * still saved, so that isn't a failure. On an edit it is never `null`: the
   * slug is immutable, so `target.slug` is always a correct fallback.
   */
  slug: string | null;
}

export interface PublishGuideState {
  /** Which wording the UI should use — see `PublishMode`. */
  mode: PublishMode;
  phase: PublishPhase;
  /** `true` while photos are uploading or the POST/PATCH is in flight. */
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
  /**
   * Echoed back rather than hardcoded to `"published"`, so saving an edit is
   * never *also* a publish action: a live guide stays live, a draft stays a
   * draft. `/create-guide` has no save-as-draft affordance, so a create always
   * passes `"published"` here.
   */
  status: "draft" | "published";
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
 * The exact JSON `POST /api/guides` (and, byte-for-byte the same shape,
 * `PATCH /api/guides/<slug>`) receives, built from the draft plus a
 * `key -> publicUrl` map of every photo.
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
  status: PublishGuideBody["status"],
  title: string,
): PublishGuideBody {
  const coverImageUrl = photoUrls.get(COVER_KEY);

  return {
    status,
    // Resolved by `resolveTitle` rather than taken from the headline here,
    // because the two are only interchangeable on a create. On a create the
    // route slugifies this, so it also decides the guide's URL; on an edit it
    // only changes the displayed title, since the slug is immutable (a
    // published guide's links are already out there). The editor says so
    // rather than implying a retitle moves the page.
    title,
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

/**
 * The feed title (`DestinationGuide.title`) this save should send.
 *
 * The editor collects one headline and no separate feed title, so a create
 * simply uses the headline for both — which is what every guide authored here
 * ends up with, and what `buildGuideBody` did unconditionally before edits
 * existed.
 *
 * An edit cannot do that unconditionally. A guide written *outside* this editor
 * — every seeded one — legitimately holds a `title` that differs from its
 * `heroTitle` ("Paris 5-Day Itinerary" on the feed card vs. "Paris 5-Day
 * Tourist Itinerary" over the hero), and collapsing the two would silently
 * rewrite the feed card of an author who only opened the editor to fix a typo
 * in the intro. The editor never shows `title`, so they would have no way to
 * see it happen, let alone undo it.
 *
 * So the stored title is kept for as long as the headline is untouched, and
 * only follows the headline once the author actually changes it — the one
 * moment they can see what they are renaming.
 */
function resolveTitle(
  form: CreateGuideFormState,
  storedTitle: string | undefined,
  storedHeroTitle: string | undefined,
): string {
  const heroTitle = form.heroTitle.trim();

  // A create has no stored anything to preserve.
  if (storedTitle === undefined || storedHeroTitle === undefined) {
    return heroTitle;
  }

  return heroTitle === storedHeroTitle.trim() ? storedTitle : heroTitle;
}

interface DraftPhotos {
  /** Photos that still have to be PUT to R2, in upload order (cover first —
   *  it's the one an author is most likely to be watching for). */
  tasks: PhotoUploadTask[];
  /** Photos that are already in the bucket, `key -> publicUrl`, ready to drop
   *  straight into the request body. Only an edit ever has any. */
  hosted: Map<string, string>;
}

/**
 * Sorts every photo in the draft into "needs uploading" and "already there".
 *
 * The split is what stops an edit from re-uploading its own unchanged photos.
 * A guide loaded by `useCreateGuideForm(initial)` seeds each existing photo
 * with `uploadedUrl` set to the R2 URL it was published with; anything the
 * author picks during the edit comes from `newPhoto` and has none, so it lands
 * in `tasks` exactly like a fresh guide's would. Without this, every save of a
 * 20-stop guide would cost the same twenty multi-megabyte PUTs as its first
 * publish did — and orphan the previous twenty objects in the bucket.
 */
function photosOf(form: CreateGuideFormState): DraftPhotos {
  const tasks: PhotoUploadTask[] = [];
  const hosted = new Map<string, string>();

  const sort = (key: string, photo: DraftPhoto) => {
    if (photo.uploadedUrl) hosted.set(key, photo.uploadedUrl);
    else tasks.push({ key, dataUrl: photo.src });
  };

  if (form.coverImage) sort(COVER_KEY, form.coverImage);
  for (const day of form.days) {
    for (const stop of day.stops) {
      if (stop.photo) sort(stopKey(stop.id), stop.photo);
    }
  }

  return { tasks, hosted };
}

function preflightFieldErrors(
  form: CreateGuideFormState,
  mode: PublishMode,
  status: PublishGuideBody["status"],
  title: string,
): Record<string, string> {
  const draft = status === "draft";
  const schema = draft ? DRAFT_PREFLIGHT_SCHEMA : PREFLIGHT_SCHEMA;
  const parsed = schema.safeParse(
    buildGuideBody(form, NO_PHOTO_URLS, status, title),
  );
  const fields = parsed.success ? {} : nestedFieldErrorsOf(parsed.error);

  // `title` is derived from the headline, so a blank headline fails twice and
  // would list the same control under two messages.
  if (fields.heroTitle) delete fields.title;

  // A cover is mandatory to publish and meaningless to demand of a draft —
  // matching `coverImageUrl`'s `requiredWhenPublished` in `Guide.ts` and its
  // `.optional()` in `draftGuideSchema`.
  if (!draft && !form.coverImage) {
    fields.coverImageUrl =
      mode === "edit"
        ? "Add a cover photo before saving."
        : "Add a cover photo before publishing.";
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
function preflightMessage(
  unplaced: number,
  fieldCount: number,
  mode: PublishMode,
): string {
  if (unplaced === 0) {
    return mode === "edit"
      ? "These changes can't be saved yet — here's what's still missing."
      : "This guide isn't ready to publish yet — here's what's still missing.";
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
  mode: PublishMode,
): PublishFailure {
  switch (status) {
    case 401:
      return { kind: "auth", message: AUTH_MESSAGE[mode] };
    case 404:
      // Only `PATCH` answers this, and it answers it for "no such guide" and
      // "not yours" alike — the route refuses to tell those apart, so neither
      // does this. Deliberately not offered as a retry: pressing Save again
      // cannot change either answer.
      return {
        kind: "missing",
        message:
          "This guide no longer exists, or it isn't yours to edit — so there's nowhere to save these changes. If you deleted it in another tab, that's why.",
      };
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
          ? mode === "edit"
            ? "The server rejected a few details — fix these and save again."
            : "The server rejected a few details — fix these and publish again."
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

export function usePublishGuide(target?: PublishTarget): PublishGuideState {
  const router = useRouter();
  // Read apart into primitives so `publish`'s dependency list is stable even
  // when a caller rebuilds the `target` object on every render (the shell does
  // — it derives it from a prop handed down by a server component).
  const targetSlug = target?.slug;
  const targetStatus = target?.status;
  const targetTitle = target?.title;
  const targetHeroTitle = target?.heroTitle;
  const mode: PublishMode = targetSlug === undefined ? "create" : "edit";

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
   *
   * This only ever holds newly picked photos. An edit's *existing* photos never
   * reach it — they arrive already hosted and are short-circuited a step
   * earlier, in `photosOf`.
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

      // A create always publishes (`/create-guide` has no save-as-draft
      // control); an edit hands the guide back whatever status it already had.
      const status = targetStatus ?? "published";
      const title = resolveTitle(form, targetTitle, targetHeroTitle);

      const fields = preflightFieldErrors(form, mode, status, title);
      const unplaced = form.unplacedCount;
      // Unplaced stops block a draft save too, not just a publish. A stop the
      // author never placed is carrying a *neighbour's* coordinates, and once
      // those are written they come back on the next load as a real, chosen
      // position — the "never placed" signal is gone and nothing downstream can
      // recover it. Nobody reads a draft, but its author does.
      if (unplaced > 0 || Object.keys(fields).length > 0) {
        setPhase("idle");
        setFailure({
          kind: "validation",
          message: preflightMessage(unplaced, Object.keys(fields).length, mode),
          ...(Object.keys(fields).length > 0 ? { fields } : {}),
        });
        return;
      }

      runningRef.current = true;
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const cache = uploadCache.current;
        const { tasks, hosted } = photosOf(form);
        // Photos already in the bucket start the map off; only what's left can
        // possibly need a PUT.
        const photoUrls = new Map<string, string>(hosted);
        const pending: PhotoUploadTask[] = [];
        for (const task of tasks) {
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
                ? { kind: "auth", message: AUTH_MESSAGE[mode] }
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
          // The one place the two modes diverge on the wire. The body is
          // identical — `PATCH` takes exactly the shape `POST` does — because
          // an edit is a full replacement of the guide's content, not a diff.
          response = await fetch(
            targetSlug === undefined
              ? "/api/guides"
              : `/api/guides/${encodeURIComponent(targetSlug)}`,
            {
              method: targetSlug === undefined ? "POST" : "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                buildGuideBody(form, photoUrls, status, title),
              ),
              signal: controller.signal,
            },
          );
        } catch (error) {
          if (isAbortError(error)) return;
          setPhase("idle");
          setFailure({
            kind: "network",
            message:
              mode === "edit"
                ? "We couldn't reach the server to save your changes. Your photos are already uploaded, so pressing Save changes again only retries the save."
                : "We couldn't reach the server to save your guide. Your photos are already uploaded, so pressing Publish again only retries the save.",
          });
          return;
        }

        const body: unknown = await response.json().catch(() => null);

        if (response.ok) {
          // On an edit the slug is immutable, so `targetSlug` is always a
          // correct answer even if the 200 body didn't parse — an edit can
          // never reach the "saved, but we don't know where" branch below.
          const slug = readSlug(body) ?? targetSlug ?? null;
          setPublished({ slug });
          setPhase("done");

          if (slug) {
            // The feed and the guide page are both server components rendered
            // per request, and this session's router cache still holds the
            // version from before this write. Without the refresh, going back
            // to `/guides` can show a list the new guide is missing
            // from — or, after an edit, the guide exactly as it was.
            router.refresh();
            router.push(`/guides/guide/${slug}/details`);
          }
          // No slug means the 201 body didn't parse — the guide *is* saved, but
          // there's no URL to send anyone to, so `PublishStatus` stays put and
          // says so rather than navigating somewhere invented.
          return;
        }

        setPhase("idle");
        setFailure(failureFor(response.status, readErrorBody(body), mode));
      } finally {
        runningRef.current = false;
        controllerRef.current = null;
      }
    },
    [router, mode, targetSlug, targetStatus, targetTitle, targetHeroTitle],
  );

  return {
    mode,
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
