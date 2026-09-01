"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { TrashIcon } from "@/components/icons";
import DeleteGuideDialog from "./DeleteGuideDialog";

/**
 * Pencil-on-a-line, drawn on the same 24x24 Lucide grid as
 * `components/icons.tsx`'s set.
 *
 * Local to this file rather than added to that set because this is the only
 * surface in the app with an "edit the thing you're looking at" affordance —
 * `/create-guide`'s own controls are all add/remove/reorder, which `PlusIcon`,
 * `TrashIcon` and the arrows already cover. If a second caller ever appears,
 * this is the moment to move it.
 */
function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

interface GuideOwnerActionsProps {
  /** The guide's URL slug — the edit route's segment and the DELETE path. */
  slug: string;
  /**
   * The guide's title. Named in the delete confirmation, so nobody destroys
   * the wrong guide, and in both controls' accessible names, since "Edit" and
   * "Delete" on their own don't say *what*.
   */
  title: string;
}

/**
 * Edit and Delete, shown only to the guide's own author.
 *
 * Handed to `GuideAuthorBar` as its `ownerActions` slot and rendered *inside*
 * that bar's action row, taking the place of Follow, like and comment — none of
 * which mean anything on a guide you wrote. It is deliberately not a separate
 * tray under the bar: a second surface for two buttons costs a whole band of
 * vertical space above the fold, and an explanatory "this guide is yours" note
 * tells the author something they already know from having written it.
 *
 * It renders **no wrapper of its own** — these are two direct children of the
 * bar's `flex … gap-2` row, so they share that row's gap and baseline with the
 * Share button that follows them, rather than being a nested group with its own
 * spacing to keep in sync.
 *
 * The weighting is the point:
 *
 * - **Edit inherits Follow's slot and Follow's gradient** — the same filled
 *   `brand` gradient pill, first in the row. It is the author's primary action
 *   here, and reusing the fill keeps the row's visual rhythm instead of leaving
 *   a hole where the loudest control used to be. It does *not* inherit Follow's
 *   resting drop-shadow, though — see the shared hover affordance below.
 * - **Delete stays quiet** — a `surface-2` chip matching the like/share chips at
 *   rest, reaching for `danger` only on hover and focus. A permanently red
 *   button under your own guide reads as a warning *about the guide*.
 *
 * Both share one class for their interaction, `tp-chip-shadow`, and neither
 * carries a resting `shadow-[...]`. Not `tp-btn`/`tp-chip`, whose lift would
 * make one of the pair visibly rise past the other since they sit right next
 * to each other; not `tp-btn-shadow` either, which is a differently-tinted,
 * heavier hover shadow that made Edit read as a different weight of button
 * than Delete the moment they stood side by side. One class, one hover value,
 * for both.
 *
 * **This is not a permission boundary.** Both endpoints re-check authorship
 * server-side; hiding a button only keeps the UI honest.
 */
export default function GuideOwnerActions({
  slug,
  title,
}: GuideOwnerActionsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {/* Follow's exact pill recipe — gradient, shadow, `px-5 py-2.5`,
          `text-[14px]` — plus the icon gap. Copied rather than extracted: the
          two never render together, and a shared class would have to be
          reconciled with Follow's second (`following`) state, which this
          button has no equivalent of.

          One word, like Follow, and like Delete beside it. "Edit guide" was
          the first cut, but at 320px the three controls plus their gaps came
          to ~287px against the 280px the reading column's `px-5` leaves — the
          row overflowed instead of wrapping, since the group is `flex-none`.
          The noun lives in the accessible name below, where it costs nothing. */}
      <Link
        href={`/destinations/guide/${slug}/edit`}
        // Same reasoning as Delete's: the visible word is the first word of
        // the accessible name, so speech input still matches what's on screen
        // (WCAG 2.5.3), and what follows says which guide.
        aria-label={`Edit “${title}”`}
        // `tp-chip-shadow` — the exact class Delete uses below, not `tp-btn`
        // (which lifts) or `tp-btn-shadow` (whose hover shadow is a heavier,
        // differently-tinted recipe). Sharing one class means the pair's
        // hover box-shadow is the same value, not just the same *idea*, and
        // there's no resting `shadow-[...]` either — Delete has none, so a
        // permanent shadow under Edit alone made the two read as different
        // weights of button before either was touched.
        // `cursor-pointer` is explicit rather than left to the UA stylesheet:
        // Firefox's default `<button>` cursor is the plain arrow, not a
        // pointer, so without this Edit (a link) and Delete (a button) show
        // two different cursors there even though both are equally clickable.
        className="tp-chip-shadow inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-2.5 text-[14px] font-bold text-white outline-offset-2 outline-brand-500 focus-visible:outline-2"
      >
        <PencilIcon />
        Edit
      </Link>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        // The visible word is "Delete", which alone doesn't say *what*.
        // The accessible name leads with that same word (so speech input
        // still matches it — WCAG 2.5.3) and then names the guide.
        aria-label={`Delete “${title}”`}
        // `tp-chip-shadow`, not `tp-chip` — the shadow-only affordance Edit
        // shares above (same class, so the pair's hover shadow is identical,
        // not just similarly-shaped), rather than a lift that would make one
        // of them rise past the other. `bg-surface-2` +
        // `#68767f` is still the resting state the like and share chips use,
        // so at rest this reads as one of the row's chips rather than
        // something bolted on. The transparent border is what the `danger`
        // hover ring grows out of without the chip changing size, and
        // `cursor-pointer` is explicit for the same cross-browser reason
        // Edit's is.
        className="tp-chip-shadow inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-surface-2 px-3.5 py-2.5 text-[13px] font-bold text-[#68767f] outline-offset-2 outline-danger hover:border-danger/30 hover:bg-danger/8 hover:text-danger focus-visible:border-danger/30 focus-visible:bg-danger/8 focus-visible:text-danger focus-visible:outline-2"
      >
        <TrashIcon size={15} />
        Delete
      </button>

      {/* Mounted only while open, so the entrance animation replays on every
          confirmation and the focus trap has nothing to do in between. The
          dialog itself is `position: fixed`, so being a child of the bar's
          flex row costs it no layout box while it's up. */}
      <AnimatePresence>
        {confirming && (
          <DeleteGuideDialog
            slug={slug}
            title={title}
            onClose={() => setConfirming(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
