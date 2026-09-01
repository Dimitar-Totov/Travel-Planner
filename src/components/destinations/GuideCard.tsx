import Image from "next/image";
import Link from "next/link";
import type { DestinationGuide } from "@/lib/destinationGuides";
import { formatLikes, formatViews } from "@/lib/destinationGuides";
import { CheckIcon, HeartIcon, EyeIcon } from "@/components/icons";

/** Fades the top of the thumbnail so the meta pill and any light gradient
 *  still read against each other. */
const THUMB_SCRIM =
  "linear-gradient(180deg,rgba(15,47,71,.28) 0%,rgba(15,47,71,0) 42%)";

/**
 * One guide in the /guides feed. Pure presentation — the cover photo is
 * a real Unsplash image; the author avatar is still a CSS gradient (same
 * placeholder approach as `HotelsCard`'s `Hotel.gradient`).
 */
export default function GuideCard({ guide }: { guide: DestinationGuide }) {
  return (
    <Link
      href={`/guides/guide/${guide.slug}/details`}
      className="group block cursor-pointer overflow-hidden rounded-2xl bg-white shadow-[0_18px_38px_-32px_rgba(20,52,78,.45)]"
    >
      {/* `place` doubles as the cover photo's alt text. The image lives in
          its own layer so it can zoom on hover without dragging the
          scrim/meta pill along with it. */}
      <div className="relative h-[186px] overflow-hidden bg-[#e8eff4]">
        <Image
          src={guide.coverImage}
          alt={guide.place}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.08]"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: THUMB_SCRIM }}
        />
        <span className="pointer-events-none absolute bottom-[11px] left-[11px] rounded-full bg-[rgba(15,47,71,.55)] px-[11px] py-[5px] text-[11px] font-bold tracking-[.03em] text-white backdrop-blur-[6px]">
          {guide.meta}
        </span>
      </div>

      <div className="px-[15px] pb-[15px] pt-3.5">
        <div className="flex items-center gap-[7px]">
          <h3 className="line-clamp-2 min-w-0 text-[15.5px] font-bold leading-[1.25] tracking-[-.012em] text-ink">
            {guide.title}
          </h3>
          {guide.verified && (
            <span
              className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#c9822f] text-white"
              title="Verified guide"
            >
              <CheckIcon size={10} strokeWidth={3.4} />
              <span className="sr-only">Verified guide</span>
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-[13.5px] leading-[1.5] text-muted">
          {guide.blurb}
        </p>

        <div className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-[#f1f4f6] pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-6 w-6 flex-none rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.35)]"
              style={{ background: guide.avatarGradient }}
            />
            <span className="truncate text-[12.5px] font-semibold text-[#46555f]">
              {guide.author}
            </span>
          </div>

          <div className="flex flex-none items-center gap-3 text-[12px] font-semibold text-[#8b98a1]">
            <span
              className="inline-flex items-center gap-1"
              title={`${formatLikes(guide.likes)} likes`}
            >
              <HeartIcon size={13} />
              {formatLikes(guide.likes)}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`${guide.views.toLocaleString()} views`}
            >
              <EyeIcon size={13} />
              {formatViews(guide.views)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
