"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  Map,
  Marker,
  NavigationControl,
  type MapLayerMouseEvent,
  type MarkerDragEvent,
} from "@vis.gl/react-maplibre";
import type {
  DraftDay,
  DraftStop,
  PickerTarget,
} from "@/lib/hooks/useCreateGuideForm";
import { CheckIcon, CloseIcon } from "@/components/icons";
import StopPin from "@/components/destinations/detail/StopPin";
import { MAP_STYLE } from "@/components/destinations/detail/mapStyle";

/** Everything that can hold focus and isn't explicitly removed from the tab
 *  order — used to wrap Tab around inside the dialog. Same list
 *  `MapOverlaySheet` traps against. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface Point {
  lat: number;
  lng: number;
}

/** A stop that already has a confirmed position, plus the number on its pin. */
interface ContextPin extends Point {
  key: string;
  name: string;
  number: number;
  dayTitle: string;
}

interface LocationPickerModalProps {
  /** The whole draft — every placed stop is drawn for spatial context. */
  days: DraftDay[];
  target: PickerTarget;
  onCancel: () => void;
  onConfirm: (lat: number, lng: number) => void;
}

/**
 * Click-to-place coordinates for one stop.
 *
 * A guide's `lat`/`lng` are the only fields whose mistakes are invisible in the
 * form and catastrophic on the page — a transposed digit is a pin in the sea —
 * so they are picked off a map instead of typed.
 *
 * It renders its own lean `<Map>` rather than reusing `GuideMap`: that
 * component's entire job is showing and selecting *existing* pins, with a
 * `fitBounds` pass, a route line and a stop card built around that. Adding a
 * placement mode would compromise it for the two routes that already depend on
 * it. What is shared is the thing that must not diverge — `MAP_STYLE`.
 *
 * Only ever mounted while `pickerTarget !== null`, and only reachable from Edit
 * mode, so it can never be alive at the same time as the preview's map. One
 * WebGL context at a time is a standing rule for this app's maps.
 */
export default function LocationPickerModal({
  days,
  target,
  onCancel,
  onConfirm,
}: LocationPickerModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const { stop, stopNumber, dayTitle, contextPins } = useMemo(() => {
    const pins: ContextPin[] = [];
    let found: DraftStop | null = null;
    let foundNumber = 0;
    let foundDayTitle = "";

    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex];
      const dayLabel = day.title.trim() || `Day ${dayIndex + 1}`;

      for (let stopIndex = 0; stopIndex < day.stops.length; stopIndex += 1) {
        const item = day.stops[stopIndex];

        if (day.id === target.dayId && item.id === target.stopId) {
          found = item;
          foundNumber = stopIndex + 1;
          foundDayTitle = dayLabel;
          continue;
        }
        if (!item.placed) continue;

        pins.push({
          key: item.id,
          name: item.name.trim() || `Stop ${stopIndex + 1}`,
          number: stopIndex + 1,
          dayTitle: dayLabel,
          lat: item.lat,
          lng: item.lng,
        });
      }
    }

    return {
      stop: found,
      stopNumber: foundNumber,
      dayTitle: foundDayTitle,
      contextPins: pins,
    };
  }, [days, target]);

  const [point, setPoint] = useState<Point | null>(() =>
    stop?.placed ? { lat: stop.lat, lng: stop.lng } : null,
  );

  // Read once, on the first render only — MapLibre owns the camera afterwards.
  // Same fallback ladder `GuideMap` uses: the thing being placed, then whatever
  // else is already on the map, then a world view.
  const [initialViewState] = useState(() => {
    if (stop?.placed) {
      return { longitude: stop.lng, latitude: stop.lat, zoom: 14 };
    }
    if (contextPins.length > 0) {
      const sum = contextPins.reduce(
        (acc, pin) => ({ lat: acc.lat + pin.lat, lng: acc.lng + pin.lng }),
        { lat: 0, lng: 0 },
      );
      return {
        longitude: sum.lng / contextPins.length,
        latitude: sum.lat / contextPins.length,
        zoom: 11,
      };
    }
    return { longitude: 0, latitude: 20, zoom: 1.4 };
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const root = rootRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const stopLabel = stop?.name.trim() || `Stop ${stopNumber}`;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Set the location of ${stopLabel}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={{
        duration: reduceMotion ? 0.12 : 0.3,
        ease: [0.2, 0.7, 0.2, 1],
      }}
      className="fixed inset-0 z-50 flex flex-col bg-[#e9eff2]"
    >
      <header className="flex flex-none items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-[15.5px] font-extrabold tracking-[-.02em] text-ink">
            {stopLabel}
          </h2>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            {dayTitle} · Click the map to drop the pin, then drag it to
            fine-tune.
          </p>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onCancel}
          aria-label="Close the location picker"
          className="tp-btn-shadow inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 text-ink outline-offset-2 outline-brand-500 hover:bg-surface focus-visible:outline-2"
        >
          <CloseIcon size={17} />
        </button>
      </header>

      {/* `absolute inset-0` on the map's own host, not `h-full`: this pane is a
          flex item with no explicit height, so a percentage height would have
          nothing to resolve against — the same reason `ItineraryDetailView`
          mounts its map pane that way. */}
      <div className="tp-map relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Map
            initialViewState={initialViewState}
            mapStyle={MAP_STYLE}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
            dragRotate={false}
            cursor="crosshair"
            onClick={(event: MapLayerMouseEvent) =>
              setPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng })
            }
            onError={(event) => {
              console.warn("Location picker tile request failed", event.error);
            }}
          >
            {/* The CARTO/OSM attribution is a licence requirement, so it stays on
              screen here exactly as it does on the read-only map. */}
            <AttributionControl position="top-right" />
            <NavigationControl position="bottom-right" showCompass={false} />

            {contextPins.map((pin) => (
              <Marker
                key={pin.key}
                longitude={pin.lng}
                latitude={pin.lat}
                anchor="bottom"
                style={{ zIndex: 1, opacity: 0.65, pointerEvents: "none" }}
              >
                <StopPin n={pin.number} tone="brand" size={22} shadow />
                <span className="sr-only">
                  {pin.dayTitle}, stop {pin.number}: {pin.name}
                </span>
              </Marker>
            ))}

            {point && (
              <Marker
                longitude={point.lng}
                latitude={point.lat}
                anchor="bottom"
                draggable
                onDragEnd={(event: MarkerDragEvent) =>
                  setPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng })
                }
                style={{ zIndex: 3, cursor: "grab" }}
              >
                <StopPin n={stopNumber} tone="gold" size={34} selected shadow />
              </Marker>
            )}
          </Map>
        </div>

        {!point && (
          <p className="pointer-events-none absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full bg-white/92 px-4 py-2 text-[12.5px] font-bold text-brand-700 shadow-[0_10px_26px_-14px_rgba(20,52,78,.6)] backdrop-blur-[8px]">
            Click anywhere on the map to place this stop
          </p>
        )}
      </div>

      <footer className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-4 py-3.5 sm:px-6">
        <p
          aria-live="polite"
          className="text-[13px] font-semibold tabular-nums text-muted"
        >
          {point
            ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : "No point set yet"}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="tp-btn-shadow rounded-full border border-[#d5e2ea] bg-white px-5 py-2.5 text-[14px] font-bold text-brand-700 outline-offset-2 outline-brand-500 hover:border-brand-700 focus-visible:outline-2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!point}
            onClick={() => point && onConfirm(point.lat, point.lng)}
            className="tp-btn-shadow inline-flex items-center gap-2 rounded-full bg-[linear-gradient(150deg,#2f7fb0,#134a6f)] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_12px_24px_-14px_rgba(19,74,111,.9)] outline-offset-2 outline-brand-500 focus-visible:outline-2 disabled:cursor-not-allowed disabled:bg-none disabled:bg-surface-2 disabled:text-[#a3b0b8] disabled:shadow-none"
          >
            <CheckIcon size={15} strokeWidth={2.6} />
            Confirm location
          </button>
        </div>
      </footer>
    </motion.div>
  );
}
