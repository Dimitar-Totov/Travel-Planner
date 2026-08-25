"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  Layer,
  Map,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "@vis.gl/react-maplibre";
import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import { CloseIcon, DownloadIcon } from "@/components/icons";
import type { ShownStop } from "@/lib/hooks/useGuideDetail";
import StopPin from "./StopPin";

/**
 * CARTO Voyager, as a hand-written raster style.
 *
 * The shared `RouteMap` points at MapLibre's demo vector style, which is an
 * outline-only developer basemap — fine behind four country-scale pins, useless
 * behind a walking itinerary where the reader needs streets, parks and the
 * river. Voyager is the basemap the design was drawn on.
 *
 * MapLibre has no `{s}` subdomain token, so the three CARTO hosts are listed as
 * three `tiles` entries; it round-robins them itself. `{ratio}` resolves to
 * `@2x` on retina displays and to nothing elsewhere.
 */
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["a", "b", "c"].map(
        (host) =>
          `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png`,
      ),
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "carto-tiles", type: "raster", source: "carto" }],
};

/**
 * Room for the chips along the top and the stop card along the bottom.
 *
 * Deliberately *not* recomputed when the card opens or closes — that would
 * re-fit the map under the reader mid-read. It is clamped against the pane's
 * own size instead, because `fitBounds` has no answer for padding that exceeds
 * the container: a landscape phone is barely 300px tall and a fixed 210px of
 * bottom padding would leave nothing to fit into.
 */
function fitPaddingFor(container: HTMLElement) {
  const inset = Math.min(56, Math.round(container.clientWidth * 0.14));
  return {
    top: Math.min(76, Math.round(container.clientHeight * 0.12)),
    bottom: Math.min(210, Math.round(container.clientHeight * 0.32)),
    left: inset,
    right: inset,
  };
}

/** Roughly 250 m of longitude at European latitudes. A one-stop day collapses
 *  the bounding box to a point, and `fitBounds` answers a zero-size box with
 *  the map's maximum zoom — this pads it out to a readable street view. */
const MIN_SPAN_DEG = 0.0022;

function boundsOf(stops: ShownStop[]): LngLatBoundsLike | null {
  if (stops.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const { stop } of stops) {
    minLng = Math.min(minLng, stop.lng);
    maxLng = Math.max(maxLng, stop.lng);
    minLat = Math.min(minLat, stop.lat);
    maxLat = Math.max(maxLat, stop.lat);
  }

  if (maxLng - minLng < MIN_SPAN_DEG) {
    const mid = (minLng + maxLng) / 2;
    minLng = mid - MIN_SPAN_DEG / 2;
    maxLng = mid + MIN_SPAN_DEG / 2;
  }
  if (maxLat - minLat < MIN_SPAN_DEG) {
    const mid = (minLat + maxLat) / 2;
    minLat = mid - MIN_SPAN_DEG / 2;
    maxLat = mid + MIN_SPAN_DEG / 2;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

interface GuideMapProps {
  stops: ShownStop[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Title of the day the map is filtered to, or `null` for the whole trip. */
  dayFilterLabel: string | null;
  onClearDayFilter: () => void;
}

/**
 * The map pane: numbered pins for every shown stop, a dashed route through
 * them, and the two floating chips.
 *
 * Fitting, rather than averaging: `RouteMap` centres on the mean coordinate and
 * picks a zoom from a span lookup, which is good enough for a four-city country
 * hop. Here a day can be five stops 300 m apart or a day trip to Versailles and
 * back, so the map asks MapLibre for a real `fitBounds` every time the shown
 * set changes.
 */
export default function GuideMap({
  stops,
  selectedKey,
  onSelect,
  dayFilterLabel,
  onClearDayFilter,
}: GuideMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [ready, setReady] = useState(false);
  const reduceMotion = useReducedMotion();

  // Only ever read on the first render — `fitBounds` takes over from `onLoad`.
  // Starting on stop one rather than a fixed centre means the first tiles the
  // browser fetches are already the right ones. Lazy `useState` rather than a
  // ref because this is read during render.
  const [initialViewState] = useState(() => ({
    longitude: stops[0]?.stop.lng ?? 0,
    latitude: stops[0]?.stop.lat ?? 20,
    zoom: stops.length > 0 ? 11 : 1.4,
  }));

  const routeGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: stops.map(
              ({ stop }) => [stop.lng, stop.lat] as [number, number],
            ),
          },
        },
      ],
    }),
    [stops],
  );

  // Fit whenever the shown set changes — mount, day filter on, day filter off.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const bounds = boundsOf(stops);
    if (!bounds) return;
    map.fitBounds(bounds, {
      padding: fitPaddingFor(map.getContainer()),
      duration: reduceMotion ? 0 : 600,
      // Without this a two-stops-next-door day would fill the pane with roof
      // tiles and no context.
      maxZoom: 15.5,
    });
  }, [stops, ready, reduceMotion]);

  // Centre on a newly selected stop. Guarded by a ref rather than by effect
  // deps because `stops` also changes on a filter, and re-running then would
  // undo the fit above — the pan is a response to *selection*, nothing else.
  const lastCenteredRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (lastCenteredRef.current === selectedKey) return;
    lastCenteredRef.current = selectedKey;
    if (!selectedKey) return;

    const target = stops.find((item) => item.key === selectedKey);
    if (!target) return;
    map.easeTo({
      center: [target.stop.lng, target.stop.lat],
      duration: reduceMotion ? 0 : 600,
      // Lifts the pin clear of the stop card that is about to slide up.
      offset: [0, -70],
    });
  }, [selectedKey, stops, ready, reduceMotion]);

  return (
    <>
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        dragRotate={false}
        onLoad={() => setReady(true)}
        onError={(event) => {
          console.warn("Guide map tile request failed", event.error);
        }}
      >
        {/* Top-right is the only corner nothing else claims: the chips sit top-
            left, the zoom control bottom-right, and the stop card covers the
            bottom edge. The attribution is a CARTO/OSM licence requirement, so
            it has to stay uncovered. */}
        <AttributionControl position="top-right" />
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* A one-stop day has no route to draw, and a single-coordinate
            LineString is not a line. */}
        {stops.length > 1 && (
          <Source id="guide-route" type="geojson" data={routeGeoJSON}>
            <Layer
              id="guide-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#134a6f",
                "line-width": 2.4,
                "line-opacity": 0.55,
                "line-dasharray": [2, 5],
              }}
            />
          </Source>
        )}

        {stops.map((item) => {
          const selected = item.key === selectedKey;
          return (
            <Marker
              key={item.key}
              longitude={item.stop.lng}
              latitude={item.stop.lat}
              anchor="bottom"
              style={{
                zIndex: selected ? 3 : item.stop.highlight ? 2 : 1,
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  // Otherwise MapLibre also treats this as a map click.
                  event.stopPropagation();
                  onSelect(item.key);
                }}
                aria-pressed={selected}
                aria-label={`${item.dayTitle}, stop ${item.number}: ${item.stop.name}`}
                title={item.stop.name}
                className="block cursor-pointer rounded-full outline-offset-4 outline-brand-500 focus-visible:outline-2"
              >
                <StopPin
                  n={item.number}
                  tone={item.stop.highlight ? "gold" : "brand"}
                  size={30}
                  selected={selected}
                  shadow
                />
              </button>
            </Marker>
          );
        })}
      </Map>

      <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2 sm:left-5 sm:top-5">
        {/* Visual parity with the design. Export needs a serialiser and a file
            format decision that don't exist yet, so it is genuinely disabled
            rather than a pill that swallows clicks. */}
        <button
          type="button"
          disabled
          title="Export is coming soon"
          className="pointer-events-auto inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-white/80 px-[15px] py-2.5 text-[13px] font-bold text-brand-700/60 shadow-[0_10px_26px_-14px_rgba(20,52,78,.6)] backdrop-blur-[8px]"
        >
          <DownloadIcon size={15} />
          Export
        </button>

        {dayFilterLabel && (
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/94 py-1.5 pl-3.5 pr-1.5 text-[12.5px] font-bold text-brand-700 shadow-[0_10px_26px_-14px_rgba(20,52,78,.6)] backdrop-blur-[8px]">
            Showing {dayFilterLabel}
            <button
              type="button"
              onClick={onClearDayFilter}
              className="tp-chip inline-flex items-center gap-1 rounded-full bg-brand-500/12 px-2.5 py-1 text-[12px] font-bold text-brand-700 outline-offset-2 outline-brand-500 hover:bg-brand-500/20 focus-visible:outline-2"
            >
              <CloseIcon size={11} />
              Show all
            </button>
          </span>
        )}
      </div>
    </>
  );
}
