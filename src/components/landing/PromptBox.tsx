"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon, ArrowRightIcon } from "@/components/icons";
import { CHIPS } from "@/lib/chips";

const EXAMPLE = "I have 5 days in Italy with a €1,000 budget";

const CHIP_GROUP_SIZE = 3;
const CHIP_ROTATE_MS = 5000;

/** Chunks CHIPS into fixed-size groups, dropping any short trailing remainder
 *  so a rotation can never show fewer than `CHIP_GROUP_SIZE` chips. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i + size <= items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

const CHIP_GROUPS = chunk(CHIPS, CHIP_GROUP_SIZE);

/**
 * The hero's prompt — a real, editable search box styled to match the design.
 * Submitting (or picking a chip) routes to /plan?q=… where the mock backend
 * turns the sentence into a Plan.
 */
export default function PromptBox() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [groupIndex, setGroupIndex] = useState(0);

  // Auto-rotate the example chips every 5s, one full group at a time — no
  // manual controls. Paused for prefers-reduced-motion, same as the rest of
  // the landing page's motion.
  useEffect(() => {
    if (CHIP_GROUPS.length <= 1) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let id: ReturnType<typeof setInterval> | null = null;

    const sync = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
      if (!motion.matches) {
        id = setInterval(() => {
          setGroupIndex((i) => (i + 1) % CHIP_GROUPS.length);
        }, CHIP_ROTATE_MS);
      }
    };

    sync();
    motion.addEventListener("change", sync);
    return () => {
      if (id !== null) clearInterval(id);
      motion.removeEventListener("change", sync);
    };
  }, []);

  const chips = CHIP_GROUPS[groupIndex] ?? [];

  function planFor(query: string) {
    const q = query.trim() || EXAMPLE;
    router.push(`/plan?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="tp-rise" style={{ animationDelay: "0.25s" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          planFor(value);
        }}
        className="mt-[34px] flex flex-col gap-3 rounded-[20px] bg-white p-[11px] text-left shadow-[0_34px_80px_-34px_rgba(6,28,45,.85),0_0_0_1px_rgba(255,255,255,.5)] sm:flex-row sm:items-center sm:gap-4 sm:p-[11px] sm:pl-5"
      >
        {/* Icon + field stay a row at every width; only the button drops below
            it on phones, where a fixed-width button would starve the input. */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
          <span className="inline-flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-[linear-gradient(150deg,#eaf4fb,#d6e9f5)] text-[#1c6392]">
            <SparkleIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="plan-prompt"
              className="block text-[10.5px] font-bold uppercase tracking-[.12em] text-[#8aa1af]"
            >
              Describe your trip
            </label>
            <input
              id="plan-prompt"
              name="q"
              type="text"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={EXAMPLE}
              aria-label="Describe your trip in one sentence"
              className="mt-[3px] w-full border-0 bg-transparent p-0 text-[18.5px] font-semibold tracking-[-.01em] text-[#18242e] outline-none placeholder:text-[#9fb1bd]"
            />
          </div>
        </div>
        <button
          type="submit"
          className="tp-btn inline-flex w-full flex-none items-center justify-center gap-2.5 rounded-[14px] bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-6 py-[15px] text-[15px] font-bold text-white shadow-[0_16px_30px_-14px_rgba(15,58,88,.9)] sm:w-auto"
        >
          Plan my trip
          <ArrowRightIcon size={17} />
        </button>
      </form>

      <div
        key={groupIndex}
        className="mt-[18px] flex flex-wrap justify-center gap-2.5"
        style={{ animation: "pb-fade .5s ease-out both" }}
      >
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => planFor(chip)}
            className="tp-chip cursor-pointer rounded-full border border-white/25 bg-white/10 px-[15px] py-2 text-[13px] font-medium text-[#e4f0f7] hover:bg-white/20"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
