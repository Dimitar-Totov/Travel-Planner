"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { SpinnerIcon, TrashIcon } from "@/components/icons";

/** Everything that can hold focus and isn't explicitly removed from the tab
 *  order. Same list `MapOverlaySheet` and `LocationPickerModal` trap against. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * What went wrong, in words, plus whether pressing the button again could
 * possibly help.
 *
 * `retryable: false` is not cosmetic — it removes the destructive button
 * entirely. A 404 means the guide is already gone (or was never this author's),
 * and offering to try deleting it again is an invitation to sit there pressing
 * a button that will fail identically every time.
 */
interface DeleteFailure {
  message: string;
  retryable: boolean;
  /** Renders the sign-in link — only the 401 path sets it. */
  signedOut?: boolean;
}

interface DeleteGuideDialogProps {
  slug: string;
  /** The guide's title, named in the prompt. A confirmation that doesn't say
   *  what it is about to destroy isn't a confirmation. */
  title: string;
  onClose: () => void;
}

/**
 * "Delete this guide?", asked properly.
 *
 * Deliberately not `window.confirm`: that dialog can't be styled, can't be
 * read by the page's own live regions, blocks the main thread, is suppressible
 * by the browser, and — the part that matters most here — gives no room to say
 * which guide, or that the deletion is permanent.
 *
 * Follows the modal conventions this codebase already has
 * (`MapOverlaySheet`, `LocationPickerModal`): `motion/react` with
 * `AnimatePresence` owned by the caller, `useReducedMotion` respected, body
 * scroll locked, focus moved in and trapped, Escape and a backdrop click both
 * close, and focus restored to whatever opened it.
 *
 * Two things it does that they don't:
 *
 * - **Focus lands on Cancel, not on Delete.** A confirmation whose destructive
 *   button is pre-focused turns an absent-minded Space or Enter into data loss,
 *   which is the exact failure the dialog exists to prevent.
 * - **It refuses to close while the request is in flight.** Escape and the
 *   backdrop are inert, both buttons are disabled, and the panel carries
 *   `aria-busy`. Unmounting mid-`DELETE` would abort a request whose *result*
 *   the author needs, and leave them with no idea whether the guide survived.
 */
export default function DeleteGuideDialog({
  slug,
  title,
  onClose,
}: DeleteGuideDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const bodyId = useId();

  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<DeleteFailure | null>(null);

  // `deleting` stays `true` through the successful path as well: `router.push`
  // is asynchronous, and re-enabling the buttons for the frames between the
  // 200 and the navigation would let someone fire a second DELETE at a guide
  // that no longer exists.
  const busyRef = useRef(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Saving the inline value rather than assuming "" means a scroll lock set
    // elsewhere on the page survives this one closing.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  // A non-retryable failure removes the Delete button, and it is the element
  // that was focused when it was pressed — without this, focus falls back to
  // `<body>` and a keyboard user has to Tab in from the top of the document to
  // reach the only control left.
  useEffect(() => {
    if (failure && !failure.retryable) cancelRef.current?.focus();
  }, [failure]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!busyRef.current) onClose();
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

  async function confirmDelete() {
    if (busyRef.current) return;
    busyRef.current = true;
    setDeleting(true);
    setFailure(null);

    let response: Response;
    try {
      response = await fetch(`/api/guides/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
    } catch {
      // `fetch` only rejects on a transport failure, so this is genuinely
      // "the request never landed" — nothing was deleted, and trying again is
      // the right advice.
      busyRef.current = false;
      setDeleting(false);
      setFailure({
        message:
          "We couldn’t reach the server, so nothing has been deleted. Check your connection and try again.",
        retryable: true,
      });
      return;
    }

    if (response.ok) {
      // Both `/destinations` and this page are server components rendered per
      // request, and this session's router cache still holds the versions that
      // included this guide. Without the refresh the feed we land on can still
      // be listing what we just deleted.
      //
      // Refresh before push, and both in the same tick: `refresh()` re-renders
      // the route we're still on — which now 404s — so the navigation has to be
      // queued behind it immediately rather than awaited, or the author gets a
      // "not found" flash on the way out of their own deleted guide.
      router.refresh();
      router.push("/destinations");
      // `busyRef`/`deleting` stay set. The push is asynchronous, and
      // re-enabling the buttons for those frames would allow a second DELETE
      // against a guide that no longer exists.
      return;
    }

    busyRef.current = false;
    setDeleting(false);
    setFailure(failureFor(response.status, await errorMessageOf(response)));
  }

  return (
    <motion.div
      // The whole overlay is one element: it is the scrim *and* the centring
      // box. A separate absolutely-positioned scrim would need its own
      // `aria-hidden` and its own click target for no visual gain.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
      onMouseDown={(event) => {
        // `mousedown` with a target check rather than `click`: a drag that
        // starts on the panel and ends on the scrim fires `click` here too,
        // and closing a destructive confirmation because of a stray text
        // selection would be its own small disaster.
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-deep/55 p-4 backdrop-blur-[2px]"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        aria-busy={deleting}
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
        // overflowing top clipped and unreachable, which on a short viewport
        // would hide the heading. Auto margins centre it without that.
        className="my-auto w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-[0_40px_80px_-40px_rgba(11,36,56,.85)] sm:p-6"
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-danger/10 text-danger"
          >
            <TrashIcon size={19} />
          </span>

          <div className="min-w-0">
            <h2
              id={headingId}
              className="text-[17px] font-extrabold leading-[1.25] tracking-[-.02em] text-ink"
            >
              Delete this guide?
            </h2>
            <p
              id={bodyId}
              className="mt-2 text-[13.5px] leading-[1.55] text-ink-soft"
            >
              <span className="font-bold">“{title}”</span> and every day, stop
              and note in it will be removed for good. This can’t be undone, and
              anyone holding a link to it will find nothing there.
            </p>
          </div>
        </div>

        {failure && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger/25 bg-danger/6 px-3.5 py-3 text-[13px] leading-[1.55] text-ink-soft"
          >
            {failure.message}
            {failure.signedOut && (
              <>
                {" "}
                <Link
                  href={`/sign-in?callbackUrl=${encodeURIComponent(pathname)}`}
                  className="font-bold text-brand-700 underline underline-offset-2 outline-offset-2 outline-brand-500 hover:text-brand-600 focus-visible:outline-2"
                >
                  Sign in
                </Link>
                .
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="tp-btn-shadow rounded-full border border-[#d5e2ea] bg-white px-5 py-2.5 text-[14px] font-bold text-brand-700 outline-offset-2 outline-brand-500 hover:border-brand-700 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {failure && !failure.retryable ? "Close" : "Cancel"}
          </button>

          {/* Dropped entirely once retrying is pointless — see `DeleteFailure`. */}
          {(!failure || failure.retryable) && (
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              aria-busy={deleting}
              className={`tp-btn-shadow inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_14px_28px_-16px_rgba(192,69,63,.95)] outline-offset-2 outline-danger hover:bg-[#a93a35] focus-visible:outline-2 ${
                deleting ? "cursor-wait opacity-80" : ""
              }`}
            >
              {deleting ? <SpinnerIcon size={15} /> : <TrashIcon size={15} />}
              {deleting ? "Deleting…" : "Delete guide"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The API answers every failure with `{ error }`; the body is untrusted at the
 *  type level, so every branch is checked (as `uploadGuidePhotos` does). */
async function errorMessageOf(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null) return null;
  const { error } = body as { error?: unknown };
  return typeof error === "string" && error.trim() !== "" ? error : null;
}

/**
 * Status to prose. Never a bare code — "404" tells the author nothing about
 * what to do next, and every one of these has a different next step.
 */
function failureFor(status: number, error: string | null): DeleteFailure {
  switch (status) {
    case 401:
      return {
        message:
          "You’re signed out, so we can’t confirm this guide is yours. Nothing has been deleted.",
        retryable: false,
        signedOut: true,
      };
    case 404:
      // The route answers 404 for "no such guide" and "not your guide" alike,
      // on purpose, so this message has to cover both without picking one.
      return {
        message:
          "This guide isn’t there any more — it may already have been deleted, or it isn’t yours to delete.",
        retryable: false,
      };
    default:
      return {
        message:
          error ??
          `Something went wrong on the server (${status}) and the guide wasn’t deleted. Please try again.`,
        retryable: true,
      };
  }
}
