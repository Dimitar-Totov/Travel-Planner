"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DestinationGuide } from "@/lib/destinationGuides";
import { formatLikes } from "@/lib/destinationGuides";
import {
  CheckIcon,
  CommentIcon,
  HeartIcon,
  ShareIcon,
} from "@/components/icons";

/**
 * The author strip under the hero: who wrote the guide, when, and the action
 * row.
 *
 * The social controls are **local state only** — there is no accounts or social
 * API behind `/destinations` yet, so Follow and the like count live in this
 * component and reset on navigation. They are built now because the shape of
 * the interaction (optimistic toggle, count moves with it) is what the eventual
 * endpoint will have to serve, and because a row of dead pills reads as broken.
 *
 * The row has two shapes, decided by `ownerActions`:
 *
 * - **Reader** (no slot) — Follow · like · comment · share, as it has always
 *   been.
 * - **Author** (slot present) — the owner's own controls in place of the first
 *   three, then share. Follow, like and comment are all self-directed nonsense
 *   on a guide you wrote: you can't follow yourself, a like on your own work is
 *   noise in your own count, and the comment button is a disabled stub. Share
 *   survives in both, in the same trailing position, because copying a link to
 *   a guide you just published is the single most useful thing in the row.
 *
 * `following`/`liked` are still declared unconditionally in the author case —
 * hooks can't be branched — but nothing renders them there.
 */
export default function GuideAuthorBar({
  guide,
  publishedAt,
  ownerActions,
}: {
  guide: DestinationGuide;
  publishedAt: string;
  /**
   * `GuideOwnerActions`, when the signed-in reader wrote this guide. A slot
   * rather than an `isOwner` flag: ownership is decided on the server (see
   * `details/page.tsx`), and this client component has no business learning
   * who is reading — it only needs to know which shape of row to lay out.
   */
  ownerActions?: ReactNode;
}) {
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access is refused on insecure origins and in some embedded
      // browsers. Nothing to recover — leave the button in its resting state
      // rather than claiming a copy that never happened.
    }
  }

  const likes = guide.likes + (liked ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-[11px]">
        {/* Same CSS-gradient stand-in the feed card uses; there are no author
            photographs in the data model. */}
        <span
          className="h-[42px] w-[42px] flex-none rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.35)]"
          style={{ background: guide.avatarGradient }}
        />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold tracking-[-.01em] text-ink">
            {guide.author}
          </div>
          <div className="mt-0.5 text-[12.5px] text-[#8b98a1]">
            {publishedAt} · {guide.views.toLocaleString()} views
          </div>
        </div>
      </div>

      {/* One row, two casts. `gap-2` and `flex-none` are shared by both so the
          author's controls sit on exactly the same baseline and rhythm as the
          reader's, and the outer `flex-wrap` still drops the whole group onto
          its own line under the identity block at phone widths. */}
      <div className="flex flex-none items-center gap-2">
        {ownerActions ?? (
          <>
            <button
              type="button"
              aria-pressed={following}
              onClick={() => setFollowing((f) => !f)}
              className={`tp-btn rounded-full border px-5 py-2.5 text-[14px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 ${
                following
                  ? "border-[#d5e2ea] bg-white text-brand-700"
                  : "border-transparent bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] text-white shadow-[0_12px_24px_-14px_rgba(19,74,111,.9)]"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>

            <button
              type="button"
              aria-pressed={liked}
              aria-label={`${formatLikes(likes)} likes`}
              onClick={() => setLiked((l) => !l)}
              className={`tp-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 ${
                liked
                  ? "bg-gold-warm/15 text-gold-deep"
                  : "bg-surface-2 text-[#68767f] hover:bg-[#eaf3f9] hover:text-brand-700"
              }`}
            >
              <HeartIcon
                size={15}
                fill={liked ? "currentColor" : "none"}
                aria-hidden="true"
              />
              <span aria-hidden="true">{formatLikes(likes)}</span>
            </button>

            {/* Genuinely inert until there is a comments API — marked
                `disabled` rather than dressed up as a live control that
                silently does nothing. */}
            <button
              type="button"
              disabled
              title="Comments arrive with accounts"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2.5 text-[13px] font-bold text-[#a3b0b8]"
            >
              <CommentIcon size={15} />
              <span className="sr-only">Comments (not available yet)</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={share}
          aria-label={copied ? "Link copied" : "Copy link to this guide"}
          className={`tp-chip inline-flex h-[35px] items-center justify-center gap-1.5 rounded-full outline-offset-2 outline-brand-500 focus-visible:outline-2 ${
            copied
              ? "bg-success/12 px-3 text-[12.5px] font-bold text-success"
              : "w-[35px] bg-surface-2 text-[#68767f] hover:bg-[#eaf3f9] hover:text-brand-700"
          }`}
        >
          {copied ? <CheckIcon size={15} /> : <ShareIcon size={15} />}
          {copied && "Link copied"}
        </button>
      </div>

      {/* The button's own label changes, but a label change on the focused
          element is not reliably announced — this is. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
