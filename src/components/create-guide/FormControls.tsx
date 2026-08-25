"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The two controls `components/auth/Field.tsx` doesn't cover.
 *
 * `Field` is the input primitive everywhere else on `/create-guide` and it
 * renders an `<input>` only — but a guide's intro, a day's summary and a stop's
 * "about" are paragraphs, and a transfer mode is one of nine fixed values. Both
 * of those need a different element, so they live here rather than being faked
 * with a single-line box or a row of nine chips.
 *
 * The chrome is deliberately a copy of `Field`'s, minus the height (a textarea
 * sizes itself): label above, control, optional hint below, same radius, same
 * focus ring. If `Field`'s `inputClass` is ever restyled, restyle this with it.
 */

const CONTROL_BASE =
  "w-full rounded-[10px] border border-line bg-surface-3 px-3.5 text-[14.5px] text-ink outline-none placeholder:text-[#9fb1bd] focus:border-brand-500 focus:bg-white focus:ring-[3px] focus:ring-brand-400/25";

function Frame({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  rows = 4,
  ...textarea
}: {
  id: string;
  label: string;
  hint?: string;
} & Omit<ComponentPropsWithoutRef<"textarea">, "id" | "className">) {
  return (
    <Frame id={id} label={label} hint={hint}>
      <textarea
        {...textarea}
        id={id}
        rows={rows}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${CONTROL_BASE} resize-y py-2.5 leading-[1.55]`}
      />
    </Frame>
  );
}

export function SelectField({
  id,
  label,
  hint,
  children,
  ...select
}: {
  id: string;
  label: string;
  hint?: string;
} & Omit<ComponentPropsWithoutRef<"select">, "id" | "className">) {
  return (
    <Frame id={id} label={label} hint={hint}>
      <select
        {...select}
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${CONTROL_BASE} h-11`}
      >
        {children}
      </select>
    </Frame>
  );
}
