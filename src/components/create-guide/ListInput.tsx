"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/icons";

/**
 * `"chip"` for short labels that read as a row of pills (guide tags, stop
 * tags); `"line"` for whole sentences that need their own row (general tips,
 * stop notes).
 */
export type ListInputVariant = "chip" | "line";

interface ListInputProps {
  /** Stem for the input's id and its hint id; must be unique on the page. */
  id: string;
  label: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder?: string;
  hint?: string;
  variant?: ListInputVariant;
  /** Copy for the row shown when nothing has been added yet. */
  emptyLabel?: string;
}

/**
 * The one add/remove list editor on `/create-guide`.
 *
 * Four things on the page are the same interaction — guide tags, general tips,
 * a stop's tags, a stop's notes — differing only in whether an entry is a word
 * or a sentence, so they share one implementation with a display variant rather
 * than four near-copies.
 *
 * Entries are plain strings and the reading side keys them by value
 * (`StopRow`'s tags, `ItineraryDetailView`'s tips), so duplicates are rejected
 * upstream in `useCreateGuideForm`; this component just clears the box on a
 * successful-looking add.
 */
export default function ListInput({
  id,
  label,
  values,
  onAdd,
  onRemove,
  placeholder,
  hint,
  variant = "chip",
  emptyLabel = "Nothing added yet.",
}: ListInputProps) {
  const [draft, setDraft] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") return;
    // Duplicates are rejected here rather than silently swallowed upstream:
    // every consumer of these strings keys its list by the value itself
    // (`StopRow`'s tags and notes, `ItineraryDetailView`'s tips), so two
    // identical entries are a React key collision. Keeping the text in the box
    // means the author can edit it into something new instead of wondering
    // where their typing went.
    if (values.includes(trimmed)) {
      setDuplicate(true);
      return;
    }
    onAdd(trimmed);
    setDraft("");
    setDuplicate(false);
    inputRef.current?.focus();
  }

  // There is no `<form>` around any of this — nothing on the page submits — so
  // Enter has to be wired up by hand to mean "add this one".
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="text-[13px] font-semibold text-ink lg:text-[14px]"
      >
        {label}
      </label>

      <div className="mt-1.5 flex gap-2 lg:gap-2.5">
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDuplicate(false);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={duplicate || undefined}
          aria-describedby={
            [hint ? `${id}-hint` : null, duplicate ? `${id}-error` : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={`h-11 w-full min-w-0 rounded-[10px] border bg-surface-3 px-3.5 text-[14.5px] text-ink outline-none placeholder:text-[#9fb1bd] focus:bg-white focus:ring-[3px] lg:h-12 lg:px-4 lg:text-[15.5px] ${
            duplicate
              ? "border-danger focus:border-danger focus:ring-danger/25"
              : "border-line focus:border-brand-500 focus:ring-brand-400/25"
          }`}
        />
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim() === ""}
          className="tp-btn-shadow inline-flex h-11 flex-none items-center gap-1.5 rounded-[10px] border border-[#d5e2ea] bg-white px-3.5 text-[13.5px] font-bold text-brand-700 outline-offset-2 outline-brand-500 hover:border-brand-700 hover:bg-brand-700 hover:text-white focus-visible:outline-2 disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-[#a3b0b8] disabled:hover:bg-surface-2 lg:h-12 lg:px-4 lg:text-[14.5px]"
        >
          <PlusIcon size={15} />
          <span className="sr-only sm:not-sr-only">Add</span>
        </button>
      </div>

      {hint && (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-[12px] text-muted lg:text-[13px]"
        >
          {hint}
        </p>
      )}
      {duplicate && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-[12.5px] font-medium text-danger lg:text-[13.5px]"
        >
          &ldquo;{draft.trim()}&rdquo; is already in the list.
        </p>
      )}

      {values.length === 0 ? (
        <p className="mt-2.5 text-[12.5px] italic text-muted-2 lg:text-[13.5px]">
          {emptyLabel}
        </p>
      ) : variant === "chip" ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5 lg:mt-3 lg:gap-2">
          {values.map((value) => (
            <li key={value}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 py-1 pl-3 pr-1 text-[12.5px] font-semibold text-brand-700 lg:py-1.5 lg:pl-3.5 lg:text-[13.5px]">
                {value}
                <button
                  type="button"
                  onClick={() => onRemove(value)}
                  aria-label={`Remove ${value}`}
                  className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-brand-700/70 outline-offset-2 outline-brand-500 transition-colors hover:bg-brand-500/20 hover:text-brand-700 focus-visible:outline-2 lg:h-[24px] lg:w-[24px]"
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5 lg:mt-3 lg:gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="flex items-start gap-2 rounded-[10px] bg-surface-2 py-2 pl-3 pr-2 text-[13.5px] leading-[1.5] text-muted lg:gap-2.5 lg:py-2.5 lg:pl-3.5 lg:text-[14.5px]"
            >
              <span className="min-w-0 flex-1">{value}</span>
              <button
                type="button"
                onClick={() => onRemove(value)}
                aria-label={`Remove ${value}`}
                className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-muted-2 outline-offset-2 outline-brand-500 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-2 lg:h-[28px] lg:w-[28px]"
              >
                <TrashIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
