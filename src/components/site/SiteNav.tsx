import Link from "next/link";
import { PlaneIcon } from "@/components/icons";

const LINKS = [
  { label: "Product", href: "#how" },
  { label: "Destinations", href: "#how" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#cta" },
];

/**
 * Top navigation. `onDark` sits on the teal hero (landing); `onLight` is the
 * white bar used above the /plan results.
 */
export default function SiteNav({
  variant = "onDark",
  ctaHref = "#plan-prompt",
}: {
  variant?: "onDark" | "onLight";
  ctaHref?: string;
}) {
  const onDark = variant === "onDark";

  const logoGradient = onDark
    ? "linear-gradient(150deg,#5ea8d3,#1c6392)"
    : "linear-gradient(150deg,#2f7fb0,#134a6f)";
  const linkClass = onDark ? "text-[#cfe2ee] hover:text-white" : "text-[#46555f] hover:text-ink";
  const wordmark = onDark ? "text-white" : "text-ink";
  const signIn = onDark ? "text-[#eaf3f9]" : "text-ink";

  const cta = onDark
    ? "bg-white text-[#123f5e] shadow-[0_12px_26px_-14px_rgba(0,0,0,.7)]"
    : "bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] text-white shadow-[0_12px_26px_-14px_rgba(19,74,111,.9)]";

  const CtaEl = ctaHref.startsWith("/") ? Link : "a";

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
        <span className={`text-[18px] font-extrabold tracking-[-.02em] ${wordmark}`}>Travel Planner</span>
      </Link>

      <div className="hidden items-center gap-[30px] text-[14.5px] font-medium md:flex">
        {LINKS.map((l) => (
          <a key={l.label} href={l.href} className={linkClass}>
            {l.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-[18px]">
        <a href={onDark ? "#" : "/"} className={`hidden text-[14.5px] font-semibold sm:inline ${signIn}`}>
          Sign in
        </a>
        <CtaEl
          href={ctaHref}
          className={`tp-btn rounded-full px-5 py-[11px] text-[14px] font-bold ${cta}`}
        >
          Start planning
        </CtaEl>
      </div>
    </nav>
  );
}
