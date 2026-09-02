"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CloseIcon, CommentIcon, SpinnerIcon } from "@/components/icons";

/** Everything that can hold focus and isn't explicitly removed from the tab
 *  order. Same list `DeleteGuideDialog`, `MapOverlaySheet` and
 *  `LocationPickerModal` trap against. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Mirrors `createCommentSchema`'s upper bound on the server, hardcoded rather
 * than imported: that module is server-side validation, and this component has
 * no reason to pull it into the client bundle for one number. The server
 * re-checks regardless — this only exists so the limit is visible *before* a
 * round trip rejects the comment.
 */
const MAX_COMMENT_LENGTH = 2000;

/** One comment as `GET /api/guides/<slug>/comments` returns it, and as `POST`
 *  to the same route answers with the one it just created. `createdAt` is an
 *  ISO string — the wire has no `Date`s, and neither does this component. */
interface GuideComment {
  id: string;
  username: string;
  comment: string;
  createdAt: string;
}

/**
 * Three states, never two of them at once. A single discriminated union rather
 * than parallel `loading`/`error`/`comments` flags, so "loaded but still
 * spinning" or "errored with a stale list underneath" aren't representable.
 */
type CommentsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; comments: GuideComment[] };

interface CommentsModalProps {
  /** The guide's URL slug — the only thing the endpoint needs. */
  guideSlug: string;
  /**
   * Whether there is a session. Decided on the server and threaded down
   * through `GuideAuthorBar`; this component never reads a session itself
   * (there is no `useSession` anywhere in this app).
   */
  isAuthenticated: boolean;
  /**
   * Fired once per comment this session actually *creates*, so the count in
   * `GuideAuthorBar`'s chip can follow the badge in this header instead of
   * going stale until the next full load.
   *
   * Deliberately not fired for the initial `GET`: that is an existing count
   * being read, and the bar has already seeded itself from the same number
   * server-side — announcing it here would double-count it.
   */
  onCommentPosted?: () => void;
  onClose: () => void;
}

/**
 * The comments list for one guide, plus — for a signed-in reader — the box to
 * add to it.
 *
 * Follows the modal conventions this codebase already has (`DeleteGuideDialog`,
 * `MapOverlaySheet`, `LocationPickerModal`): `motion/react` with
 * `AnimatePresence` owned by the caller, `useReducedMotion` respected, body
 * scroll locked while it is up, focus moved in and trapped, Escape closes, and
 * focus restored to whatever opened it.
 *
 * **One deliberate departure: a click on the scrim does not close it.** The
 * other two dialogs close on a backdrop `mousedown`; this one doesn't, on
 * purpose. The panel is a scrolling list that people drag-select and flick
 * through, and the gesture that ends outside the panel is the norm here rather
 * than the accident — losing the list mid-read is a worse outcome than one
 * extra press on Close. Escape and the close button are the two ways out, and
 * both are always reachable (the header is outside the scroll area, so Close
 * never scrolls off). Escape is additionally inert *while a comment is being
 * posted*, for `DeleteGuideDialog`'s reason: unmounting mid-request throws away
 * a result the author needs.
 *
 * The list arrives newest-first from the server and is rendered in exactly that
 * order — sorting it again here would be a second, drifting definition of
 * "newest". A comment posted from the composer is prepended locally rather than
 * refetched, which is why the two must agree on that ordering.
 *
 * **An anonymous reader gets no composer at all** — not a disabled one, not a
 * "sign in to comment" placeholder. The like button's own tooltip already
 * carries the sign-in message on this page, and a second copy of it inside a
 * dialog is noise around a list they opened to *read*.
 */
export default function CommentsModal({
  guideSlug,
  isAuthenticated,
  onCommentPosted,
  onClose,
}: CommentsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const draftId = useId();
  const counterId = useId();
  const postErrorId = useId();

  const [state, setState] = useState<CommentsState>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  /** In-flight guard for the POST, and the reason Escape is inert while it is
   *  set. A ref, not state: a second submit in the same tick must see the flag
   *  the first one wrote, before any re-render. */
  const postingRef = useRef(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Saving the inline value rather than assuming "" means a scroll lock set
    // elsewhere on the page survives this one closing.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!postingRef.current) onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    // Aborted on unmount so a close mid-flight doesn't leave a response
    // resolving into a component that is gone; every branch below re-checks
    // the signal, since `fetch`'s rejection is only the first place an abort
    // can land.
    const controller = new AbortController();

    async function load() {
      let response: Response;
      try {
        response = await fetch(
          `/api/guides/${encodeURIComponent(guideSlug)}/comments`,
          { signal: controller.signal },
        );
      } catch {
        // `fetch` only rejects on a transport failure or this abort — the
        // former is a real error, the latter must not touch state.
        if (!controller.signal.aborted) setState(keepLocalOnFailure);
        return;
      }

      if (controller.signal.aborted) return;

      // 404 (unknown or unpublished slug) and 500 read the same to someone
      // looking at a guide that is plainly there: the comments didn't load.
      // Nothing they can do differs between the two, so neither does the copy.
      if (!response.ok) {
        setState(keepLocalOnFailure);
        return;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (!controller.signal.aborted) setState(keepLocalOnFailure);
        return;
      }

      if (controller.signal.aborted) return;

      const comments = parseComments(body);
      if (!comments) {
        setState(keepLocalOnFailure);
        return;
      }

      // The one race worth handling: someone posts a comment while this GET is
      // still open, and the response — issued before their comment existed —
      // doesn't contain it. Merging by id keeps it at the top instead of
      // silently un-posting it, and de-duplicates if the server did see it.
      setState((previous) => {
        if (previous.status !== "loaded" || previous.comments.length === 0) {
          return { status: "loaded", comments };
        }
        const known = new Set(comments.map((entry) => entry.id));
        const local = previous.comments.filter((entry) => !known.has(entry.id));
        return { status: "loaded", comments: [...local, ...comments] };
      });
    }

    void load();
    return () => controller.abort();
  }, [guideSlug]);

  const trimmedLength = draft.trim().length;
  const overLimit = trimmedLength > MAX_COMMENT_LENGTH;
  const canSubmit = trimmedLength > 0 && !overLimit && !posting;

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const comment = draft.trim();
    if (postingRef.current || comment.length === 0 || overLimit) return;

    postingRef.current = true;
    setPosting(true);
    setPostError(null);

    let response: Response;
    try {
      response = await fetch(
        `/api/guides/${encodeURIComponent(guideSlug)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        },
      );
    } catch {
      // `fetch` only rejects on a transport failure, so nothing was written and
      // the draft below is still the only copy of what they wrote.
      finishPosting();
      setPostError(
        "We couldn’t reach the server, so your comment wasn’t posted. Check your connection and try again.",
      );
      return;
    }

    const body = await readJson(response);

    if (!response.ok) {
      finishPosting();
      setPostError(postFailureMessage(response.status, body));
      return;
    }

    finishPosting();

    // Posted either way past this point, so the draft is cleared either way —
    // leaving it in the box invites a duplicate of a comment that already
    // exists.
    setDraft("");

    const created = parseComment(body);
    if (!created) {
      setPostError(
        "Your comment was posted, but we couldn’t show it here. Reopen the comments to see it.",
      );
      return;
    }

    setState((previous) =>
      previous.status === "loaded"
        ? { status: "loaded", comments: [created, ...previous.comments] }
        : // Posting doesn't depend on the list having loaded: if the GET failed
          // or is still open, the new comment is still the one thing we know
          // for certain is there, so it becomes the list.
          { status: "loaded", comments: [created] },
    );

    // Here and nowhere else: past the `!created` guard, so a post whose response
    // couldn't be parsed doesn't bump a count it can't show a row for, and
    // after the only branch that adds to the list, so the caller's number moves
    // in step with this one.
    onCommentPosted?.();

    // The list is newest-first, so the comment they just wrote is at the top of
    // a container they may have scrolled away from. Scrolling it back is the
    // expected acknowledgement — and it only ever runs as the direct result of
    // their own submit, never while they're reading.
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }

  function finishPosting() {
    postingRef.current = false;
    setPosting(false);
  }

  function onDraftKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // Enter is a newline in a textarea and must stay one; ⌘/Ctrl+Enter is the
    // conventional "send" for exactly that reason.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <motion.div
      // The whole overlay is one element: it is the scrim *and* the centring
      // box, exactly as `DeleteGuideDialog`'s is. Deliberately **no**
      // `onMouseDown` close handler — see this component's doc comment.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-deep/55 p-4 backdrop-blur-[2px]"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }
        }
        transition={{
          duration: reduceMotion ? 0.12 : 0.28,
          ease: [0.2, 0.7, 0.2, 1],
        }}
        // `my-auto` rather than relying on the parent's `items-center`: a
        // centred flex item taller than an `overflow-y-auto` container has its
        // overflowing top clipped and unreachable, which would hide the heading
        // and the close button on a short viewport.
        className="my-auto w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-[0_40px_80px_-40px_rgba(11,36,56,.85)] sm:p-6"
      >
        {/* Header sits outside the scroll area below, so Close and the heading
            stay put however long the list is. */}
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            className="flex items-center gap-2 text-[17px] font-extrabold leading-[1.25] tracking-[-.02em] text-ink"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-500/10 text-brand-700"
            >
              <CommentIcon size={17} />
            </span>
            Comments
            {state.status === "loaded" && state.comments.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12.5px] font-bold tabular-nums text-[#68767f]">
                {state.comments.length}
              </span>
            )}
          </h2>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="tp-chip-shadow -mr-1 -mt-1 inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full bg-surface-2 text-[#68767f] outline-offset-2 outline-brand-500 hover:bg-[#eaf3f9] hover:text-brand-700 focus-visible:outline-2"
          >
            <CloseIcon size={17} />
          </button>
        </div>

        {state.status === "loading" && (
          <p
            role="status"
            className="mt-5 flex items-center gap-2 text-[13.5px] text-ink-soft"
          >
            <SpinnerIcon size={15} />
            Loading comments…
          </p>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-danger/25 bg-danger/6 px-3.5 py-3 text-[13px] leading-[1.55] text-ink-soft"
          >
            We couldn’t load the comments for this guide. Please close this and
            try again in a moment.
          </p>
        )}

        {state.status === "loaded" && state.comments.length === 0 && (
          <p className="mt-5 rounded-xl bg-surface-2 px-3.5 py-4 text-center text-[13.5px] text-ink-soft">
            No comments yet.
          </p>
        )}

        {state.status === "loaded" && state.comments.length > 0 && (
          // Bounded height plus its own scroll: a guide with fifty comments
          // must not push the close button past the bottom of the viewport.
          // The bound tightens when the composer is present, so the box the
          // reader came to type in doesn't sit below the fold.
          <ul
            ref={listRef}
            className={`mt-4 space-y-2 overflow-y-auto pr-1 ${
              isAuthenticated
                ? "max-h-[min(42vh,320px)]"
                : "max-h-[min(58vh,440px)]"
            }`}
          >
            {state.comments.map((comment) => {
              const posted = formatPostedAt(comment.createdAt);
              return (
                <li
                  key={comment.id}
                  className="rounded-xl bg-surface-2 px-3.5 py-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-bold text-ink">
                      {comment.username}
                    </span>
                    {posted && (
                      <time
                        dateTime={comment.createdAt}
                        className="flex-none text-[12px] text-[#8b98a1]"
                      >
                        {posted}
                      </time>
                    )}
                  </div>
                  {/* `break-words` so a pasted URL can't widen the panel past
                      its `max-w`, `whitespace-pre-line` so the author's own
                      line breaks survive. */}
                  <p className="mt-1.5 break-words whitespace-pre-line text-[13.5px] leading-[1.55] text-ink-soft">
                    {comment.comment}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {/* Last in the panel and outside every list branch on purpose: posting
            doesn't depend on the read succeeding, so the composer is there
            whether the list is loading, errored, empty or full. */}
        {isAuthenticated && (
          <form
            onSubmit={submitComment}
            className="mt-4 border-t border-[#f1f4f6] pt-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor={draftId}
                className="text-[13px] font-bold text-ink"
              >
                Add a comment
              </label>
              <span
                id={counterId}
                className={`flex-none text-[12px] tabular-nums ${
                  overLimit ? "font-bold text-danger" : "text-[#8b98a1]"
                }`}
              >
                {trimmedLength}/{MAX_COMMENT_LENGTH}
              </span>
            </div>

            <textarea
              id={draftId}
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onDraftKeyDown}
              // `readOnly` rather than `disabled` while posting: a disabled
              // control leaves the tab order, which would drop focus to
              // `<body>` out of the middle of a trapped dialog.
              readOnly={posting}
              placeholder="Share what you thought of this guide…"
              // Deliberately no `maxLength`: silently swallowing the tail of a
              // pasted paragraph is worse than saying it is too long and
              // letting them cut it themselves.
              aria-describedby={
                postError ? `${counterId} ${postErrorId}` : counterId
              }
              aria-invalid={overLimit || postError !== null}
              className={`mt-2 w-full resize-y rounded-xl border bg-surface-3 px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-ink outline-offset-2 outline-brand-500 placeholder:text-[#9fb1bd] focus-visible:outline-2 ${
                overLimit ? "border-danger/50" : "border-line"
              } ${posting ? "opacity-70" : ""}`}
            />

            {postError && (
              <p
                id={postErrorId}
                role="alert"
                className="mt-3 rounded-xl border border-danger/25 bg-danger/6 px-3.5 py-3 text-[13px] leading-[1.55] text-ink-soft"
              >
                {postError}
              </p>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={posting}
                className={`tp-btn-shadow inline-flex items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_12px_24px_-14px_rgba(19,74,111,.9)] outline-offset-2 outline-brand-500 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${
                  posting ? "cursor-wait" : ""
                }`}
              >
                {posting && <SpinnerIcon size={15} />}
                {posting ? "Posting…" : "Post comment"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * A failed read must not throw away a comment this session just posted — that
 * would look exactly like the comment vanishing. Anything else falls to the
 * error state as before.
 */
function keepLocalOnFailure(previous: CommentsState): CommentsState {
  return previous.status === "loaded" && previous.comments.length > 0
    ? previous
    : { status: "error" };
}

/** `null` for a body that isn't JSON at all, so a proxy's HTML error page is a
 *  parse miss rather than a throw. */
async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * Status to prose, in `DeleteGuideDialog['failureFor']`'s spirit — never a bare
 * code. A 400 is the only one that can say something specific about *this*
 * comment, so its own field message wins where the route sent one.
 */
function postFailureMessage(status: number, body: unknown): string {
  if (status === 400) {
    return (
      fieldErrorOf(body, "comment") ??
      "That comment can’t be posted as written. Please edit it and try again."
    );
  }
  if (status === 401) {
    return "You’re signed out, so your comment wasn’t posted. Sign in and try again.";
  }
  if (status === 404) {
    return "This guide isn’t there any more, so your comment wasn’t posted.";
  }
  return "We couldn’t post your comment. Please try again in a moment.";
}

/** One entry out of the route's `{ error, fields: { … } }` 400 body. */
function fieldErrorOf(body: unknown, key: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { fields } = body as { fields?: unknown };
  if (typeof fields !== "object" || fields === null) return null;
  const message = (fields as Record<string, unknown>)[key];
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

/**
 * The response body is untrusted at the type level, so every field is checked
 * (the same shape `DeleteGuideDialog`'s `errorMessageOf` and
 * `uploadGuidePhotos` use). A malformed entry returns `null`.
 */
function parseComment(entry: unknown): GuideComment | null {
  if (typeof entry !== "object" || entry === null) return null;
  const { id, username, comment, createdAt } = entry as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    typeof username !== "string" ||
    typeof comment !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return { id, username, comment, createdAt };
}

/** `null` for a malformed payload, shown as the error state — rendering half a
 *  list is worse than saying it failed. */
function parseComments(body: unknown): GuideComment[] | null {
  if (typeof body !== "object" || body === null) return null;
  const { comments } = body as { comments?: unknown };
  if (!Array.isArray(comments)) return null;

  const parsed: GuideComment[] = [];
  for (const entry of comments) {
    const comment = parseComment(entry);
    if (!comment) return null;
    parsed.push(comment);
  }
  return parsed;
}

/**
 * Created once, not per row: `Intl.DateTimeFormat` is expensive to construct,
 * and a fifty-comment list would build fifty identical formatters.
 *
 * The locale is left to the browser, as `toLocaleString()` is everywhere else
 * in this app. Safe from a hydration mismatch despite that, because nothing
 * here renders until the client-side fetch resolves — the server never emits
 * a formatted date for this list.
 */
const POSTED_AT_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `null` for anything `Date` can't parse, so a bad timestamp drops the
 *  `<time>` element rather than rendering "Invalid Date" next to a name. */
function formatPostedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return POSTED_AT_FORMAT.format(date);
}
