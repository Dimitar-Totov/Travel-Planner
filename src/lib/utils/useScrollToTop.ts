"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * How far down the document the user has to be before the affordance is worth
 * offering. Roughly half a laptop viewport — far enough that the button never
 * flickers in during the small scrolls that happen while reading the top of a
 * page, close enough that it is there by the time the header is gone.
 */
export const SCROLL_TO_TOP_THRESHOLD_PX = 400;

export interface ScrollToTopState {
  /** True once the page is scrolled past `threshold`. */
  visible: boolean;
  /** Scrolls the window back to the top, smoothly unless motion is reduced. */
  scrollToTop: () => void;
}

/** Read live rather than caching: the OS setting can change mid-session. */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scroll-position tracking plus the scroll-to-top action, kept apart from any
 * markup so the button that consumes it stays pure presentation.
 *
 * `scroll` fires far more often than the browser can paint, so every burst is
 * coalesced into a single read per animation frame — the listener itself does
 * nothing but schedule that frame, and it is registered `passive` so it can
 * never block scrolling.
 */
export function useScrollToTop(
  threshold: number = SCROLL_TO_TOP_THRESHOLD_PX,
): ScrollToTopState {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      setVisible(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(read);
    };

    // Sync once on mount: a back-navigation or a reload can restore a scroll
    // position without ever firing a scroll event.
    read();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  return { visible, scrollToTop };
}
