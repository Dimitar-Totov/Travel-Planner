import type { DestinationImage } from "@/lib/unsplash";

/**
 * Unsplash attribution for a photograph.
 *
 * Their API terms require the photographer and Unsplash to be credited, with
 * both linked back, whenever a photo comes from the API — so this is a licence
 * obligation rather than a design choice. It renders nothing when the fields
 * are null, which is the static-fallback case: no API call was made, so there
 * is nobody to credit.
 *
 * Two placements, because the same obligation lands on two very different
 * surfaces:
 *   - `onPhoto` (the hero on `/plan`) — a frosted pill in the one corner the
 *     headline never reaches, sized down to 11px. The links still clear 4.5:1
 *     against the pill.
 *   - `inline` (the stop detail card's About tab) — the credit sits *under* a
 *     150px-wide image inside a white card, where a frosted pill would have
 *     nothing to frost and nothing to sit over. Plain muted text at the card's
 *     smallest type size instead, so it reads as a caption rather than a
 *     control.
 *
 * Lives outside both `plan/` and `destinations/detail/` because both import it
 * and neither owns it.
 */

type CreditFields = Pick<
  DestinationImage,
  "photographer" | "photographerUrl" | "unsplashUrl"
>;

interface PhotoCreditProps extends CreditFields {
  /** @default "onPhoto" */
  placement?: "onPhoto" | "inline";
}

const WRAPPER: Record<NonNullable<PhotoCreditProps["placement"]>, string> = {
  onPhoto:
    "rounded-full bg-navy-deep/45 px-2.5 py-1 text-[11px] leading-[1.45] font-medium text-white/85 backdrop-blur-[6px]",
  inline: "text-[10.5px] leading-[1.4] font-medium text-[#8b98a1]",
};

const LINK: Record<NonNullable<PhotoCreditProps["placement"]>, string> = {
  onPhoto:
    "underline decoration-white/45 underline-offset-2 outline-offset-2 outline-white hover:text-white hover:decoration-white focus-visible:outline-2",
  inline:
    "underline decoration-[#c9d4db] underline-offset-2 outline-offset-2 outline-brand-500 transition-colors hover:text-brand-700 hover:decoration-brand-500 focus-visible:outline-2",
};

export default function PhotoCredit({
  photographer,
  photographerUrl,
  unsplashUrl,
  placement = "onPhoto",
}: PhotoCreditProps) {
  if (!photographer) return null;

  const linkClass = LINK[placement];

  return (
    <p className={WRAPPER[placement]}>
      Photo by{" "}
      {photographerUrl ? (
        <a
          href={photographerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {photographer}
        </a>
      ) : (
        photographer
      )}{" "}
      on{" "}
      {unsplashUrl ? (
        <a
          href={unsplashUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Unsplash
        </a>
      ) : (
        "Unsplash"
      )}
    </p>
  );
}
