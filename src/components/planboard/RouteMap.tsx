"use client";

import { useMemo } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map, Layer, Marker, NavigationControl, Source } from "@vis.gl/react-maplibre";
import type { RoutePlan, RouteStop } from "@/lib/types";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

function getViewState(stops: RouteStop[]): ViewState {
  if (stops.length === 0) {
    return { longitude: 12.5, latitude: 42.5, zoom: 3.2 };
  }

  const lngs = stops.map((stop) => stop.lng);
  const lats = stops.map((stop) => stop.lat);
  const longitude = lngs.reduce((sum, value) => sum + value, 0) / lngs.length;
  const latitude = lats.reduce((sum, value) => sum + value, 0) / lats.length;
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const span = Math.max(spanLng, spanLat);

  let zoom = 3.4;
  if (span < 5) zoom = 5.5;
  else if (span < 15) zoom = 4.4;
  else if (span < 30) zoom = 3.7;

  return { longitude, latitude, zoom };
}

function buildRouteGeoJSON(stops: RouteStop[]) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: stops.map((stop) => [stop.lng, stop.lat] as [number, number]),
        },
      },
    ],
  };
}

export default function RouteMap({
  route,
  days,
  budget,
  currency,
  mapShape,
}: {
  route: RoutePlan;
  days: number;
  budget: number;
  currency: string;
  mapShape?: "italy";
}) {
  const viewState = useMemo(() => getViewState(route.stops), [route.stops]);
  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(route.stops), [route.stops]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <Map
        initialViewState={viewState}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        scrollZoom
        dragRotate={false}
        onError={(event) => {
          console.warn("Map tile request failed", event.error);
        }}
      >
        <NavigationControl position="bottom-right" />
        <Source id="route-line" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line-layer"
            type="line"
            paint={{
              "line-color": "#1c5b83",
              "line-width": 3.5,
              "line-dasharray": [1.2, 5],
            }}
          />
        </Source>

        {route.stops.map((stop) => (
          <Marker key={stop.name} longitude={stop.lng} latitude={stop.lat} anchor="center">
            <div className="flex flex-col items-center">
              <div className="rounded-full border-2 border-white bg-[#17527a] p-1.5 shadow-[0_8px_18px_rgba(15,49,76,0.25)]">
                <div className="h-2.5 w-2.5 rounded-full bg-white" />
              </div>
              <div className="mt-1 rounded-full border border-[#dbe7ee] bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#163445] shadow-sm">
                {stop.name}
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      <span className="tp-chip absolute left-4 top-3.5 inline-flex items-center gap-2 rounded-full border border-brand-600/15 bg-white/80 px-3.5 py-[7px] text-[12.5px] font-semibold text-[#1c5b83] shadow-[0_6px_20px_-12px_rgba(20,60,90,.5)] backdrop-blur-sm">
        <span className="h-[7px] w-[7px] rounded-full bg-gold-2" />
        {route.summary}
      </span>
      <span className="absolute right-4 top-3.5 inline-flex items-center gap-2 rounded-full border border-brand-600/15 bg-white/80 px-3.5 py-[7px] text-[12.5px] font-semibold text-ink shadow-[0_6px_20px_-12px_rgba(20,60,90,.5)] backdrop-blur-sm">
        <span className="h-[7px] w-[7px] rounded-full bg-brand-500" />
        {days} days · {currency}
        {budget.toLocaleString()}
      </span>

      <div className="absolute bottom-3.5 left-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#4a5b66]">
          <span className="h-0 w-5 rounded-sm border-t-[2.5px] border-dashed border-[#1c5b83]" />
          Suggested route
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#4a5b66]">
          <span className="h-[11px] w-[11px] rounded-full border-2 border-white bg-[#17527a] shadow-[0_0_0_1px_rgba(23,82,122,.25)]" />
          Overnight stop
        </div>
      </div>
      <div className="absolute bottom-2.5 right-3 font-mono text-[9.5px] lowercase tracking-[.02em] text-[#8a99a3]">
        {route.distanceKm > 0 ? `${route.distanceKm} km · live map` : "live map"}
      </div>
    </div>
  );
}
