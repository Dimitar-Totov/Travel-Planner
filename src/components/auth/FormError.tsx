import type { ReactNode } from "react";

/**
 * Form-level failure banner — the "that email and password don't match" class
 * of error, as opposed to the per-field messages `Field` renders.
 *
 * It renders nothing when there's no message, so `role="alert"` lands on a
 * freshly inserted node and is actually announced.
 */
export default function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="rounded-[10px] border border-danger/30 bg-danger/6 px-3.5 py-2.5 text-[13px] font-medium text-danger"
    >
      {children}
    </p>
  );
}
