"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { CheckCircleIcon, CloseIcon, SpinnerIcon } from "@/components/icons";
import type {
  PublishFailureKind,
  PublishGuideState,
} from "@/lib/hooks/usePublishGuide";

/**
 * Everything the Publish button has to say back: progress while it runs, the
 * failure panel, and the (heavily qualified) success panel.
 *
 * Rendered inside `CreateGuidePageShell`'s sticky header block rather than at
 * the top of the page, because the button that produces it is in that sticky
 * bar and can be pressed from any scroll position — a panel left in document
 * flow would appear off-screen. Focus moves to it once it settles, the standard
 * error-summary pattern, so a keyboard or screen-reader user lands on the
 * explanation instead of hunting for it.
 */

const FAILURE_TITLES: Record<PublishFailureKind, string> = {
  validation: "This guide isn't ready to publish",
  auth: "You need to be signed in",
  conflict: "That headline is already taken",
  network: "We couldn't reach the server",
  server: "Publishing failed",
};

/**
 * Guide-level dotted paths, labelled with the words the form itself uses so an
 * author can find the control the message is about. `title` maps to the
 * headline because that is what it is derived from (see `buildGuideBody`).
 */
const FIELD_LABELS: Record<string, string> = {
  title: "Headline",
  heroTitle: "Headline",
  heroAccent: "Headline accent",
  blurb: "Blurb",
  intro: "Intro",
  tags: "Tags",
  generalTips: "General tips",
  currency: "Currency symbol",
  bestTime: "Best time",
  coverImageUrl: "Cover photo",
  days: "Days",
  status: "Status",
};

/**
 * Turns an API path into something an author can act on:
 * `"days.2.stops.5.lat"` becomes `"Day 3, stop 6"`.
 *
 * Deliberately stops at the day/stop, without naming the leaf field — every
 * message already names it ("Latitude must be between -90 and 90.", "Every stop
 * needs a name before publishing."), so appending it would only read as a
 * stutter. An unrecognised path falls back to itself rather than being hidden.
 */
function describeFieldPath(path: string): string {
  const parts = path.split(".");

  if (parts[0] === "days" && parts.length > 1) {
    const dayIndex = Number(parts[1]);
    if (Number.isInteger(dayIndex)) {
      const stopIndex = parts[2] === "stops" ? Number(parts[3]) : NaN;
      return Number.isInteger(stopIndex)
        ? `Day ${dayIndex + 1}, stop ${stopIndex + 1}`
        : `Day ${dayIndex + 1}`;
    }
  }

  return FIELD_LABELS[path] ?? path;
}

interface PublishStatusProps extends Pick<
  PublishGuideState,
  "phase" | "uploaded" | "photoTotal" | "failure" | "published"
> {
  onDismiss: () => void;
}

export default function PublishStatus({
  phase,
  uploaded,
  photoTotal,
  failure,
  published,
  onDismiss,
}: PublishStatusProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const settled = failure ?? published;

  useEffect(() => {
    if (settled) panelRef.current?.focus();
  }, [settled]);

  if (phase === "uploading" || phase === "saving") {
    return (
      <p
        role="status"
        className="flex items-center gap-2 border-t border-line bg-surface-2 px-5 py-2.5 text-[13px] font-bold text-brand-700 sm:px-8 lg:px-12 lg:text-[15px]"
      >
        <SpinnerIcon size={15} />
        {phase === "uploading"
          ? `Uploading photos… ${uploaded}/${photoTotal}`
          : "Saving your guide…"}
      </p>
    );
  }

  if (failure) {
    return (
      <Panel
        ref={panelRef}
        role="alert"
        tone="danger"
        onDismiss={onDismiss}
        dismissLabel="Dismiss publishing error"
      >
        <p className="text-[13.5px] font-bold text-danger lg:text-[15.5px]">
          {FAILURE_TITLES[failure.kind]}
        </p>
        <p className="mt-1 text-[13px] leading-[1.55] text-ink-soft lg:text-[15px]">
          {failure.message}
        </p>
        {failure.kind === "auth" && <SignInLink />}
        <FieldErrorList fields={failure.fields} />
      </Panel>
    );
  }

  if (published) {
    return (
      <Panel
        ref={panelRef}
        role="status"
        tone="gold"
        onDismiss={onDismiss}
        dismissLabel="Dismiss publishing notice"
      >
        {/* With a slug, `usePublishGuide` is already navigating to the guide
            and this panel is a brief hand-off — the link is there in case the
            navigation is slow or gets interrupted. Without one, the 201 body
            didn't parse: the guide is genuinely saved, but there is no URL to
            offer, so this says so instead of guessing at one. */}
        <p className="flex items-center gap-2 text-[13.5px] font-bold text-gold-deep lg:text-[15.5px]">
          <CheckCircleIcon size={16} />
          {published.slug
            ? "Published — opening your guide"
            : "Published, but we couldn’t read back its address"}
        </p>
        {published.slug ? (
          <p className="mt-1 text-[13px] leading-[1.55] text-gold-deep lg:text-[15px]">
            Your guide is live at{" "}
            <Link
              href={`/destinations/guide/${published.slug}/details`}
              className="font-mono font-bold underline underline-offset-2"
            >
              {published.slug}
            </Link>
            . If this page doesn&rsquo;t move on its own, that link will take
            you there.
          </p>
        ) : (
          <p className="mt-1 text-[13px] leading-[1.55] text-gold-deep lg:text-[15px]">
            The guide was saved, but the server&rsquo;s reply didn&rsquo;t
            include its address, so we can&rsquo;t link you to it. Look for it
            on the{" "}
            <Link
              href="/destinations"
              className="font-bold underline underline-offset-2"
            >
              Destinations
            </Link>{" "}
            feed — and don&rsquo;t publish again, or you&rsquo;ll create a
            second copy. Your draft is still here.
          </p>
        )}
      </Panel>
    );
  }

  return null;
}

function SignInLink() {
  return (
    <p className="mt-2 text-[13px] lg:text-[15px]">
      {/* A new tab, not a navigation: the draft is in-memory only, so leaving
          this page is how an author loses everything they've written. */}
      <Link
        href="/sign-in"
        target="_blank"
        rel="noopener"
        className="font-bold text-brand-700 underline underline-offset-2 outline-offset-2 outline-brand-500 hover:text-brand-600 focus-visible:outline-2"
      >
        Sign in
        <span className="sr-only"> (opens in a new tab)</span>
      </Link>
    </p>
  );
}

function FieldErrorList({ fields }: { fields?: Record<string, string> }) {
  if (!fields) return null;

  return (
    <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] leading-[1.5] text-ink-soft lg:text-[15px]">
      {Object.entries(fields).map(([path, message]) => (
        <li key={path} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-[7px] inline-block h-[5px] w-[5px] flex-none rounded-full bg-danger"
          />
          <span>
            <span className="font-bold">{describeFieldPath(path)}</span> —{" "}
            {message}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface PanelProps {
  /** React 19 passes `ref` as a plain prop — no `forwardRef` needed. */
  ref: Ref<HTMLDivElement>;
  role: "alert" | "status";
  tone: "danger" | "gold";
  onDismiss: () => void;
  dismissLabel: string;
  children: ReactNode;
}

/** Shared chrome for the two settled states. Capped in height and scrollable
 *  because it sits in the sticky bar and a long field list must not swallow the
 *  viewport. */
function Panel({
  ref,
  role,
  tone,
  onDismiss,
  dismissLabel,
  children,
}: PanelProps) {
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={-1}
      className={`max-h-[45vh] overflow-y-auto border-t px-5 py-3.5 outline-offset-[-2px] outline-brand-500 focus-visible:outline-2 sm:px-8 lg:px-12 lg:py-5 ${
        tone === "danger"
          ? "border-danger/25 bg-danger/6"
          : "border-gold-warm/25 bg-gold-warm/[.08]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">{children}</div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="tp-btn inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-[#68767f] outline-offset-2 outline-brand-500 hover:bg-white/70 hover:text-ink focus-visible:outline-2"
        >
          <CloseIcon size={15} />
        </button>
      </div>
    </div>
  );
}
