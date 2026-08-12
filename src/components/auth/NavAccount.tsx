import Link from "next/link";
import { auth } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

/**
 * The session-dependent slice of SiteNav. Kept as its own async component so
 * SiteNav can wrap just this in <Suspense> — the rest of the bar (and the
 * whole /plan loading skeleton, which renders SiteNav too) stays instant
 * instead of waiting on the session cookie.
 */
export default async function NavAccount({ onDark }: { onDark: boolean }) {
  const session = await auth();
  const user = session?.user;

  const textClass = onDark ? "text-[#eaf3f9]" : "text-ink";

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className={`group relative hidden text-[16.5px] font-bold sm:inline-block ${textClass}`}
      >
        Sign in
        <span className="absolute left-1/2 -bottom-1 h-px w-full origin-center -translate-x-1/2 scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
      </Link>
    );
  }

  // The Credentials provider returns `username`, not `name` — `session.user.name`
  // is always undefined here.
  const label = user.username || user.email || "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="hidden items-center gap-3 sm:flex">
      <span
        aria-hidden
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
          onDark ? "bg-white/15 text-white" : "bg-[#eaf4fb] text-brand-600"
        }`}
      >
        {initial}
      </span>
      <span
        className={`max-w-[140px] truncate text-[14.5px] font-semibold ${textClass}`}
      >
        {label}
      </span>
      <SignOutButton
        className={
          onDark
            ? "text-[#a9c4d4] hover:text-white"
            : "text-muted hover:text-ink"
        }
      />
    </div>
  );
}

/** Same footprint as the signed-out link, so the nav doesn't shift when the
 *  session resolves. */
export function NavAccountFallback({ onDark }: { onDark: boolean }) {
  return (
    <span
      aria-hidden
      className={`hidden h-5 w-[52px] rounded-full sm:inline-block ${
        onDark ? "bg-white/10" : "bg-[#eef1f4]"
      }`}
    />
  );
}
