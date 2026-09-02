"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import type { DestinationGuide } from "@/lib/destinationGuides";
import { formatLikes } from "@/lib/destinationGuides";
import {
  CheckIcon,
  CommentIcon,
  HeartIcon,
  ShareIcon,
} from "@/components/icons";
import CommentsModal from "./CommentsModal";

/** How long the "tap to see it" tooltip stays pinned, and how long a failed
 *  like keeps its message up. Both are read-once notices — long enough to
 *  finish reading, short enough that they don't become furniture. */
const HINT_PIN_MS = 4000;
const LIKE_ERROR_MS = 3600;

/**
 * The author strip under the hero: who wrote the guide, when, and the action
 * row.
 *
 * What is and isn't backed by a real API here matters, because the three
 * controls still don't agree:
 *
 * - **Follow** is still **local state only** — there is no accounts/social API
 *   behind it, so it resets on navigation. Built now because the shape of the
 *   interaction is what the eventual endpoint will have to serve, and because a
 *   dead pill reads as broken.
 * - **Likes** are real in both directions: `likeCount`/`likedByViewer` are
 *   server reads from the `Like` collection, and the heart writes back through
 *   `POST /api/guides/<slug>/like`. It was a plain `<span>` for exactly as long
 *   as that write endpoint didn't exist — a toggle with nowhere to persist to
 *   is a number the next reload contradicts.
 * - **Comments** are real: `commentCount` is a server read from the `Comment`
 *   collection, rendered in the resting chip the way the like count is, and the
 *   button opens `CommentsModal`, which reads `GET /api/guides/<slug>/comments`
 *   and, for a signed-in reader, posts to it. The modal reports a successful
 *   post back through `onCommentPosted` so the chip and the modal's own badge
 *   never show two different numbers for the same guide.
 *
 * The row has two shapes, decided by `ownerActions`:
 *
 * - **Reader** (no slot) — Follow · likes · comments · share, as it has always
 *   been.
 * - **Author** (slot present) — the owner's own controls in place of the first
 *   three, then share. Follow and like are self-directed nonsense on a guide
 *   you wrote (you can't follow yourself, and your own like is noise in your
 *   own count), and the author reaches their comments the same way they reach
 *   the rest of the guide — by reading it. Share survives in both, in the same
 *   trailing position, because copying a link to a guide you just published is
 *   the single most useful thing in the row.
 *
 * `following`, the like state and the modal's open flag are still declared
 * unconditionally in the author case — hooks can't be branched — but nothing
 * renders them there.
 *
 * **The liked state is gold, not red.** `--color-danger` is this app's
 * destructive token (delete, validation failures) and reusing it for a liked
 * heart would make the palette lie about what red means. `--color-gold-warm` is
 * the documented "endorsed / held by the reader" token — already the saved
 * stop, the selected map pin and the verified badge — which is exactly what a
 * like is.
 */
export default function GuideAuthorBar({
  guide,
  publishedAt,
  likeCount,
  commentCount,
  likedByViewer,
  isAuthenticated,
  ownerActions,
}: {
  guide: DestinationGuide;
  publishedAt: string;
  /**
   * How many people have liked this guide, counted server-side from the `Like`
   * collection. A separate prop rather than `guide.likes`, which is the old
   * static seed field on `DestinationGuide`.
   */
  likeCount: number;
  /**
   * How many comments this guide has, counted server-side from the `Comment`
   * collection exactly as `likeCount` is. Read here so the resting chip carries
   * the number without anyone having to open the modal to learn it.
   */
  commentCount: number;
  /** Whether *this* reader already likes it — always `false` for an anonymous
   *  one, so it can seed the heart's resting state directly. */
  likedByViewer: boolean;
  /** Whether there is a session at all, regardless of like state. Decided on
   *  the server; this component never reads a session itself (there is no
   *  `useSession` anywhere in this app). */
  isAuthenticated: boolean;
  /**
   * `GuideOwnerActions`, when the signed-in reader wrote this guide. A slot
   * rather than an `isOwner` flag: ownership is decided on the server (see
   * `details/page.tsx`), and this client component has no business learning
   * who is reading — it only needs to know which shape of row to lay out.
   */
  ownerActions?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const hintId = useId();

  const [following, setFollowing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Seeded from the props once, then owned locally so a click lands
  // immediately. Deliberately *not* synced back from the props on re-render: a
  // `router.refresh()` mid-flight would otherwise stomp an optimistic toggle
  // with the count the server held before it. The response reconciles instead.
  const [liked, setLiked] = useState(likedByViewer);
  const [likes, setLikes] = useState(likeCount);
  // Same reasoning, one layer removed: the modal is what learns about a new
  // comment, and it tells this bar through `onCommentPosted` below. Re-syncing
  // from the prop would let a `router.refresh()` roll that back to the count the
  // server held before the comment was written.
  const [comments, setComments] = useState(commentCount);
  const [likeError, setLikeError] = useState<string | null>(null);
  /** Bumped on each successful like so the ring behind the heart remounts and
   *  replays; cleared by its own `onAnimationComplete`. */
  const [burst, setBurst] = useState<number | null>(null);

  // The sign-in tooltip has two independent reasons to be up: pointer/keyboard
  // (hover and focus, which end on their own) and a tap, which has neither —
  // so a tap pins it and a timer takes it back down.
  const [hintOpen, setHintOpen] = useState(false);
  const [hintPinned, setHintPinned] = useState(false);

  const copyTimer = useRef<number | undefined>(undefined);
  const hintTimer = useRef<number | undefined>(undefined);
  const likeErrorTimer = useRef<number | undefined>(undefined);
  /** In-flight guard for the like POST. A ref, not state: a second click in the
   *  same tick must see the flag the first one set, before any re-render. */
  const likeBusy = useRef(false);

  // Imperative rather than an `animate` prop, on purpose: Motion skips a
  // keyframe target it considers unchanged, so liking → unliking → liking
  // would play the pop once and then sit still. `animate()` fires every call.
  const [heartScope, animateHeart] = useAnimate<HTMLSpanElement>();

  useEffect(
    () => () => {
      window.clearTimeout(copyTimer.current);
      window.clearTimeout(hintTimer.current);
      window.clearTimeout(likeErrorTimer.current);
    },
    [],
  );

  const hintVisible = !isAuthenticated && (hintOpen || hintPinned);

  function pinHint() {
    setHintPinned(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(
      () => setHintPinned(false),
      HINT_PIN_MS,
    );
  }

  function dismissHint() {
    window.clearTimeout(hintTimer.current);
    setHintPinned(false);
    setHintOpen(false);
  }

  function showLikeError(message: string) {
    setLikeError(message);
    window.clearTimeout(likeErrorTimer.current);
    likeErrorTimer.current = window.setTimeout(
      () => setLikeError(null),
      LIKE_ERROR_MS,
    );
  }

  /** The delight moment: the heart pops as it fills, with one ring going out
   *  behind it. Only ever on the way *into* the liked state. */
  function popHeart() {
    if (reduceMotion) return;
    setBurst((n) => (n ?? 0) + 1);
    void animateHeart(
      heartScope.current,
      { scale: [1, 1.35, 0.88, 1.12, 1] },
      { duration: 0.44, times: [0, 0.24, 0.48, 0.74, 1], ease: "easeOut" },
    );
  }

  /** Coming back out is acknowledged, not celebrated — a single small dip,
   *  no ring, over the chip's own colour fade. */
  function dipHeart() {
    if (reduceMotion) return;
    void animateHeart(
      heartScope.current,
      { scale: [1, 0.88, 1] },
      { duration: 0.22, ease: "easeOut" },
    );
  }

  async function toggleLike() {
    // An anonymous reader never reaches the network: tapping reveals the
    // reason instead of firing a request that can only come back 401.
    if (!isAuthenticated) {
      pinHint();
      return;
    }
    if (likeBusy.current) return;
    likeBusy.current = true;

    const previousLiked = liked;
    const previousLikes = likes;
    const nextLiked = !previousLiked;

    setLikeError(null);
    window.clearTimeout(likeErrorTimer.current);
    setLiked(nextLiked);
    // Floored at zero: the seeded count and the viewer's own flag come from two
    // reads, and an inconsistent pair must not be able to render "-1 likes".
    setLikes((n) => Math.max(0, n + (nextLiked ? 1 : -1)));
    if (nextLiked) popHeart();
    else dipHeart();

    let response: Response;
    try {
      response = await fetch(
        `/api/guides/${encodeURIComponent(guide.slug)}/like`,
        { method: "POST" },
      );
    } catch {
      // `fetch` only rejects on a transport failure — the like never landed.
      likeBusy.current = false;
      setLiked(previousLiked);
      setLikes(previousLikes);
      showLikeError("We couldn’t save that. Please try again.");
      return;
    }

    if (!response.ok) {
      likeBusy.current = false;
      setLiked(previousLiked);
      setLikes(previousLikes);
      showLikeError(
        response.status === 401
          ? // The props said there was a session; by the time the click landed
            // there wasn't. Worth saying plainly rather than as a generic fail.
            "Your session has expired. Sign in to like this guide."
          : "We couldn’t save that. Please try again.",
      );
      return;
    }

    likeBusy.current = false;

    // Reconciled against the server's own numbers, so a like from another tab
    // or device (or a double-toggle racing itself) settles on the truth rather
    // than on this tab's arithmetic.
    const settled = parseLikeResponse(await readJson(response));
    if (!settled) return;
    setLiked(settled.liked);
    setLikes(settled.likeCount);
  }

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

            {/* `relative` only so the tooltip and the failure note have
                something to anchor to — the chip's own box is unchanged, and
                the row's rhythm with Follow/comment/share is preserved. */}
            <span
              className="relative inline-flex"
              onKeyDown={(event) => {
                if (event.key === "Escape" && hintVisible) dismissHint();
              }}
            >
              <button
                type="button"
                onClick={toggleLike}
                // Hover and focus both raise the sign-in hint, so it is never a
                // mouse-only affordance; the click path (see `toggleLike`) is
                // what covers touch, where neither exists.
                onMouseEnter={
                  isAuthenticated ? undefined : () => setHintOpen(true)
                }
                onMouseLeave={
                  isAuthenticated ? undefined : () => setHintOpen(false)
                }
                onFocus={isAuthenticated ? undefined : () => setHintOpen(true)}
                onBlur={isAuthenticated ? undefined : dismissHint}
                // Only a toggle when it can actually toggle. An anonymous
                // reader gets a plain button plus the description below, rather
                // than an `aria-pressed="false"` promising a state it can't
                // reach.
                aria-pressed={isAuthenticated ? liked : undefined}
                aria-describedby={hintVisible ? hintId : undefined}
                // The visible text is the number alone, which names nothing —
                // the count is repeated inside the label so the visible string
                // is still contained in the accessible name (WCAG 2.5.3) while
                // speech input still has "like" to match on.
                aria-label={`Like this guide, ${formatLikes(likes)} likes`}
                // `tp-chip-shadow`, not `tp-chip`: the like chip sits directly
                // beside the sign-in tooltip it can raise, and `tp-chip`'s
                // hover lift (`translateY(-1px)`) shifts the button out from
                // under a tooltip anchored to its pre-hover position. Same
                // affordance, shadow instead of movement — the reason
                // `tp-chip-shadow` exists in the first place (see its comment
                // in globals.css).
                className={`tp-chip-shadow inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-bold outline-offset-2 outline-brand-500 focus-visible:outline-2 ${
                  liked
                    ? "bg-gold-warm/12 text-gold-deep"
                    : "bg-surface-2 text-[#68767f] hover:bg-[#eaf3f9] hover:text-brand-700"
                }`}
              >
                <span className="relative inline-flex h-[15px] w-[15px] items-center justify-center">
                  {/* One quiet ring, not a particle shower: it reads as the
                      press landing rather than as confetti. Suppressed whole
                      under reduced motion — `popHeart` never sets `burst`. */}
                  {burst !== null && (
                    <motion.span
                      key={burst}
                      aria-hidden="true"
                      initial={{ scale: 0.55, opacity: 0.55 }}
                      animate={{ scale: 1.95, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      onAnimationComplete={() => setBurst(null)}
                      className="pointer-events-none absolute inset-[-5px] rounded-full border border-gold-warm"
                    />
                  )}
                  <span ref={heartScope} className="inline-flex">
                    <HeartIcon
                      size={15}
                      fill={liked ? "currentColor" : "none"}
                      // The count keeps `gold-deep` (the shade that clears
                      // 4.5:1 on a pale tint); the heart itself is the brighter
                      // `gold-warm`, which as a filled shape only has 3:1 to
                      // clear.
                      className={liked ? "text-gold-warm" : undefined}
                      aria-hidden="true"
                    />
                  </span>
                </span>
                {formatLikes(likes)}
              </button>

              <AnimatePresence>
                {hintVisible && (
                  <LikeBubble
                    key="hint"
                    tooltipId={hintId}
                    tone="neutral"
                    reduceMotion={Boolean(reduceMotion)}
                  >
                    Sign in to like this guide.
                  </LikeBubble>
                )}
                {likeError && (
                  <LikeBubble
                    key="error"
                    tone="danger"
                    reduceMotion={Boolean(reduceMotion)}
                  >
                    {likeError}
                  </LikeBubble>
                )}
              </AnimatePresence>
            </span>

            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={commentsOpen}
              // Same treatment as the like chip: the visible text is the number
              // alone, so it is repeated inside the label to keep the visible
              // string contained in the accessible name (WCAG 2.5.3) while
              // speech input still has "comments" to match on.
              aria-label={`View comments, ${formatLikes(comments)} comments`}
              className="tp-chip-shadow inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2.5 text-[13px] font-bold text-[#68767f] outline-offset-2 outline-brand-500 hover:bg-[#eaf3f9] hover:text-brand-700 focus-visible:outline-2"
            >
              <CommentIcon size={15} />
              {formatLikes(comments)}
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

      {/* One permanent live region for both transient notices. A label change
          on the focused element is not reliably announced, and neither is a
          `role="status"` element that only enters the DOM at the moment it has
          something to say — which is why the failure bubble itself is
          `aria-hidden` and speaks through here instead. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : (likeError ?? "")}
      </span>

      {/* Mounted only while open — the same convention `GuideOwnerActions` uses
          for its confirmation and `ItineraryDetailView` for the map sheet:
          `AnimatePresence` lives with the caller that owns the flag, so the
          exit animation has something to play against. The dialog is
          `position: fixed`, so being a child of this flex row costs it no
          layout box while it's up. */}
      <AnimatePresence>
        {commentsOpen && (
          <CommentsModal
            guideSlug={guide.slug}
            isAuthenticated={isAuthenticated}
            // The modal is where a new comment is created, and its own header
            // badge would otherwise be the only number that knew about it —
            // leaving two counts for the same thing disagreeing on screen in
            // the same session. Incremented rather than re-read: the write
            // already succeeded, so this bar knows the answer without a round
            // trip.
            onCommentPosted={() => setComments((n) => n + 1)}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The one bubble shape both notices use, anchored above the like chip.
 *
 * No portal and no positioning library: the chip sits in a plain flex row with
 * no clipping or transformed ancestor, so `absolute` against a `relative`
 * wrapper is the whole requirement. Centring is Motion's `x: "-50%"` rather
 * than a Tailwind translate utility, because Motion writes `transform` inline
 * every frame and the two must not be describing the same axis from different
 * places.
 *
 * `tooltipId` is what makes it a tooltip: passed, it takes `role="tooltip"` and
 * the button points `aria-describedby` at it; omitted, it is decorative and the
 * bar's own live region does the announcing.
 */
function LikeBubble({
  tooltipId,
  tone,
  reduceMotion,
  children,
}: {
  tooltipId?: string;
  tone: "neutral" | "danger";
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const hidden = reduceMotion
    ? { opacity: 0, x: "-50%", y: 0 }
    : { opacity: 0, x: "-50%", y: 4 };

  return (
    <motion.span
      {...(tooltipId
        ? { id: tooltipId, role: "tooltip" }
        : { "aria-hidden": true })}
      initial={hidden}
      animate={{ opacity: 1, x: "-50%", y: 0 }}
      exit={hidden}
      transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: "easeOut" }}
      // `pointer-events-none` so the bubble can never sit between the pointer
      // and the button that raised it — hovering it would otherwise fire
      // `mouseleave` on the chip and flicker the tooltip away.
      className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-max max-w-[210px] rounded-lg px-2.5 py-1.5 text-center text-[12px] font-semibold leading-[1.35] text-white shadow-[0_12px_24px_-14px_rgba(11,36,56,.9)] ${
        tone === "danger" ? "bg-danger" : "bg-navy-deep"
      }`}
    >
      {children}
    </motion.span>
  );
}

/** `null` for a body that isn't JSON at all, so a proxy's HTML error page is a
 *  parse miss rather than a throw inside the success path. */
async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * `{ liked, likeCount }` or nothing. The body is untrusted at the type level
 * (same treatment `DeleteGuideDialog`'s `errorMessageOf` and `CommentsModal`'s
 * `parseComments` give theirs) — a malformed 200 leaves the optimistic state
 * standing rather than writing `undefined` into the count.
 */
function parseLikeResponse(
  body: unknown,
): { liked: boolean; likeCount: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const { liked, likeCount } = body as { liked?: unknown; likeCount?: unknown };
  if (typeof liked !== "boolean") return null;
  if (
    typeof likeCount !== "number" ||
    !Number.isFinite(likeCount) ||
    likeCount < 0
  ) {
    return null;
  }
  return { liked, likeCount };
}
