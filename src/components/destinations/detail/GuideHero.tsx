import type { ReactNode } from "react";
import Image from "next/image";
import { CheckIcon } from "@/components/icons";

/**
 * Dark at the very top so the nav's shadow doesn't die on a bright sky, clear
 * through the middle where the photograph is the point, then heavy across the
 * bottom third where the headline and the pill row sit.
 */
const HERO_SCRIM =
  "linear-gradient(180deg," +
  "rgba(11,36,56,.34) 0%," +
  "rgba(11,36,56,0) 34%," +
  "rgba(11,36,56,.82) 100%)";

/**
 * How the cover photo fills the banner.
 *
 * `"cover"` is the published look and the default: curated guide covers and
 * Unsplash plan photos are landscape, so cropping them to the banner is what
 * the design asks for. `"contain"` exists for the create-guide preview, where
 * the photo is an author's own upload of any aspect ratio and cropping it hides
 * the very thing they are checking.
 */
export type HeroImageFit = "cover" | "contain";

interface GuideHeroProps {
  /** Headline, split so the tail renders in the serif italic accent. */
  title: string;
  accent: string;
  tags: string[];
  /**
   * Already resolved on the server — a guide's cover, or a plan's Unsplash
   * photo. `undefined` for a draft with no cover chosen yet, in which case
   * the hero falls back to its plain background rather than a stand-in photo.
   */
  image?: string;
  imageAlt?: string;
  imageFit?: HeroImageFit;
  /** Community guides can be editorially verified; a generated plan can't. */
  verified?: boolean;
  /** Photographer attribution, when the photo source requires one. */
  credit?: ReactNode;
}

/**
 * The cover photo, the headline and the tag row.
 *
 * Takes primitives rather than a whole guide because `/plan` renders the same
 * hero over an AI-generated `TripPlan`, which has no author, no slug and no
 * verification — only a title, some tags and a photograph.
 *
 * This is the only real photograph on the page — stops fall back to a designed
 * placeholder because there is no upload path yet. It is also the LCP element
 * on every viewport, hence `priority`.
 */
export default function GuideHero({
  title,
  accent,
  tags,
  image,
  imageAlt,
  imageFit = "cover",
  verified = false,
  credit,
}: GuideHeroProps) {
  const contained = imageFit === "contain";

  return (
    // The letterbox a contained photo leaves is deep navy rather than the pale
    // default: the scrim is built to darken a photograph, and over the pale
    // background the headline and tag row would sit on mid-grey instead.
    <div
      className={`relative h-[240px] overflow-hidden sm:h-[300px] lg:h-[330px] ${
        contained ? "bg-navy-deep" : "bg-[#dde6ec]"
      }`}
    >
      {/* `sizes` tracks the reading column: full width below `lg`, roughly half
          the viewport once the map takes the other half. */}
      {image && (
        <Image
          src={image}
          alt={imageAlt ?? ""}
          fill
          priority
          sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 54vw, 100vw"
          className={contained ? "object-contain" : "object-cover"}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: HERO_SCRIM }}
      />

      {/* Top-right is the one corner the headline block never reaches, however
          far the tag row wraps. */}
      {credit && (
        <div className="absolute right-4 top-4 max-w-[60%] sm:right-5 sm:top-5">
          {credit}
        </div>
      )}

      <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-[26px]">
        <h1 className="tp-rise text-[28px] font-extrabold leading-[1.06] tracking-[-.03em] text-white text-balance [text-shadow:0_2px_18px_rgba(7,26,42,.5)] sm:text-[34px] lg:text-[40px]">
          {title}{" "}
          <span className="font-serif font-medium italic">{accent}</span>
        </h1>

        <div className="tp-rise mt-3.5 flex flex-wrap gap-2">
          {verified && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-warm px-3 py-[5px] text-[12px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,.7)]">
              <CheckIcon size={12} strokeWidth={3.4} />
              Verified guide
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/30 bg-white/20 px-3 py-[5px] text-[12px] font-semibold text-[#eaf3f9] backdrop-blur-[6px]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
