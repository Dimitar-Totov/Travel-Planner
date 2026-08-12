import { SparkleIcon } from "@/components/icons";
import DestinationsExplorer from "./DestinationsExplorer";

/** Radial glow off the top edge plus faint 52px vertical rules. The rules are
 *  repeated on the explorer's search band so the pattern crosses the seam. */
const HERO_PATTERN =
  "radial-gradient(70% 90% at 50% -20%, rgba(47,127,176,.16), transparent 62%)," +
  "repeating-linear-gradient(90deg, rgba(19,74,111,.035) 0 1px, transparent 1px 52px)";

/**
 * Top of /destinations: the static banner copy, followed by the interactive
 * explorer. The two share one continuous light-to-white gradient — this section
 * runs #f2f7fa → #fbfcfd and the explorer's search band picks up at #fbfcfd.
 */
export default function DestinationsHero() {
  return (
    <>
      <section
        id="top"
        className="relative overflow-hidden bg-[linear-gradient(180deg,#f2f7fa_0%,#fbfcfd_100%)] px-6 pt-[66px] sm:px-10"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: HERO_PATTERN }}
        />

        <div className="relative mx-auto max-w-[720px] text-center">
          <span className="tp-rise inline-flex items-center gap-2 rounded-full border border-[#d8e8f2] bg-white px-3.5 py-[7px] text-[12px] font-bold uppercase tracking-[.09em] text-brand-600 shadow-[0_8px_20px_-14px_rgba(20,52,78,.5)]">
            <SparkleIcon size={13} />
            3,480 guides · 112 countries
          </span>

          <h1 className="tp-rise mt-5 text-[36px] font-extrabold leading-[1.04] tracking-[-.032em] text-ink-soft text-balance sm:text-[44px] lg:text-[52px]">
            Explore travel guides and{" "}
            <span className="font-serif font-medium italic text-brand-600">
              itineraries
            </span>
          </h1>

          <p className="tp-rise mx-auto mt-4 max-w-[520px] text-[16px] leading-[1.6] text-[#5b6a73] sm:text-[17.5px]">
            Real trips from real travellers — open any guide and remix it into
            your own plan in one click.
          </p>
        </div>
      </section>

      <DestinationsExplorer />
    </>
  );
}
