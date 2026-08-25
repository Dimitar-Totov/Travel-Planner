"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CloseIcon } from "@/components/icons";

/** Everything that can hold focus and isn't explicitly removed from the tab
 *  order — used to wrap Tab around inside the dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The full-screen map on phones and tablets.
 *
 * Below `lg` there is no room to show the map beside the itinerary, so it
 * becomes a modal surface instead: the reading column keeps the whole viewport
 * and the map is one tap away. Because it is genuinely modal it behaves like a
 * dialog — body scroll locked while it is up, focus moved in and trapped,
 * Escape closes, and focus returns to whatever opened it.
 */
export default function MapOverlaySheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Saving the inline value rather than assuming "" means a future scroll
    // lock elsewhere on the page survives this one closing.
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
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const root = rootRef.current;
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

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Itinerary map"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={{
        duration: reduceMotion ? 0.12 : 0.3,
        ease: [0.2, 0.7, 0.2, 1],
      }}
      className="fixed inset-0 z-50 bg-[#e9eff2] lg:hidden"
    >
      {children}

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close map"
        className="tp-btn absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-[0_14px_30px_-16px_rgba(11,36,56,.8)] outline-offset-2 outline-brand-500 focus-visible:outline-2"
      >
        <CloseIcon size={18} />
      </button>
    </motion.div>
  );
}
