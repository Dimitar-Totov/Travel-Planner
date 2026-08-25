"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query from React.
 *
 * This exists for the one case Tailwind can't cover: deciding whether to
 * *mount* something, not just whether to show it. The guide detail page has a
 * MapLibre canvas that costs a WebGL context, so `hidden lg:block` would leave
 * a live GPU-backed map running behind `display:none` on every phone. Gating
 * the mount on the same 1024px breakpoint keeps exactly one map alive.
 *
 * `useSyncExternalStore` rather than `useState` + an effect because it has a
 * dedicated server snapshot: the server (and the hydration pass) always sees
 * `false`, then React re-renders with the real value — no hydration mismatch,
 * and no flash of a desktop layout on mobile.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
