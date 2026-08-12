"use client";

import { useTransition } from "react";
import { signOutAction } from "@/app/(auth)/actions";

export default function SignOutButton({
  className = "",
}: {
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (pending) return;
        startTransition(() => signOutAction());
      }}
      className={`text-[14.5px] font-semibold ${pending ? "cursor-wait opacity-70" : ""} ${className}`}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
