"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/* Two header washes, both fading to nothing on the right so the title sits on
   a band rather than a block. Brand tint means "open", neutral means "closed" —
   the chevron says the same thing, but the wash is readable from across a
   fourteen-day itinerary at a glance. */
const WASH_OPEN = "linear-gradient(90deg,#eaf3f9,rgba(234,243,249,0))";
const WASH_CLOSED = "linear-gradient(90deg,#f2f5f7,rgba(242,245,247,0))";

interface CollapsibleSectionProps {
  /** Base for the generated header/panel ids; must be unique on the page. */
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Rendered between the header and the panel — the day filter action. */
  action?: ReactNode;
  /** Days get the larger of the two heading sizes. */
  size?: "md" | "lg";
  children: ReactNode;
}

/**
 * A disclosure whose panel animates open *and* closed.
 *
 * The mechanics live in `globals.css` under `.tp-collapse`: a grid whose single
 * row transitions between `0fr` and `1fr`. That is what makes closing the exact
 * inverse of opening without measuring anything — the alternative, animating
 * `max-height` to a guessed value, eases wrong on every section that isn't
 * exactly that tall and cannot be re-derived when the content reflows.
 *
 * The header is a real `<button>` inside the heading, so the section shows up in
 * a screen reader's heading list *and* is operable from the keyboard, with
 * `aria-expanded`/`aria-controls` tying it to the panel.
 */
export default function CollapsibleSection({
  id,
  title,
  subtitle,
  open,
  onToggle,
  action,
  size = "md",
  children,
}: CollapsibleSectionProps) {
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;

  return (
    <section>
      <h2 className="m-0">
        <button
          id={headerId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          style={{ background: open ? WASH_OPEN : WASH_CLOSED }}
          className="flex w-full items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 text-left outline-offset-2 outline-brand-500 focus-visible:outline-2 sm:px-4 sm:py-3.5"
        >
          <span className="min-w-0">
            <span
              className={`block font-extrabold text-ink-soft ${
                size === "lg"
                  ? "text-[21px] tracking-[-.026em] sm:text-[24px]"
                  : "text-[19px] tracking-[-.024em] sm:text-[22px]"
              }`}
            >
              {title}
            </span>
            {subtitle && (
              <span className="mt-1 block text-[13px] font-semibold text-[#68767f] sm:text-[13.5px]">
                {subtitle}
              </span>
            )}
          </span>

          <ChevronDownIcon
            size={19}
            className={`tp-chev flex-none text-[#7c8a93] ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>

      {action}

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        data-open={open}
        className="tp-collapse"
      >
        <div className="tp-collapse-inner">{children}</div>
      </div>
    </section>
  );
}
