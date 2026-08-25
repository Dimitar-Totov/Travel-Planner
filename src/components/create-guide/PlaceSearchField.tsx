"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CloseIcon, MapPinIcon, SearchIcon } from "@/components/icons";
import { searchKnownPlaces, type KnownPlace } from "@/lib/knownPlaces";

/** Matches the cap the picker's dropdown can show without scrolling on a
 *  landscape phone. Passed explicitly so the number lives next to the list it
 *  sizes rather than in `searchKnownPlaces`' default. */
const MAX_SUGGESTIONS = 6;

interface PlaceSearchFieldProps {
  /** Fired on click or Enter. The picker drops its draggable pin on the place
   *  and flies the camera there; this component only reports the choice. */
  onSelect: (place: KnownPlace) => void;
}

/**
 * Type-a-city jump box for the location picker's map.
 *
 * Backed entirely by `KNOWN_PLACES` — no geocoder, no network, no debounce —
 * so a keystroke costs one pass over ~170 rows and the suggestions can never
 * arrive out of order or after the author has moved on.
 *
 * It is a combobox in the `aria-activedescendant` style: focus never leaves the
 * input, the options are `role="option"` list items rather than buttons, and
 * arrow keys move a highlight the input points at. That is also what keeps it
 * compatible with the modal's Tab trap — the only tab stops it adds are the
 * input and (once there is text) the clear button.
 *
 * **Escape is the one interaction with a trap in it.** The picker closes itself
 * from a `keydown` listener on `document`, and under the App Router React's own
 * delegated listeners are on `document` too (`hydrateRoot(document, …)`), which
 * means `stopPropagation()` alone cannot save us: both handlers sit on the same
 * node, and stopping propagation never affects listeners already attached to
 * the node the event has reached. Dismissing the dropdown therefore needs
 * `stopImmediatePropagation()` on the native event — React's document listener
 * runs first (it was registered at hydration, long before the modal mounted),
 * so cutting the rest of that node's listeners is what stops the first Escape
 * from also tearing down the whole picker. When the dropdown is *closed*,
 * Escape is deliberately left alone to reach the modal and close it.
 */
export default function PlaceSearchField({ onSelect }: PlaceSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listId = `${baseId}-places`;
  const optionId = (index: number) => `${baseId}-place-${index}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const results = useMemo(
    () => searchKnownPlaces(query, MAX_SUGGESTIONS),
    [query],
  );
  const expanded = open && results.length > 0;
  const noMatches = open && query.trim().length > 0 && results.length === 0;

  /**
   * The results are a pure function of `query`, so every place the query moves
   * is also every place the list can change — and each of them resets the
   * highlight to the top. That is what makes Enter commit the best match
   * without the author ever pressing an arrow key, and it keeps `highlight`
   * inside `results`' bounds by construction rather than by clamping later.
   */
  function retype(next: string) {
    setQuery(next);
    setHighlight(0);
  }

  useEffect(() => {
    if (!expanded) return;
    const option = listRef.current?.children[highlight];
    if (option instanceof HTMLElement)
      option.scrollIntoView({ block: "nearest" });
  }, [expanded, highlight]);

  function commit(place: KnownPlace) {
    onSelect(place);
    retype("");
    setOpen(false);
    // Focus never actually left the input (options preventDefault on mouse
    // down), but a click on an option can only be trusted to keep it there
    // because of that — this is the belt to that braces, and it keeps the
    // modal's Tab trap anchored on a live element either way.
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      // Nothing on screen to dismiss — a focused but empty field included —
      // so let the keystroke through to the picker's own Escape handling.
      if (!expanded && !noMatches) return;
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      if (!expanded) {
        setOpen(true);
        setHighlight(0);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight(
        (current) => (current + step + results.length) % results.length,
      );
      return;
    }

    if (event.key === "Enter") {
      if (!expanded) return;
      const place = results[highlight];
      if (!place) return;
      event.preventDefault();
      commit(place);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${baseId}-input`} className="sr-only">
        Search for a city, region or country
      </label>

      <div className="flex items-center gap-2 rounded-full bg-white/94 py-2 pl-3.5 pr-2 shadow-[0_14px_32px_-16px_rgba(20,52,78,.75)] outline-offset-2 outline-brand-500 backdrop-blur-[8px] focus-within:outline-2">
        <span className="flex-none text-[#94a4ad]">
          <SearchIcon size={17} />
        </span>

        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? optionId(highlight) : undefined}
          value={query}
          placeholder="Jump to a place…"
          onChange={(event) => {
            retype(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Options never take focus, so a blur means the author has genuinely
          // left the field (Tab, or a click on the map).
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-[#8a98a1]"
        />

        {query !== "" && (
          <button
            type="button"
            aria-label="Clear the place search"
            onClick={() => {
              retype("");
              setOpen(false);
              // The button unmounts the moment the text goes, so focus has to
              // be handed somewhere deliberate or it lands on <body> and
              // escapes the modal's Tab trap.
              inputRef.current?.focus();
            }}
            className="tp-chip inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-500/12 text-brand-700 outline-offset-2 outline-brand-500 hover:bg-brand-500/20 focus-visible:outline-2"
          >
            <CloseIcon size={13} />
          </button>
        )}
      </div>

      {expanded && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Matching places"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] max-h-[min(16rem,50vh)] overflow-y-auto rounded-2xl bg-white/95 p-1.5 shadow-[0_20px_44px_-20px_rgba(20,52,78,.8)] backdrop-blur-[8px]"
        >
          {results.map((place, index) => {
            const active = index === highlight;
            return (
              <li
                key={`${place.name}-${index}`}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                // Keeps focus in the input, so `onBlur` can close the dropdown
                // without racing the click that is about to select an option.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(place)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-semibold ${
                  active ? "bg-brand-500/12 text-brand-700" : "text-ink"
                }`}
              >
                <span
                  className={`flex-none ${active ? "text-brand-600" : "text-[#94a4ad]"}`}
                >
                  <MapPinIcon size={14} />
                </span>
                <span className="truncate">{place.name}</span>
              </li>
            );
          })}
        </ul>
      )}

      {noMatches && (
        <p
          role="status"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-2xl bg-white/95 px-3.5 py-2.5 text-[12.5px] font-semibold text-muted shadow-[0_20px_44px_-20px_rgba(20,52,78,.8)] backdrop-blur-[8px]"
        >
          No match for &ldquo;{query.trim()}&rdquo; &mdash; pan the map instead.
        </p>
      )}
    </div>
  );
}
