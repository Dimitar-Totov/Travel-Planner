import Link from "next/link";
import { SparkleIcon } from "@/components/icons";

/**
 * The `/plan` answer to `GuideAuthorBar`.
 *
 * A community guide is credited to a person; a plan is credited to the sentence
 * the traveller typed, so that sentence is the byline — echoed verbatim in the
 * mono treatment the old results header used, because seeing your own words
 * quoted back is what tells you the plan actually read them.
 *
 * The right-hand action mirrors the author bar's Follow button's position but
 * not its weight: this one is real navigation, not a stubbed social toggle.
 */
export default function PlanByline({ query }: { query: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-[11px]">
        <span
          className="inline-flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)]"
          style={{ background: "linear-gradient(150deg,#2f7fb0,#134a6f)" }}
        >
          <SparkleIcon size={19} />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-[-.01em] text-ink">
            Generated from your prompt
          </div>
          <p className="mt-0.5 line-clamp-2 font-mono text-[13px] leading-[1.45] break-words text-[#68767f]">
            &ldquo;{query}&rdquo;
          </p>
        </div>
      </div>

      <Link
        href="/"
        className="tp-btn inline-flex flex-none items-center rounded-full border border-[#d5e2ea] bg-white px-5 py-2.5 text-[14px] font-bold text-brand-700 outline-brand-500 outline-offset-2 hover:border-brand-700 focus-visible:outline-2"
      >
        Plan another trip
      </Link>
    </div>
  );
}
