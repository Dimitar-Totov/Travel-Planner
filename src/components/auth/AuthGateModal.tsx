"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CloseIcon, LockIcon } from "@/components/icons";

/** Everything that can hold focus and isn't explicitly removed from the tab
 *  order — used to wrap Tab around inside the dialog. Same list as
 *  `MapOverlaySheet`, the app's other modal surface. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The sign-in gate shown when a guest tries to start planning.
 *
 * Deliberately stickier than a normal dialog: it does **not** close on a
 * backdrop click and it does **not** close on Escape — the X button is the one
 * and only way out. That is the requested behaviour, so don't "fix" it by
 * adding the usual dismiss handlers.
 *
 * Unmounted entirely while closed rather than hidden, so the CSS entrance
 * animation replays on every open.
 */
export default function AuthGateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Lock body scroll, move focus into the panel, and hand focus back to
  // whatever opened the modal once it goes away.
  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    // Saving the inline value rather than assuming "" means a scroll lock set
    // elsewhere on the page survives this one closing.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open]);

  // Tab is wrapped inside the panel so the gated page behind it can't be
  // reached by keyboard. Escape is intentionally *not* handled here.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
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
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // Portalled to <body> so no transformed/overflow-clipped ancestor on the
    // landing page can become its containing block or clip it.
    <>
      {/* Scrim only — clicking it is a no-op on purpose; the X button is the
          only dismissal affordance. */}
      <div
        className="tp-modal-backdrop fixed inset-0 z-[60] bg-[rgba(8,32,50,.62)] backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* overflow-y-auto so the card is still reachable in a short landscape
          viewport, where a strictly centred panel would clip off both ends. */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center overflow-y-auto p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="tp-modal-panel relative w-full max-w-[420px] rounded-[22px] bg-white p-7 text-left shadow-[0_34px_80px_rgba(8,40,63,.24)] sm:p-8"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3.5 top-3.5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#7c93a3] outline-offset-2 outline-brand-500 transition-colors duration-150 hover:bg-[#f2f6f9] hover:text-[#33556c] focus-visible:outline-2"
          >
            <CloseIcon size={17} />
          </button>

          <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[linear-gradient(150deg,#eaf4fb,#d6e9f5)] text-[#1c6392]">
            <LockIcon size={21} />
          </span>

          <h2
            id={headingId}
            className="mt-4 text-[23px] font-extrabold leading-[1.2] tracking-[-.025em] text-[#14405c] text-pretty"
          >
            Sign in to plan your trip
          </h2>
          <p className="mt-2.5 text-[14.5px] leading-[1.6] text-[#6f8899] text-pretty">
            Itineraries are built against your account, so every plan is saved
            as it&rsquo;s generated — ready to reopen, refine, and pick up on
            any device.
          </p>

          <Link
            href="/sign-in"
            className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-6 py-[14px] text-[15px] font-bold text-white shadow-[0_16px_30px_-14px_rgba(15,58,88,.9)] outline-offset-2 outline-brand-500 focus-visible:outline-2"
          >
            Sign in
          </Link>

          <p className="mt-4 text-center text-[13.5px] text-[#7b91a1]">
            New here?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-[#1f6f9f] underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}
