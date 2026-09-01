import { Suspense } from "react";
import Link from "next/link";
import { PlaneIcon } from "@/components/icons";
import NavAccount, { NavAccountFallback } from "@/components/auth/NavAccount";

/** Root-relative so the marketing links still resolve from /plan and the auth
 *  pages, where those sections don't exist. On `/` a Link to "/#how" is a
 *  same-route hash scroll, not a reload. */
const LINKS = [
  { label: "Product", href: "/#how" },
  { label: "Guides", href: "/guides" },
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/#cta" },
  { label: "Create Guide", href: "/create-guide" },
];

/**
 * The one top navigation, on every page. `onDark` sits on a teal backdrop (the
 * landing hero, the auth pages); `onLight` is the white bar used above the
 * /plan results.
 */
export default function SiteNav({
  variant = "onDark",
}: {
  variant?: "onDark" | "onLight";
}) {
  const onDark = variant === "onDark";

  const logoGradient = onDark
    ? "linear-gradient(150deg,#5ea8d3,#1c6392)"
    : "linear-gradient(150deg,#2f7fb0,#134a6f)";
  const linkClass = onDark
    ? "text-[#cfe2ee] hover:text-white"
    : "text-[#46555f] hover:text-ink";
  const wordmark = onDark ? "text-white" : "text-ink";

  return (
    <nav
      className={`relative flex items-center justify-between px-6 py-[22px] sm:px-10 ${
        onDark ? "" : "border-b border-[#eef1f4] bg-white/90 backdrop-blur-md"
      }`}
    >
      <Link href="/" className="flex items-center gap-[11px]">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_18px_-10px_rgba(0,0,0,.6)]"
          style={{ background: logoGradient }}
        >
          <PlaneIcon size={18} />
        </span>
        <span
          className={`text-[18px] font-extrabold tracking-[-.02em] ${wordmark}`}
        >
          Travel Planner
        </span>
      </Link>

      <div className="hidden items-center gap-[30px] text-[14.5px] font-medium md:flex">
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} className={linkClass}>
            {l.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-[18px]">
        {/* Only the account slot reads the session, so the rest of the bar
            renders without waiting on it. */}
        <Suspense fallback={<NavAccountFallback onDark={onDark} />}>
          <NavAccount onDark={onDark} />
        </Suspense>
      </div>
    </nav>
  );
}
