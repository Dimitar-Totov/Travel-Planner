"use client";

import {
  useCallback,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CloseIcon,
  CommentIcon,
  EditIcon,
  MoreIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";

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

/**
 * Above this, a rate-limit cooldown gets no auto-clear timer at all.
 *
 * `postCooldownUntil` is read as a timestamp comparison, never a boolean, so it
 * expires on its own the next time anything re-renders — and in a composer that
 * re-renders on every keystroke, that is immediate in practice. A ten-minute
 * `setTimeout` would therefore buy nothing except a long-lived handle to keep
 * alive and clean up. A short one is still worth keeping, because a reader who
 * stops typing to wait out a thirty-second window would otherwise stare at a
 * dead button until they touched the textarea again.
 */
const COOLDOWN_AUTOCLEAR_MAX_MS = 120_000;

/** How long a failed delete keeps its note up under the row — the same
 *  read-once window `GuideAuthorBar`'s like-failure bubble uses. */
const ROW_ERROR_MS = 3600;

/**
 * Prefix for the stand-in id an optimistic comment carries until its `POST`
 * settles. Named so `isOwnComment` can recognise one: it has no server-side
 * existence yet, so there is nothing an edit or delete could be addressed to.
 */
const OPTIMISTIC_ID_PREFIX = "optimistic-";

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
   * The signed-in reader's own username, threaded down the same way
   * `isAuthenticated` is. Used for two things: the name on this reader's
   * optimistic comment while its `POST` is still in flight, and deciding which
   * rows get the Edit/Delete menu (see `isOwnComment`). The server stamps the
   * real author from the session, and the settled comment replaces the
   * optimistic one, so a stale or missing value here can only ever mislabel a
   * row for the length of one round trip — hence the `"You"` fallback rather
   * than a refusal to post. Nor is the menu a permission boundary: the edit and
   * delete routes re-check authorship themselves, so a stale value can at worst
   * offer a menu whose writes come back 403.
   */
  viewerUsername: string | null;
  /**
   * The count the opening chip in `GuideAuthorBar` is showing right now —
   * its local `comments` state, which already includes this session's own
   * posts. Seeds the header badge while the `GET` is in flight, so the header
   * opens at its final shape instead of growing a badge a beat later.
   */
  initialCommentCount: number;
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
  /**
   * Fired once per comment this session actually *deletes* — after the
   * `DELETE` succeeds, never optimistically — so the chip in `GuideAuthorBar`
   * drops in step with this header's badge.
   *
   * Deliberately not fired for an edit: an edited comment is still one
   * comment, and nothing about the count changed.
   */
  onCommentDeleted?: () => void;
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
 * refetched, which is why the two must agree on that ordering. It is prepended
 * *optimistically* (`useOptimistic`), the moment the reader submits, and the
 * real comment the server answers with lands at the same index once it settles;
 * a failed post simply lets the overlay lapse, which is the rollback.
 *
 * **Edits and deletes are not optimistic.** A reader's own rows carry a small
 * Edit/Delete menu. Both wait for the server, apply its answer locally, and
 * then re-read the thread (`loadComments("refresh")`) to reconcile — a comment
 * vanishing or changing and then snapping back on a 403 is worse than one
 * round trip of a spinner. Edit reuses the composer rather than growing an
 * inline editor per row: one textarea, one length counter, one error slot, one
 * in-flight guard. Delete has no confirmation step, by request — it is one
 * short comment, not a whole guide.
 *
 * **The panel is one size whatever it holds.** Loading, error, empty and a
 * thousand-comment list all render inside a single fixed-height box
 * (`listAreaClass`), so nothing about the dialog's outline changes as the read
 * resolves — the content swaps, the frame doesn't.
 *
 * **An anonymous reader gets no composer at all** — not a disabled one, not a
 * "sign in to comment" placeholder. The like button's own tooltip already
 * carries the sign-in message on this page, and a second copy of it inside a
 * dialog is noise around a list they opened to *read*.
 */
export default function CommentsModal({
  guideSlug,
  isAuthenticated,
  viewerUsername,
  initialCommentCount,
  onCommentPosted,
  onCommentDeleted,
  onClose,
}: CommentsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** The open row's trigger + dropdown together, so a `mousedown` on either
   *  counts as inside. Attached to one row at a time — only one menu is ever
   *  open. */
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const draftId = useId();
  const counterId = useId();
  const postErrorId = useId();
  const menuIdBase = useId();

  const [state, setState] = useState<CommentsState>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  /** Set while the composer is editing an existing comment rather than writing
   *  a new one; switches the submit path from `POST` to `PATCH`. */
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(
    null,
  );
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  /** A failed delete's message, pinned to the row it failed on. */
  const [rowError, setRowError] = useState<{
    commentId: string;
    message: string;
  } | null>(null);
  /**
   * When the server said this reader may post again, as a `Date.now()`
   * timestamp — or `null` when nothing is holding them back. Learned only from
   * an actual 429, never pre-computed and never persisted: a reload
   * mid-cooldown spends one more submit learning the same thing again, which
   * beats keeping a second, drifting copy of the server’s window here.
   */
  const [postCooldownUntil, setPostCooldownUntil] = useState<number | null>(
    null,
  );

  /** In-flight guard for the POST — and for an edit's PATCH, which goes through
   *  the same composer — and the reason Escape is inert while it is set. A ref,
   *  not state: a second submit in the same tick must see the flag the first
   *  one wrote, before any re-render. */
  const postingRef = useRef(false);
  /** The same synchronous guard for a DELETE. */
  const deletingRef = useRef(false);

  /**
   * Ids of comments this session created through the composer. A re-read only
   * keeps a locally-held row the server didn't return if it is in here: that
   * is the "posted while the GET was open" race the merge exists for. Anything
   * else missing from a fresh read is genuinely gone — deleted here or
   * elsewhere — and must not be resurrected from the stale local copy.
   */
  const sessionPostedIds = useRef<Set<string>>(new Set());
  /** Bumped by every `loadComments` call, so only the newest read may write
   *  `state`: a refresh issued before a delete must not land after it and put
   *  the deleted row back. */
  const loadSeq = useRef(0);
  const rowErrorTimer = useRef<number | undefined>(undefined);

  /** Handle for the cooldown’s optional auto-clear, so closing the dialog
   *  mid-window doesn’t leave a timer calling `setPostCooldownUntil` on a gone
   *  component — the same cleanup story the scroll-lock and key-handler effects
   *  above and below already follow. Only ever set for a short window (see
   *  `COOLDOWN_AUTOCLEAR_MAX_MS`). */
  const cooldownTimer = useRef<number | undefined>(undefined);

  /**
   * What the list actually renders: the true `state` plus any comment this
   * session has submitted but the server hasn't answered for yet.
   *
   * The base is `[]` until the read has loaded, so before then the overlay
   * holds *only* this reader's own pending posts — which is what lets the
   * header count add it to `initialCommentCount` without ever double-counting.
   * The overlay lives exactly as long as the transition in `submitComment`: a
   * success commits the real comment into `state` and the overlay collapses
   * into it, a failure commits nothing and the overlay simply lapses — the
   * rollback is the hook's, not a hand-written `setState` in every branch.
   */
  const baseComments = state.status === "loaded" ? state.comments : [];
  const [optimisticComments, addOptimisticComment] = useOptimistic<
    GuideComment[],
    GuideComment
  >(baseComments, (current, entry) => [entry, ...current]);
  // `isPending` is deliberately unused: `posting`/`postingRef` already are the
  // busy flag, and the ref is what has to be checked synchronously before a
  // transition is even scheduled (see the top of `submitComment`).
  const [, startTransition] = useTransition();

  useEffect(
    () => () => {
      window.clearTimeout(cooldownTimer.current);
      window.clearTimeout(rowErrorTimer.current);
    },
    [],
  );

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
        // An open row menu is the innermost layer, so Escape peels only that
        // off — closing the whole dialog from inside a three-item menu would
        // throw away far more than was asked. Focus goes back to the trigger
        // rather than falling to `<body>` out of the focus trap.
        if (openMenuCommentId !== null) {
          menuTriggerRef.current?.focus();
          setOpenMenuCommentId(null);
          return;
        }
        // Also inert mid-delete, for the same reason posting blocks it: this
        // dialog is a `position: fixed` overlay, so unmounting doesn't cancel
        // the in-flight `DELETE` — it would only throw away the author's view
        // of its result while the write itself completes regardless.
        if (!postingRef.current && !deletingRef.current) onClose();
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
  }, [onClose, openMenuCommentId]);

  // Outside-click dismissal for the row menu. Registered only while one is
  // open, so the dialog pays nothing for it the rest of the time.
  useEffect(() => {
    if (openMenuCommentId === null) return;
    function onMouseDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpenMenuCommentId(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [openMenuCommentId]);

  /**
   * Reads the thread. `"initial"` is the mount read and owns the error state;
   * `"refresh"` follows a successful edit or delete, and a failure there leaves
   * `state` exactly as it is — the write's own answer has already been applied
   * locally, so the list on screen is correct, and swapping it for "couldn't
   * load" over a reconciliation miss would be the worse picture.
   */
  const loadComments = useCallback(
    async (mode: "initial" | "refresh", signal?: AbortSignal) => {
      const seq = ++loadSeq.current;
      // `fetch`'s rejection is only the first place an abort can land, so this
      // is re-checked after every await — as is supersession by a newer read.
      const stale = () => signal?.aborted === true || seq !== loadSeq.current;
      const fail = () => {
        if (mode === "initial") setState(keepLocalOnFailure);
      };

      let response: Response;
      try {
        response = await fetch(
          `/api/guides/${encodeURIComponent(guideSlug)}/comments`,
          { signal },
        );
      } catch {
        // `fetch` only rejects on a transport failure or an abort — the former
        // is a real error, the latter must not touch state.
        if (!stale()) fail();
        return;
      }

      if (stale()) return;

      // 404 (unknown or unpublished slug) and 500 read the same to someone
      // looking at a guide that is plainly there: the comments didn't load.
      // Nothing they can do differs between the two, so neither does the copy.
      if (!response.ok) {
        fail();
        return;
      }

      const comments = parseComments(await readJson(response));
      if (stale()) return;
      if (!comments) {
        fail();
        return;
      }

      const posted = sessionPostedIds.current;
      setState((previous) => mergeSessionPosts(previous, comments, posted));
    },
    [guideSlug],
  );

  useEffect(() => {
    // Aborted on unmount so a close mid-flight doesn't leave a response
    // resolving into a component that is gone.
    const controller = new AbortController();
    void loadComments("initial", controller.signal);
    return () => controller.abort();
  }, [loadComments]);

  // A menu opened on the last row hangs below the bottom of the scrolling
  // list; bring it into view rather than leaving half of it to be found.
  useEffect(() => {
    if (openMenuCommentId === null) return;
    menuRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [openMenuCommentId, reduceMotion]);

  const trimmedLength = draft.trim().length;
  const overLimit = trimmedLength > MAX_COMMENT_LENGTH;
  // A plain time comparison rather than a stored boolean, so a cooldown with no
  // auto-clear timer behind it still stops mattering the moment it lapses.
  const coolingDown = isCoolingDown(postCooldownUntil);
  const editing = editingCommentId !== null;
  // Only the submit button is gated. The textarea stays fully editable through a
  // cooldown — waiting out a rate limit is exactly when someone rereads and
  // edits what they wrote. The cooldown is the *create* limiter's, so it
  // doesn't hold back an edit; a delete in flight does hold back both, keeping
  // this dialog to one write at a time (the same reason the row menus go inert
  // while the composer is busy).
  const canSubmit =
    trimmedLength > 0 &&
    !overLimit &&
    !posting &&
    deletingCommentId === null &&
    (editing || !coolingDown);
  const menusDisabled = posting || deletingCommentId !== null;

  // Until the read has loaded, `optimisticComments` holds only this session's
  // own pending posts (its base is `[]`), so adding it to the seeded count
  // can't double-count anything. Once loaded, the list itself is the truth.
  const headerCount =
    state.status === "loaded"
      ? optimisticComments.length
      : initialCommentCount + optimisticComments.length;

  /**
   * One height — not a max-height — for everything that can occupy the list's
   * slot, so the dialog is the same size for 0, 1 or 1000 comments and doesn't
   * change shape as the read resolves. Bounded, with its own scroll inside, so
   * a long thread can't push Close past the viewport; tighter when the
   * composer is present, so the box the reader came to type in doesn't sit
   * below the fold. Grows a little at `lg`, with the panel and its text.
   */
  const listAreaClass = isAuthenticated
    ? "h-[min(42vh,320px)] lg:h-[min(40vh,380px)]"
    : "h-[min(58vh,440px)] lg:h-[min(56vh,520px)]";

  // No longer `async` itself: the guards below run synchronously in the submit
  // event, and everything that awaits lives inside the transition it schedules.
  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const comment = draft.trim();
    if (postingRef.current || deletingRef.current) return;
    if (comment.length === 0 || overLimit) return;
    if (editingCommentId !== null) {
      // An edit is not a new row, so none of the optimistic-prepend machinery
      // below applies to it.
      void submitEdit(editingCommentId, comment);
      return;
    }
    if (isCoolingDown(postCooldownUntil)) return;

    postingRef.current = true;
    setPosting(true);
    setPostError(null);

    startTransition(async () => {
      // First, before the request: the comment is on screen the instant they
      // submit. Everything below only decides whether it *stays* — by being
      // committed into `state` — or lapses with the transition.
      addOptimisticComment({
        id: `${OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`,
        username: viewerUsername ?? "You",
        comment,
        createdAt: new Date().toISOString(),
      });

      // The list is newest-first, so the comment they just wrote is at the top
      // of a container they may have scrolled away from. Scrolling it back is
      // the expected acknowledgement — and it only ever runs as the direct
      // result of their own submit, never while they're reading. Once, here,
      // rather than again on success: the real comment settles into the same
      // index 0 the pending one is already showing at.
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: 0,
          behavior: reduceMotion ? "auto" : "smooth",
        });
      });

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
        // `fetch` only rejects on a transport failure, so nothing was written
        // and the draft below is still the only copy of what they wrote.
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
        if (response.status === 429) startPostCooldown(parseRetryAfter(body));
        // Returning *before* `setDraft("")` below is what leaves the draft in
        // the box on every failure path. Load-bearing for the 429 case in
        // particular: nothing was written, so this textarea holds the only copy
        // of what they wrote, and they are being asked to wait and send exactly
        // that again. Nothing is committed to `state` either, so the optimistic
        // row lapses with the transition — that is the rollback.
        return;
      }

      finishPosting();

      // Posted either way past this point, so the draft is cleared either way —
      // leaving it in the box invites a duplicate of a comment that already
      // exists.
      setDraft("");

      const created = parseComment(body);
      if (!created) {
        // The optimistic row lapses here too, even though the comment exists:
        // we have no real id to key it by, and a row that might be a duplicate
        // of the next load's is worse than this message asking for a reopen.
        setPostError(
          "Your comment was posted, but we couldn’t show it here. Reopen the comments to see it.",
        );
        return;
      }

      sessionPostedIds.current.add(created.id);

      // Wrapped in its own `startTransition` because it runs after an `await`:
      // React only treats updates as part of the action when they are marked,
      // and an unmarked one would commit urgently — rendering the real comment
      // *and* the still-live optimistic one for a frame, two copies at the top
      // of the list. Marked, it lands in the same commit that retires the
      // overlay.
      startTransition(() => {
        setState((previous) =>
          previous.status === "loaded"
            ? { status: "loaded", comments: [created, ...previous.comments] }
            : // Posting doesn't depend on the list having loaded: if the GET
              // failed or is still open, the new comment is still the one thing
              // we know for certain is there, so it becomes the list.
              { status: "loaded", comments: [created] },
        );
      });

      // Here and nowhere else: past the `!created` guard, so a post whose
      // response couldn't be parsed doesn't bump a count it can't show a row
      // for, and after the only branch that adds to the list, so the caller's
      // number moves in step with this one.
      onCommentPosted?.();
    });
  }

  function finishPosting() {
    postingRef.current = false;
    setPosting(false);
  }

  /** Same composer, same guard, same error slot as a post — only the request
   *  and what success does to the list differ. */
  async function submitEdit(commentId: string, comment: string) {
    postingRef.current = true;
    setPosting(true);
    setPostError(null);

    let response: Response;
    try {
      response = await fetch(commentUrl(guideSlug, commentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
    } catch {
      finishPosting();
      setPostError(
        "We couldn’t reach the server, so your edit wasn’t saved. Check your connection and try again.",
      );
      return;
    }

    const body = await readJson(response);

    if (!response.ok) {
      finishPosting();
      // The draft and edit mode both survive, for the same reason a failed
      // post keeps its draft: the textarea holds the only copy of the edit.
      setPostError(postFailureMessage(response.status, body, "edit"));
      return;
    }

    finishPosting();
    setEditingCommentId(null);
    setDraft("");

    // Applied before the refresh, so the edit shows at once and survives a
    // refresh that fails. A 200 we can't parse just waits for the re-read.
    const updated = parseComment(body);
    if (updated) {
      setState((previous) =>
        previous.status === "loaded"
          ? {
              status: "loaded",
              comments: previous.comments.map((entry) =>
                entry.id === updated.id ? updated : entry,
              ),
            }
          : previous,
      );
    }
    void loadComments("refresh");
  }

  function startEditing(comment: GuideComment) {
    setOpenMenuCommentId(null);
    setEditingCommentId(comment.id);
    // Replaces whatever was in the box. An unsent new comment is lost here, but
    // the alternative — two drafts behind one textarea — is a mode nobody
    // could see.
    setDraft(comment.comment);
    setPostError(null);
    // After the commit, so the textarea already holds the seeded text and the
    // caret can land at its end rather than at the start of someone's paragraph.
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }

  function cancelEditing() {
    setEditingCommentId(null);
    setDraft("");
    setPostError(null);
  }

  function showRowError(commentId: string, message: string) {
    setRowError({ commentId, message });
    window.clearTimeout(rowErrorTimer.current);
    rowErrorTimer.current = window.setTimeout(
      () => setRowError(null),
      ROW_ERROR_MS,
    );
  }

  function finishDeleting() {
    deletingRef.current = false;
    setDeletingCommentId(null);
  }

  async function deleteComment(commentId: string) {
    if (deletingRef.current || postingRef.current) return;
    deletingRef.current = true;

    // The menu item that was clicked is about to unmount; moving focus to the
    // row's trigger first (still attached — this runs before the re-render)
    // keeps it inside the trap instead of dropping to `<body>`.
    menuTriggerRef.current?.focus();
    setOpenMenuCommentId(null);
    setDeletingCommentId(commentId);
    window.clearTimeout(rowErrorTimer.current);
    setRowError(null);

    let response: Response;
    try {
      response = await fetch(commentUrl(guideSlug, commentId), {
        method: "DELETE",
      });
    } catch {
      finishDeleting();
      showRowError(
        commentId,
        "We couldn’t reach the server, so the comment wasn’t deleted. Check your connection and try again.",
      );
      return;
    }

    if (!response.ok) {
      finishDeleting();
      showRowError(commentId, deleteFailureMessage(response.status));
      return;
    }

    finishDeleting();
    sessionPostedIds.current.delete(commentId);
    setState((previous) =>
      previous.status === "loaded"
        ? {
            status: "loaded",
            comments: previous.comments.filter(
              (entry) => entry.id !== commentId,
            ),
          }
        : previous,
    );
    // Deleting the very comment the composer is editing ends that edit — a
    // later save would only 404 against a row that no longer exists.
    if (editingCommentId === commentId) cancelEditing();
    onCommentDeleted?.();

    // The trigger that held focus left with its row. The list itself takes it
    // (it is `tabIndex={-1}`, so this adds no tab stop); Close is the fallback
    // once the last comment is gone and the list has unmounted.
    requestAnimationFrame(() => {
      (listRef.current ?? closeRef.current)?.focus({ preventScroll: true });
    });
    void loadComments("refresh");
  }

  /** Arms the local lock from what the server actually said. A body we couldn’t
   *  read a usable number out of arms nothing — `postFailureMessage` has already
   *  said so in words, and a cooldown of unknown length is worse than one more
   *  rejected submit. */
  function startPostCooldown(retryAfterSeconds: number | null) {
    if (retryAfterSeconds === null) return;

    const holdMs = retryAfterSeconds * 1000;
    setPostCooldownUntil(deadlineAfter(holdMs));
    window.clearTimeout(cooldownTimer.current);
    if (holdMs <= COOLDOWN_AUTOCLEAR_MAX_MS) {
      cooldownTimer.current = window.setTimeout(
        () => setPostCooldownUntil(null),
        holdMs,
      );
    }
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
        className="my-auto w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-[0_40px_80px_-40px_rgba(11,36,56,.85)] sm:p-6 lg:max-w-[600px] lg:p-7"
      >
        {/* Header sits outside the scroll area below, so Close and the heading
            stay put however long the list is. */}
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            className="flex items-center gap-2 text-[17px] font-extrabold leading-[1.25] tracking-[-.02em] text-ink lg:text-[19px]"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-500/10 text-brand-700"
            >
              <CommentIcon size={17} />
            </span>
            Comments
            {headerCount > 0 && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12.5px] font-bold tabular-nums text-[#68767f] lg:text-[13.5px]">
                {headerCount}
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

        {/* The one fixed-height slot every list state renders into — see
            `listAreaClass`. Which state fills it is decided in one place, and
            the real list wins whenever there is anything to show (including a
            pending post while the read is still open or has failed), since
            posting never depended on the read succeeding. */}
        <div className={`mt-4 ${listAreaClass}`}>
          {optimisticComments.length > 0 ? (
            // `tabIndex={-1}` so a delete can park focus here once the row
            // holding it is gone, without adding a tab stop (`FOCUSABLE`
            // excludes `-1`).
            <ul
              ref={listRef}
              tabIndex={-1}
              className="h-full space-y-2 overflow-y-auto pr-1 outline-none"
            >
              {optimisticComments.map((comment) => {
                const posted = formatPostedAt(comment.createdAt);
                const own = isOwnComment(
                  comment,
                  isAuthenticated,
                  viewerUsername,
                );
                const menuOpen = openMenuCommentId === comment.id;
                const deleting = deletingCommentId === comment.id;
                const error =
                  rowError?.commentId === comment.id ? rowError.message : null;
                return (
                  <li
                    key={comment.id}
                    aria-busy={deleting || undefined}
                    // `group` is what lets the menu trigger appear on hover of
                    // the whole row and on focus anywhere inside it. The ring
                    // marks the row the composer is currently editing, so the
                    // link between the two isn't left to memory.
                    className={`group rounded-xl bg-surface-2 px-3.5 py-3 lg:px-4 lg:py-3.5 ${
                      editingCommentId === comment.id
                        ? "ring-1 ring-brand-500/40"
                        : ""
                    } ${deleting ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="truncate text-[13.5px] font-bold text-ink lg:text-[15px]">
                        {comment.username}
                      </span>
                      {/* `relative`, not a flex column: the menu trigger is
                          `absolute` so it sits below the date without adding
                          to this corner's height while it's invisible at
                          rest — a flex column reserves the trigger's box
                          whether or not `opacity` shows it, which is exactly
                          the extra gap over every row's comment text this was
                          leaving behind. */}
                      <div className="relative flex-none">
                        {posted && (
                          <time
                            dateTime={comment.createdAt}
                            className="block text-[12px] text-[#8b98a1] lg:text-[13px]"
                          >
                            {posted}
                          </time>
                        )}
                        {own && (
                          <div className="absolute top-full right-0 pt-1">
                            <CommentRowMenu
                              menuId={`${menuIdBase}-menu-${comment.id}`}
                              open={menuOpen}
                              deleting={deleting}
                              disabled={menusDisabled}
                              containerRef={menuOpen ? menuRef : undefined}
                              triggerRef={
                                menuOpen || deleting
                                  ? menuTriggerRef
                                  : undefined
                              }
                              onToggle={() =>
                                setOpenMenuCommentId((current) =>
                                  current === comment.id ? null : comment.id,
                                )
                              }
                              onEdit={() => startEditing(comment)}
                              onDelete={() => void deleteComment(comment.id)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* `break-words` so a pasted URL can't widen the panel past
                        its `max-w`, `whitespace-pre-line` so the author's own
                        line breaks survive. */}
                    <p className="mt-1.5 break-words whitespace-pre-line text-[13.5px] leading-[1.55] text-ink-soft lg:text-[15px] lg:leading-[1.6]">
                      {comment.comment}
                    </p>
                    {error && (
                      <p
                        role="alert"
                        className="mt-2.5 rounded-lg border border-danger/25 bg-danger/6 px-3 py-2 text-[12.5px] leading-[1.5] text-ink-soft lg:text-[13.5px]"
                      >
                        {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : state.status === "loading" ? (
            <>
              {/* One polite announcement stands in for the whole decorative
                  skeleton, as in `ItineraryDetailSkeleton`. */}
              <p role="status" className="sr-only">
                Loading comments…
              </p>
              {/* `overflow-hidden`, not `overflow-y-auto`: there is nothing
                  here to scroll to, and a scrollbar that blinks in for the
                  skeleton alone would be a visible seam. */}
              <ul
                aria-hidden="true"
                className="h-full space-y-2 overflow-hidden pr-1"
              >
                <CommentSkeletonRow bodyWidths={["92%", "64%"]} />
                <CommentSkeletonRow bodyWidths={["78%"]} />
                <CommentSkeletonRow bodyWidths={["86%", "48%"]} />
              </ul>
            </>
          ) : state.status === "error" ? (
            <div className="flex h-full items-center justify-center">
              <p
                role="alert"
                className="rounded-xl border border-danger/25 bg-danger/6 px-3.5 py-3 text-center text-[13px] leading-[1.55] text-ink-soft lg:text-[14.5px]"
              >
                We couldn’t load the comments for this guide. Please close this
                and try again in a moment.
              </p>
            </div>
          ) : (
            <p className="flex h-full items-center justify-center px-3.5 text-center text-[13.5px] text-ink-soft lg:text-[14.5px]">
              No comments yet.
            </p>
          )}
        </div>

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
                className="text-[13px] font-bold text-ink lg:text-[14.5px]"
              >
                {editing ? "Edit your comment" : "Add a comment"}
              </label>
              <span
                id={counterId}
                className={`flex-none text-[12px] tabular-nums lg:text-[13px] ${
                  overLimit ? "font-bold text-danger" : "text-[#8b98a1]"
                }`}
              >
                {trimmedLength}/{MAX_COMMENT_LENGTH}
              </span>
            </div>

            <textarea
              ref={textareaRef}
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
              className={`mt-2 w-full resize-y rounded-xl border bg-surface-3 px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-ink outline-offset-2 outline-brand-500 placeholder:text-[#9fb1bd] focus-visible:outline-2 lg:min-h-[108px] lg:px-4 lg:py-3 lg:text-[15px] lg:leading-[1.6] ${
                overLimit ? "border-danger/50" : "border-line"
              } ${posting ? "opacity-70" : ""}`}
            />

            {postError && (
              <p
                id={postErrorId}
                role="alert"
                className="mt-3 rounded-xl border border-danger/25 bg-danger/6 px-3.5 py-3 text-[13px] leading-[1.55] text-ink-soft lg:text-[14.5px]"
              >
                {postError}
              </p>
            )}

            <div className="mt-3 flex items-center justify-end gap-4">
              {/* The way out of edit mode without retyping the original or
                  saving something half-changed. A plain text control: it is
                  the secondary action and shouldn't compete with the pill. */}
              {editing && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={posting}
                  className="cursor-pointer text-[13.5px] font-bold text-[#68767f] underline-offset-2 outline-offset-2 outline-brand-500 hover:text-brand-700 hover:underline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-55 lg:text-[14.5px]"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={posting}
                className={`tp-btn-shadow inline-flex items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-2.5 text-[14px] font-bold text-white lg:px-6 lg:py-3 lg:text-[15px] shadow-[0_12px_24px_-14px_rgba(19,74,111,.9)] outline-offset-2 outline-brand-500 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${
                  posting ? "cursor-wait" : ""
                }`}
              >
                {posting && <SpinnerIcon size={15} />}
                {editing
                  ? posting
                    ? "Saving…"
                    : "Edit comment"
                  : posting
                    ? "Posting…"
                    : "Post comment"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * A stand-in for one comment while the initial read is in flight: the same
 * `<li>` box, padding and rhythm as a real row, with `lp-shimmer` bars where
 * the username and body will go (the convention `ItineraryDetailSkeleton`'s
 * `Bar` follows, `prefers-reduced-motion` fallback included in globals.css).
 * The bars' heights match the real lines' type sizes at each breakpoint, so
 * the swap to real rows is a fill-in rather than a jump. Decorative only — the
 * caller's `<ul>` is `aria-hidden`, and one `role="status"` line speaks for
 * all of them.
 */
function CommentSkeletonRow({
  bodyWidths,
}: {
  /** One shimmering line per entry, as a CSS width — varied per row so three
   *  identical blocks don't read as a pattern rather than as text. */
  bodyWidths: readonly string[];
}) {
  return (
    <li className="rounded-xl bg-surface-2 px-3.5 py-3 lg:px-4 lg:py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="lp-shimmer block h-[13.5px] w-24 rounded-full lg:h-[15px] lg:w-28" />
        <span className="lp-shimmer block h-[12px] w-16 flex-none rounded-full lg:h-[13px]" />
      </div>
      <div className="mt-2.5 space-y-2">
        {bodyWidths.map((width, index) => (
          <span
            key={index}
            className="lp-shimmer block h-[11px] rounded-full lg:h-[12px]"
            style={{ width }}
          />
        ))}
      </div>
    </li>
  );
}

/**
 * The three-dot trigger and its Edit/Delete dropdown for one of the reader's
 * own comments.
 *
 * A disclosure (`aria-expanded` + `aria-controls` on a plain button, two plain
 * buttons inside), deliberately not `role="menu"`: an ARIA menu promises arrow-
 * key roving focus and typeahead, and two items don't earn that machinery.
 * The dropdown follows the trigger in DOM order, so Tab walks straight into it.
 *
 * Hidden at rest and revealed by the row's `group-hover` *or*
 * `group-focus-within` — so keyboard focus landing on the trigger reveals it
 * too — and always shown on devices with no hover at all, where a hover-only
 * control would simply not exist.
 */
function CommentRowMenu({
  menuId,
  open,
  deleting,
  disabled,
  containerRef,
  triggerRef,
  onToggle,
  onEdit,
  onDelete,
}: {
  menuId: string;
  open: boolean;
  /** This row's DELETE is in flight: the trigger becomes a spinner. */
  deleting: boolean;
  /** Some other write is in flight; the dialog runs one at a time. */
  disabled: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const itemClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-ink outline-offset-[-2px] focus-visible:outline-2 lg:text-[14px]";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={disabled ? undefined : onToggle}
        // `aria-disabled`, not `disabled`: this button is where focus is parked
        // while its own row's delete is in flight, and a disabled control would
        // drop that focus out of the dialog's trap.
        aria-disabled={disabled || undefined}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={deleting ? "Deleting your comment" : "Your comment options"}
        className={`-mr-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[#68767f] outline-offset-2 outline-brand-500 transition-opacity focus-visible:outline-2 ${
          open || deleting
            ? "bg-[#eaf3f9] text-brand-700 opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        } ${
          disabled
            ? "cursor-not-allowed"
            : "cursor-pointer hover:bg-[#eaf3f9] hover:text-brand-700"
        }`}
      >
        {deleting ? <SpinnerIcon size={14} /> : <MoreIcon size={16} />}
      </button>

      {open && (
        <div
          id={menuId}
          // White on the row's `surface-2`, with the same drop shadow the like
          // chip's bubbles use, so it reads as lifted off the row.
          className="absolute top-[calc(100%+4px)] right-0 z-10 min-w-[140px] rounded-xl border border-line bg-white p-1 shadow-[0_12px_24px_-14px_rgba(11,36,56,.9)]"
        >
          <button
            type="button"
            onClick={onEdit}
            className={`${itemClass} outline-brand-500 hover:bg-surface-2 hover:text-brand-700 focus-visible:bg-surface-2`}
          >
            <EditIcon size={15} />
            Edit
          </button>
          {/* Quiet at rest and `danger` only on hover/focus — the same
              reasoning as the guide's own Delete chip in
              `GuideOwnerActions`. */}
          <button
            type="button"
            onClick={onDelete}
            className={`${itemClass} outline-danger hover:bg-danger/8 hover:text-danger focus-visible:bg-danger/8 focus-visible:text-danger`}
          >
            <TrashIcon size={15} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Whether a row belongs to the signed-in reader. A username comparison is
 * sufficient because usernames are unique in this app, so the wire needs no
 * author id. An optimistic row is never "own" for this purpose: it has no
 * server-side id yet for an edit or delete to address.
 */
function isOwnComment(
  comment: GuideComment,
  isAuthenticated: boolean,
  viewerUsername: string | null,
): boolean {
  return (
    isAuthenticated &&
    viewerUsername !== null &&
    comment.username === viewerUsername &&
    !comment.id.startsWith(OPTIMISTIC_ID_PREFIX)
  );
}

function commentUrl(guideSlug: string, commentId: string): string {
  return `/api/guides/${encodeURIComponent(guideSlug)}/comments/${encodeURIComponent(commentId)}`;
}

/**
 * Folds a fresh read into what is on screen. The one race worth handling:
 * someone posts a comment while the GET is still open, and the response —
 * issued before their comment existed — doesn't contain it. Keeping it at the
 * top instead of silently un-posting it, and de-duplicating by id if the
 * server did see it. Only ids in `sessionPosted` qualify: any other row the
 * server no longer returns was deleted, and keeping it would undo the delete.
 */
function mergeSessionPosts(
  previous: CommentsState,
  fetched: GuideComment[],
  sessionPosted: ReadonlySet<string>,
): CommentsState {
  if (previous.status !== "loaded" || previous.comments.length === 0) {
    return { status: "loaded", comments: fetched };
  }
  const known = new Set(fetched.map((entry) => entry.id));
  const local = previous.comments.filter(
    (entry) => !known.has(entry.id) && sessionPosted.has(entry.id),
  );
  return { status: "loaded", comments: [...local, ...fetched] };
}

/** A failed delete as prose. No 400 or 429 branch: the route takes no body
 *  and isn't rate-limited. */
function deleteFailureMessage(status: number): string {
  if (status === 401) {
    return "You’re signed out, so the comment wasn’t deleted. Sign in and try again.";
  }
  if (status === 403) {
    return "You can only delete your own comments.";
  }
  if (status === 404) {
    return "That comment isn’t there any more — it may already have been deleted.";
  }
  return "We couldn’t delete that comment. Please try again in a moment.";
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
 *
 * `intent` covers the composer's two jobs: a new comment (`POST`) and an edit
 * of an existing one (`PATCH`), whose failure shapes match but for the 403 —
 * which the UI can't actually provoke, since only the reader's own rows offer
 * Edit, but which the route can still answer if the session changed underneath.
 */
function postFailureMessage(
  status: number,
  body: unknown,
  intent: "post" | "edit" = "post",
): string {
  const edit = intent === "edit";
  if (status === 400) {
    return (
      fieldErrorOf(body, "comment") ??
      (edit
        ? "That edit can’t be saved as written. Please change it and try again."
        : "That comment can’t be posted as written. Please edit it and try again.")
    );
  }
  if (status === 401) {
    return edit
      ? "You’re signed out, so your edit wasn’t saved. Sign in and try again."
      : "You’re signed out, so your comment wasn’t posted. Sign in and try again.";
  }
  if (status === 403) {
    return "You can only edit your own comments.";
  }
  if (status === 404) {
    return edit
      ? "That comment isn’t there any more, so your edit wasn’t saved."
      : "This guide isn’t there any more, so your comment wasn’t posted.";
  }
  if (edit) {
    return "We couldn’t save your edit. Please try again in a moment.";
  }
  if (status === 429) {
    // Deliberately not through `fieldErrorOf`: the rate-limit body carries no
    // `fields` key at all, and nothing about *this* comment is the problem.
    const retryAfterSeconds = parseRetryAfter(body);
    return retryAfterSeconds === null
      ? "You’ve posted a lot of comments just now. Please try again later."
      : `You’ve posted a lot of comments just now. You can post again in ${formatRetryAfter(
          retryAfterSeconds,
        )}.`;
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
 * `retryAfterSeconds` off the route’s 429 body, or `null`.
 *
 * Kept local, the way `readJson` and `fieldErrorOf` are, rather than imported:
 * `services/rateLimit.ts` is server-only (it pulls in mongoose), and there is no
 * shared client-side parsing module in this app — `lib/validation/*` is Zod
 * schemas for API routes. `GuideAuthorBar` holds its own copy for the like
 * endpoint’s identical 429 shape.
 *
 * Same discipline as `parseComment` below: the body is untrusted at the type
 * level, so a missing, non-numeric, non-finite or non-positive value is a parse
 * miss rather than a cooldown of `NaN` milliseconds — which `window.setTimeout`
 * fires immediately, and which `Date.now() + NaN` turns into a comparison that
 * is `false` forever.
 */
function parseRetryAfter(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const { retryAfterSeconds } = body as { retryAfterSeconds?: unknown };
  if (
    typeof retryAfterSeconds !== "number" ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds <= 0
  ) {
    return null;
  }
  return retryAfterSeconds;
}

/**
 * A retry window as coarse prose — "about 30 seconds", "about a minute",
 * "about 10 minutes". Static by design: a ticking countdown inside a
 * `role="alert"` would re-announce itself every second, and the exact boundary
 * is the server’s to hold, not this component’s to promise to the second.
 */
function formatRetryAfter(seconds: number): string {
  if (seconds < 50) {
    return `about ${Math.max(5, Math.ceil(seconds / 5) * 5)} seconds`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
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

/**
 * Whether a cooldown timestamp is still in the future.
 *
 * A function of the clock rather than a boolean held in state, so a window
 * whose release timer never fired — or was never registered — still stops
 * mattering the moment it lapses, with no ticking interval behind it.
 *
 * Module scope is deliberate: `react-hooks/purity` refuses a clock read inside
 * a component body, and in general it is right to. This is the narrow case
 * where that read *is* the point, and it is safe here because
 * `postCooldownUntil` is `null` on the server render and through
 * hydration (a cooldown can only ever be learned from a 429 this browser
 * received), and because every re-render whose answer differs is one React was
 * already performing anyway.
 *
 * Don’t wrap the call site in `useMemo` (and don’t enable React Compiler
 * without revisiting this): memoising on the timestamp alone would freeze the
 * answer at what it was when the cooldown was armed, which is exactly what a
 * window with no release timer behind it depends on not happening.
 */
function isCoolingDown(until: number | null): boolean {
  return until !== null && until > Date.now();
}

/**
 * `Date.now() + holdMs`, at module scope for `isCoolingDown`'s reason. Only
 * ever called from `startPostCooldown`, i.e. from a submit handler — but once
 * the edit/delete paths were added, `react-hooks/purity` stopped being able to
 * prove that and flagged the inline clock read as reachable from render.
 */
function deadlineAfter(holdMs: number): number {
  return Date.now() + holdMs;
}
