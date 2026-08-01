"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/icons";

/** The four slots of the sentence the traveller is assembling. */
type SlotId = "where" | "days" | "budget" | "style";

interface BuilderOption {
  key: string;
  label: string;
}

interface BuilderGroup {
  id: SlotId;
  /** Rendered as-is — already upper-case in the design. */
  label: string;
  options: readonly BuilderOption[];
}

/** One chosen option key per slot; a missing key means "not chosen yet". */
type Selection = Partial<Record<SlotId, string>>;

const GROUPS: readonly BuilderGroup[] = [
  {
    id: "where",
    label: "WHERE",
    options: [
      { key: "it", label: "Italy" },
      { key: "jp", label: "Japan" },
      { key: "pt", label: "Portugal" },
      { key: "ma", label: "Morocco" },
      { key: "is", label: "Iceland" },
      { key: "vn", label: "Vietnam" },
    ],
  },
  {
    id: "days",
    label: "HOW LONG",
    options: [
      { key: "we", label: "a weekend" },
      { key: "5", label: "5 days" },
      { key: "10", label: "10 days" },
      { key: "14", label: "2 weeks" },
    ],
  },
  {
    id: "budget",
    label: "BUDGET",
    options: [
      { key: "500", label: "€500" },
      { key: "1000", label: "€1,000" },
      { key: "2500", label: "€2,500" },
      { key: "open", label: "flexible" },
    ],
  },
  {
    id: "style",
    label: "WHAT YOU'RE AFTER",
    options: [
      { key: "food", label: "food & wine" },
      { key: "hist", label: "museums & history" },
      { key: "hike", label: "hiking & nature" },
      { key: "beach", label: "beaches" },
      { key: "slow", label: "slow, few stops" },
    ],
  },
] as const;

/** The CTA only unlocks once the sentence has enough in it to plan against. */
const READY_AT = 2;

/** Label of the option chosen for `slot`, or undefined while it's still open. */
function labelFor(selection: Selection, slot: SlotId): string | undefined {
  const group = GROUPS.find((candidate) => candidate.id === slot);
  return group?.options.find((option) => option.key === selection[slot])?.label;
}

/**
 * The sentence we hand to the planner. Same wording as the preview panel, but
 * unfilled slots drop out instead of leaving their placeholder behind —
 * "I have how long in Italy" reads like a bug and parses like one too.
 */
function buildQuery(selection: Selection): string {
  const where = labelFor(selection, "where");
  const days = labelFor(selection, "days");
  const budget = labelFor(selection, "budget");
  const style = labelFor(selection, "style");

  let sentence: string;
  if (days !== undefined && where !== undefined) sentence = `I have ${days} in ${where}`;
  else if (days !== undefined) sentence = `I have ${days} to travel`;
  else if (where !== undefined) sentence = `I have a trip to ${where}`;
  else sentence = "I have a trip";

  if (budget !== undefined) sentence += ` with a ${budget} budget`;
  if (style !== undefined) sentence += `, mostly ${style}`;
  return `${sentence}.`;
}

/** One slot of the live sentence: bold white once filled, dashed hint until then. */
function SentenceSlot({
  value,
  placeholder,
  suffix = "",
}: {
  value: string | undefined;
  placeholder: string;
  suffix?: string;
}) {
  if (value === undefined) {
    return (
      <span className="border-b-[1.5px] border-dashed border-[rgba(166,201,224,.65)] pb-px font-medium text-[#a6c9e0]">
        {placeholder}
        {suffix}
      </span>
    );
  }
  return (
    <span className="font-bold text-white">
      {value}
      {suffix}
    </span>
  );
}

/**
 * The landing page's empty state: a guided way to write the hero prompt for
 * travellers who don't know how to start. Picking chips assembles a real
 * sentence and the CTA sends it through the same /plan?q=… route the hero
 * search box uses.
 */
export default function SentenceBuilder() {
  const router = useRouter();
  const labelIdPrefix = useId();
  const [selection, setSelection] = useState<Selection>({});

  // /plan waits on an AI-picked route before it can render, and this URL is
  // never prefetched, so the CTA owns the feedback until /plan's loading.tsx
  // takes over. See PromptBox for the same treatment on the hero search box.
  const [isPending, startTransition] = useTransition();

  const chosenCount = GROUPS.filter((group) => selection[group.id] !== undefined).length;
  const ready = chosenCount >= READY_AT;

  function planTrip() {
    if (!ready || isPending) return;
    const query = encodeURIComponent(buildQuery(selection));
    startTransition(() => {
      router.push(`/plan?q=${query}`);
    });
  }

  /** Chips are toggles, so tapping the chosen option again clears the slot. */
  function pick(slot: SlotId, key: string) {
    setSelection((current) => {
      const next = { ...current };
      if (next[slot] === key) delete next[slot];
      else next[slot] = key;
      return next;
    });
  }

  function surpriseMe() {
    // Kept inside the handler: rolling dice during render would give the
    // server and the client two different sentences to hydrate.
    const next: Selection = {};
    for (const group of GROUPS) {
      next[group.id] = group.options[Math.floor(Math.random() * group.options.length)].key;
    }
    setSelection(next);
  }

  return (
    <div className="mx-auto grid w-full max-w-[1060px] grid-cols-1 overflow-hidden rounded-[22px] bg-white shadow-[0_34px_80px_rgba(8,40,63,.24)] lg:grid-cols-[1.15fr_0.85fr]">
      {/* Chip picker */}
      <div className="p-6 pb-7 sm:p-[30px] sm:pb-8 lg:border-r lg:border-[#eef2f5]">
        <div className="flex items-center gap-2.5">
          <span className="block h-1.5 w-1.5 rounded-full bg-[#b7c7d2]" />
          <span className="font-mono text-[10.5px] font-medium tracking-[.14em] text-[#8fa4b2]">
            NOTHING PLANNED YET
          </span>
        </div>

        <h2 className="mt-3.5 text-[27px] font-extrabold leading-[1.2] tracking-[-.025em] text-[#14405c] text-pretty">
          Not sure what to type?{" "}
          <span className="font-serif font-normal italic tracking-normal">Build the sentence.</span>
        </h2>
        <p className="mt-2.5 max-w-[420px] text-[14.5px] leading-[1.55] text-[#6f8899] text-pretty">
          Tap a few of these and we&rsquo;ll write the prompt for you. Change anything later —
          nothing is locked in.
        </p>

        <div className="mt-6 flex flex-col gap-[18px]">
          {GROUPS.map((group) => {
            const labelId = `${labelIdPrefix}-${group.id}`;
            return (
              <div key={group.id}>
                <div
                  id={labelId}
                  className="mb-[9px] font-mono text-[10.5px] font-medium tracking-[.13em] text-[#93a7b5]"
                >
                  {group.label}
                </div>
                <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const active = selection[group.id] === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pick(group.id, option.key)}
                        className={`tp-chip cursor-pointer rounded-full border px-3.5 py-[9px] text-[13.5px] font-semibold ${
                          active
                            ? "border-[#1f6f9f] bg-[#1f6f9f] text-white shadow-[0_6px_16px_rgba(31,111,159,.24)]"
                            : "border-[#e0e7ed] bg-[#f7f9fb] text-[#42627a]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live prompt preview */}
      <div className="flex flex-col justify-center border-t border-[#eef2f5] bg-[linear-gradient(165deg,#14486a_0%,#0f3d5b_100%)] px-6 py-7 sm:px-7 sm:py-[30px] sm:pb-8 lg:border-t-0">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10.5px] font-medium tracking-[.14em] text-[#bcd8ec]">
            YOUR PROMPT
          </span>
          <span className="font-mono text-[10.5px] tracking-[.08em] text-[#a9c8de]">
            {chosenCount} OF {GROUPS.length} CHOSEN
          </span>
        </div>

        <div className="mt-2.5 h-[3px] overflow-hidden rounded-[3px] bg-white/12">
          <div
            className="h-full rounded-[3px] bg-[#8fd0f0] transition-[width] duration-[280ms] ease-out motion-reduce:transition-none"
            style={{ width: `${(chosenCount / GROUPS.length) * 100}%` }}
          />
        </div>

        <p
          aria-live="polite"
          className="mt-5 text-[19px] font-medium leading-[1.65] text-white text-pretty"
        >
          <span className="font-normal text-[#d3e7f5]">I have </span>
          <SentenceSlot value={labelFor(selection, "days")} placeholder="how long" />
          <span className="font-normal text-[#d3e7f5]"> in </span>
          <SentenceSlot value={labelFor(selection, "where")} placeholder="where" />
          <span className="font-normal text-[#d3e7f5]"> with a </span>
          <SentenceSlot value={labelFor(selection, "budget")} placeholder="budget" />
          <span className="font-normal text-[#d3e7f5]"> budget, mostly </span>
          <SentenceSlot value={labelFor(selection, "style")} placeholder="your thing" suffix="." />
        </p>

        <div className="mt-[26px] flex flex-col gap-2.5">
          {/* `disabled` still guards the not-ready state; the pending state uses
              aria-disabled so focus isn't ripped away mid-navigation. */}
          <button
            type="button"
            disabled={!ready}
            aria-disabled={isPending}
            aria-busy={isPending}
            onClick={planTrip}
            className={`inline-flex items-center justify-center gap-2.5 rounded-[13px] px-[18px] py-[15px] text-[15px] font-bold ${
              ready
                ? "tp-btn bg-white text-[#0f4767] shadow-[0_12px_28px_rgba(4,26,42,.32)]"
                : "cursor-default bg-white/16 text-[rgba(220,238,250,.55)]"
            } ${ready && isPending ? "cursor-wait opacity-85" : ""} ${
              ready && !isPending ? "cursor-pointer" : ""
            }`}
          >
            {isPending && <SpinnerIcon size={16} />}
            {!ready ? "Pick a couple to continue" : isPending ? "Planning your trip…" : "Plan this trip"}
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={surpriseMe}
              className="tp-chip flex-1 cursor-pointer rounded-xl border border-white/22 bg-white/10 px-3.5 py-[11px] text-[13.5px] font-semibold text-[#e6f2fa] hover:bg-white/20"
            >
              Surprise me
            </button>
            <button
              type="button"
              onClick={() => setSelection({})}
              className="tp-chip flex-none cursor-pointer rounded-xl border border-white/16 px-3.5 py-[11px] text-[13.5px] font-semibold text-[rgba(214,233,246,.75)] hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
