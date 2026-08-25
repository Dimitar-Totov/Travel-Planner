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
 * It lives in its own module because two maps now render it — the read-only
 * `GuideMap` and the click-to-place picker behind `/create-guide` — and a
 * second copy of the tile config would be a licence/attribution footgun the
 * moment one of them is edited.
 */
export const MAP_STYLE: StyleSpecification = {
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
