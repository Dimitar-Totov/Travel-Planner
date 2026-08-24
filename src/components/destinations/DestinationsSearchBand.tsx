"use client";

import { SearchIcon } from "@/components/icons";
import { popularDestinations } from "@/lib/destinationGuides";

interface DestinationsSearchBandProps {
  draft: string;
  query: string;
  onDraftChange: (next: string) => void;
  onSearch: (next: string) => void;
}

/**
 * The search form and popular-destination chips. Rendered inside the shared
 * photo backdrop in `DestinationsExplorer`, so its copy is tuned light-on-dark;
 * the chips keep opaque light pill backgrounds so they stay legible wherever
 * the scrim happens to be over a bright part of the photo.
 */
export default function DestinationsSearchBand({
  draft,
  query,
  onDraftChange,
  onSearch,
}: DestinationsSearchBandProps) {
  return (
    <div>
      {/* Typing only updates the draft text — results don't filter until
          this submits (Search button or Enter). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(draft);
        }}
        className="tp-rise flex items-center gap-2.5 rounded-2xl border border-[#dbe4ea] bg-white py-2 pl-[18px] pr-2 shadow-[0_24px_50px_-32px_rgba(20,52,78,.55)]"
      >
        <label htmlFor="destination-search" className="sr-only">
          Search for a destination
        </label>
        <span className="flex-none text-[#94a4ad]">
          <SearchIcon size={19} />
        </span>
        <input
          id="destination-search"
          name="destination"
          type="search"
          autoComplete="off"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Search for a destination"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16.5px] font-medium text-ink outline-none placeholder:text-[#8a98a1] [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          className="tp-btn flex-none rounded-xl bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-[22px] py-3 text-[14.5px] font-bold text-white shadow-[0_14px_26px_-14px_rgba(19,74,111,.9)]"
        >
          Search
        </button>
      </form>

      <div className="mt-[22px] text-center text-[13.5px] text-[#e3eef5] [text-shadow:0_1px_10px_rgba(11,36,56,.55)]">
        Or browse our most popular destinations:
      </div>

      <div className="mt-[13px] flex flex-wrap justify-center gap-[9px]">
        {popularDestinations.map((place) => {
          const active = query === place;
          return (
            <button
              key={place}
              type="button"
              aria-pressed={active}
              onClick={() => onSearch(active ? "" : place)}
              className={`tp-chip rounded-full border px-[15px] py-2 text-[13px] font-semibold ${
                active
                  ? "border-[#c4dcec] bg-[#eaf3f9] text-brand-700"
                  : "border-[#e4eaee] bg-surface-2 text-[#46555f] hover:border-[#c4dcec] hover:bg-[#eaf3f9] hover:text-brand-700"
              }`}
            >
              {place}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSearch("")}
          className="tp-chip rounded-full border border-[#d3e7f2] bg-[#eaf3f9] px-[15px] py-2 text-[13px] font-bold text-brand-600 hover:border-[#c4dcec] hover:bg-[#e0eef7]"
        >
          See more&hellip;
        </button>
      </div>
    </div>
  );
}
