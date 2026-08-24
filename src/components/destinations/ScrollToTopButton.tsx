"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpIcon } from "@/components/icons";
import { useScrollToTop } from "@/lib/utils/useScrollToTop";

/**
 * Floating "back to top" affordance for the guide feed, which pages in eight
 * cards at a time and gets long fast.
 *
 * Mounted only by `app/destinations/page.tsx` — the route boundary is what
 * makes it structurally impossible for this to appear anywhere else.
 *
 * `AnimatePresence` is what earns the dependency here: an exit animation needs
 * the element to stay in the tree while it animates out, which plain
 * conditional rendering cannot do. Motion also drives the hover/press lift
 * instead of the shared `.tp-btn` class, because a CSS `transform` transition
 * would fight the inline transform Motion writes every frame.
 */
export default function ScrollToTopButton() {
  const { visible, scrollToTop } = useScrollToTop();
  const reduceMotion = useReducedMotion();

  // Reduced motion keeps the fade (opacity is not vestibular) but drops the
  // travel and the scale, and shortens it to a plain cross-fade.
  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 18, scale: 0.8 };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Scroll to top"
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={
            reduceMotion
              ? { duration: 0.12, ease: "linear" }
              : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
          }
          whileHover={reduceMotion ? undefined : { y: -3 }}
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          /* The white ring is load-bearing: the feed's own footer is navy, and
             the brand gradient alone nearly disappears against it. On the
             white feed the ring is simply invisible. */
          className="fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] text-white ring-2 ring-white/70 shadow-[0_18px_34px_-14px_rgba(19,74,111,.9)] outline-offset-4 outline-brand-500 focus-visible:outline-2 sm:bottom-8 sm:right-8 sm:h-[52px] sm:w-[52px]"
        >
          <ArrowUpIcon size={21} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
