"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

type FieldChrome = {
  /** Also the stem for the generated hint/error ids. */
  id: string;
  label: string;
  /** Right-aligned slot on the label row — the design's "Forgot?" affordance. */
  labelAside?: ReactNode;
  /** Requirements worth stating before the user gets them wrong. */
  hint?: string;
  error?: string;
};

type InputRest = Omit<ComponentPropsWithoutRef<"input">, "id" | "className">;

/** Tailwind can't see through a template literal, so both branches spell out
 *  every class they need. */
function inputClass(hasError: boolean, extra = ""): string {
  const base =
    "h-11 w-full rounded-[10px] border bg-surface-3 px-3.5 text-[14.5px] text-ink outline-none placeholder:text-[#9fb1bd] focus:bg-white focus:ring-[3px]";
  const state = hasError
    ? "border-danger focus:border-danger focus:ring-danger/25"
    : "border-line focus:border-brand-500 focus:ring-brand-400/25";
  return `${base} ${state} ${extra}`;
}

function describedBy(
  id: string,
  hint: boolean,
  error: boolean,
): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(
    (value): value is string => value !== null,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldFrame({
  id,
  label,
  labelAside,
  hint,
  error,
  children,
}: FieldChrome & { children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {label}
        </label>
        {labelAside}
      </div>

      <div className="relative mt-1.5">{children}</div>

      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-[12.5px] font-medium text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default function Field({
  id,
  label,
  labelAside,
  hint,
  error,
  ...input
}: FieldChrome & InputRest) {
  return (
    <FieldFrame
      id={id}
      label={label}
      labelAside={labelAside}
      hint={hint}
      error={error}
    >
      <input
        {...input}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(hint), Boolean(error))}
        className={inputClass(Boolean(error))}
      />
    </FieldFrame>
  );
}

/** Password input with the design's inset SHOW/HIDE toggle. */
export function PasswordField({
  id,
  label,
  labelAside,
  hint,
  error,
  ...input
}: FieldChrome & Omit<InputRest, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldFrame
      id={id}
      label={label}
      labelAside={labelAside}
      hint={hint}
      error={error}
    >
      <input
        {...input}
        id={id}
        type={visible ? "text" : "password"}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(hint), Boolean(error))}
        className={inputClass(Boolean(error), "pr-[68px]")}
      />
      {/* The accessible name keeps the visible word in it (WCAG 2.5.3) while
          spelling out what's being shown. */}
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-[10px] px-3.5 font-mono text-[10px] uppercase tracking-[.16em] text-muted-2 hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </FieldFrame>
  );
}
