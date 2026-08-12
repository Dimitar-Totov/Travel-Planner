import type { ReactNode } from "react";

/**
 * Carries a link's visual weight without being one. The design calls for
 * "Forgot?", "Terms" and "Privacy Policy", but none of those routes exist yet
 * — pointing at a 404 would be worse than not navigating at all.
 *
 * A styled `<span>` rather than a disabled `<button>`: this always appears
 * inline inside a sentence, so it shouldn't add a dead tab stop. The
 * visually-hidden suffix says out loud what the tooltip says on hover, since a
 * `title` alone is invisible to keyboard and screen-reader users.
 */
export default function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <span
      title="Coming soon"
      className="cursor-default font-semibold text-brand-600"
    >
      {children}
      <span className="sr-only"> (coming soon)</span>
    </span>
  );
}
