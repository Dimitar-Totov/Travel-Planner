"use client";

import { useFormStatus } from "react-dom";
import { PlaneIcon, SpinnerIcon } from "@/components/icons";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  /** Overrides `useFormStatus`. Needed by SignUpForm, whose submit runs through
   *  `onSubmit` + fetch rather than a form action — `useFormStatus` only tracks
   *  the latter and would sit at `false` for the whole request. */
  pending?: boolean;
};

export default function SubmitButton({
  label,
  pendingLabel,
  pending,
}: SubmitButtonProps) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;

  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className={`tp-btn inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-[10px] bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] text-[15px] font-bold text-white shadow-[0_16px_30px_-14px_rgba(15,58,88,.9)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        busy ? "cursor-wait opacity-80" : ""
      }`}
    >
      {busy ? pendingLabel : label}
      {busy ? <SpinnerIcon size={17} /> : <PlaneIcon size={17} />}
    </button>
  );
}
