import type { StyleSpecification } from "maplibre-gl";

/**
 * CARTO Voyager, as a hand-written raster style.
 *
 * The now-deleted `RouteMap` pointed at MapLibre's demo vector style, an
 * outline-only developer basemap — fine behind four country-scale pins, useless
 * behind a walking itinerary where the reader needs streets, parks and the
 * river. Voyager is the basemap the design was drawn on.
 *
 * MapLibre has no `{s}` subdomain token, so the three CARTO hosts are listed as
 * three `tiles` entries; it round-robins them itself. `{ratio}` resolves to
 * `@2x` on retina displays and to nothing elsewhere.
 *
 * CARTO started requiring an API key on these raster endpoints — an unkeyed
 * request still 200s but the tile is watermarked "API KEY REQUIRED" over the
 * whole basemap. The key is free (no approval queue, 5M tile requests/month)
 * from https://carto.com/basemaps/apikey. It has to be `NEXT_PUBLIC_` because
 * both maps that use this style (`GuideMap`, `create-guide/LocationPickerModal`)
 * are client components building the tile URL in the browser, not on the
 * server. Left unset, the style still loads — the watermark is CARTO's
 * degraded-but-functional mode, not a hard failure — so this stays an `&key=`
 * suffix appended only when the env var is present rather than a required var.
 */
const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
const cartoKeyParam = cartoApiKey ? `?key=${cartoApiKey}` : "";

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["a", "b", "c"].map(
        (host) =>
          `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png${cartoKeyParam}`,
      ),
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "carto-tiles", type: "raster", source: "carto" }],
};
