/**
 * Free text → a place we can point a map at.
 *
 * Same philosophy as `KNOWN_CITIES`/`detectCity` in `src/lib/plans.ts`: a small,
 * hand-maintained table scanned with case-insensitive word-boundary matching —
 * no network calls, no geocoding service, no randomness, so the answer for a
 * given string never changes between renders or environments. Anything the
 * table doesn't recognise resolves to `null`, and every caller is expected to
 * have a graceful fallback for that.
 *
 * It is deliberately *not* exhaustive. Today its only consumer is the
 * create-guide location picker, which uses it to bias the map's opening camera
 * at the guide's headline accent ("England", "old Lisbon"); a miss just means
 * the picker opens on the world view it always used to.
 */

export interface KnownPlace {
  name: string;
  lat: number;
  lng: number;
  /**
   * Hand-picked opening zoom for this entry, chosen so the place roughly fills
   * the viewport: ~10–11 for a city, ~6–8 for a small country, island or
   * region, ~5 for a mid-size country, ~3–4 for a very large one.
   */
  zoom: number;
}

/**
 * Ordered most-specific-first, because `resolveKnownPlace` returns the first
 * entry whose name appears in the query: cities before the regions that
 * contain them, so "3 days in Lisbon, Portugal" opens on Lisbon rather than
 * the whole country. Aliases ("UK", "USA", "Czech Republic") are plain extra
 * entries pointing at the same coordinates.
 */
const KNOWN_PLACES: KnownPlace[] = [
  // --- Cities -------------------------------------------------------------
  { name: "Lisbon", lat: 38.7223, lng: -9.1393, zoom: 10 },
  { name: "Porto", lat: 41.1579, lng: -8.6291, zoom: 11 },
  { name: "Madrid", lat: 40.4168, lng: -3.7038, zoom: 10 },
  { name: "Barcelona", lat: 41.3874, lng: 2.1686, zoom: 11 },
  { name: "Seville", lat: 37.3891, lng: -5.9845, zoom: 11 },
  { name: "Paris", lat: 48.8566, lng: 2.3522, zoom: 10 },
  { name: "Rome", lat: 41.9028, lng: 12.4964, zoom: 10 },
  { name: "Florence", lat: 43.7696, lng: 11.2558, zoom: 11 },
  { name: "Venice", lat: 45.4408, lng: 12.3155, zoom: 11 },
  { name: "London", lat: 51.5074, lng: -0.1278, zoom: 10 },
  { name: "Edinburgh", lat: 55.9533, lng: -3.1883, zoom: 11 },
  { name: "Dublin", lat: 53.3498, lng: -6.2603, zoom: 11 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, zoom: 11 },
  { name: "Berlin", lat: 52.52, lng: 13.405, zoom: 10 },
  { name: "Munich", lat: 48.1351, lng: 11.582, zoom: 11 },
  { name: "Vienna", lat: 48.2082, lng: 16.3738, zoom: 11 },
  { name: "Prague", lat: 50.0755, lng: 14.4378, zoom: 11 },
  { name: "Budapest", lat: 47.4979, lng: 19.0402, zoom: 11 },
  { name: "Copenhagen", lat: 55.6761, lng: 12.5683, zoom: 11 },
  { name: "Stockholm", lat: 59.3293, lng: 18.0686, zoom: 10 },
  { name: "Reykjavik", lat: 64.1466, lng: -21.9426, zoom: 10 },
  { name: "Athens", lat: 37.9838, lng: 23.7275, zoom: 10 },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, zoom: 10 },
  { name: "Dubrovnik", lat: 42.6507, lng: 18.0944, zoom: 12 },
  { name: "Marrakech", lat: 31.6295, lng: -7.9811, zoom: 11 },
  { name: "Cairo", lat: 30.0444, lng: 31.2357, zoom: 10 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, zoom: 10 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, zoom: 10 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, zoom: 10 },
  { name: "Kyoto", lat: 35.0116, lng: 135.7681, zoom: 11 },
  { name: "Seoul", lat: 37.5665, lng: 126.978, zoom: 10 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694, zoom: 10 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, zoom: 10 },
  { name: "Bangkok", lat: 13.7563, lng: 100.5018, zoom: 10 },
  { name: "Hanoi", lat: 21.0278, lng: 105.8342, zoom: 10 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, zoom: 10 },
  { name: "New York", lat: 40.7128, lng: -74.006, zoom: 10 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194, zoom: 11 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, zoom: 9 },
  { name: "Vancouver", lat: 49.2827, lng: -123.1207, zoom: 10 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, zoom: 10 },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, zoom: 10 },
  { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, zoom: 10 },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816, zoom: 10 },

  // --- Islands and sub-national regions -----------------------------------
  { name: "Santorini", lat: 36.3932, lng: 25.4615, zoom: 11 },
  { name: "Crete", lat: 35.2401, lng: 24.8093, zoom: 8 },
  { name: "Sicily", lat: 37.6, lng: 14.0154, zoom: 8 },
  { name: "Tuscany", lat: 43.4, lng: 11.2, zoom: 8 },
  { name: "Bali", lat: -8.4095, lng: 115.1889, zoom: 9 },
  { name: "Andalusia", lat: 37.5443, lng: -4.7278, zoom: 7 },
  { name: "Provence", lat: 43.9352, lng: 6.0679, zoom: 8 },
  { name: "Bavaria", lat: 48.7904, lng: 11.4979, zoom: 7 },
  { name: "Patagonia", lat: -44.0, lng: -70.0, zoom: 4 },

  // --- Britain and Ireland ------------------------------------------------
  { name: "England", lat: 52.5, lng: -1.5, zoom: 6 },
  { name: "Scotland", lat: 56.8, lng: -4.2, zoom: 6 },
  { name: "Wales", lat: 52.3305, lng: -3.7837, zoom: 7 },
  { name: "United Kingdom", lat: 54.5, lng: -3.0, zoom: 5 },
  { name: "Britain", lat: 54.5, lng: -3.0, zoom: 5 },
  { name: "UK", lat: 54.5, lng: -3.0, zoom: 5 },
  { name: "Ireland", lat: 53.4129, lng: -8.2439, zoom: 6 },

  // --- Europe -------------------------------------------------------------
  { name: "Portugal", lat: 39.5, lng: -8.0, zoom: 6 },
  { name: "Spain", lat: 40.2, lng: -3.7, zoom: 5 },
  { name: "France", lat: 46.6, lng: 2.2, zoom: 5 },
  { name: "Italy", lat: 42.5, lng: 12.5, zoom: 5 },
  { name: "Germany", lat: 51.1657, lng: 10.4515, zoom: 5 },
  { name: "Switzerland", lat: 46.8182, lng: 8.2275, zoom: 6 },
  { name: "Austria", lat: 47.5162, lng: 14.5501, zoom: 6 },
  { name: "Netherlands", lat: 52.1326, lng: 5.2913, zoom: 6 },
  { name: "Belgium", lat: 50.5039, lng: 4.4699, zoom: 7 },
  { name: "Luxembourg", lat: 49.8153, lng: 6.1296, zoom: 8 },
  { name: "Denmark", lat: 56.05, lng: 10.0, zoom: 6 },
  { name: "Norway", lat: 64.5, lng: 12.0, zoom: 4 },
  { name: "Sweden", lat: 62.0, lng: 15.5, zoom: 4 },
  { name: "Finland", lat: 64.5, lng: 26.0, zoom: 4 },
  { name: "Iceland", lat: 64.9631, lng: -19.0208, zoom: 5 },
  { name: "Poland", lat: 51.9194, lng: 19.1451, zoom: 5 },
  { name: "Czech Republic", lat: 49.8175, lng: 15.473, zoom: 6 },
  { name: "Czechia", lat: 49.8175, lng: 15.473, zoom: 6 },
  { name: "Slovakia", lat: 48.669, lng: 19.699, zoom: 6 },
  { name: "Hungary", lat: 47.1625, lng: 19.5033, zoom: 6 },
  { name: "Slovenia", lat: 46.1512, lng: 14.9955, zoom: 7 },
  { name: "Croatia", lat: 45.1, lng: 15.2, zoom: 6 },
  { name: "Montenegro", lat: 42.7087, lng: 19.3744, zoom: 7 },
  { name: "Albania", lat: 41.1533, lng: 20.1683, zoom: 7 },
  { name: "Serbia", lat: 44.0165, lng: 21.0059, zoom: 6 },
  { name: "Romania", lat: 45.9432, lng: 24.9668, zoom: 6 },
  { name: "Bulgaria", lat: 42.7339, lng: 25.4858, zoom: 6 },
  { name: "Greece", lat: 39.0742, lng: 22.5, zoom: 5 },
  { name: "Estonia", lat: 58.5953, lng: 25.0136, zoom: 6 },
  { name: "Latvia", lat: 56.8796, lng: 24.6032, zoom: 6 },
  { name: "Lithuania", lat: 55.1694, lng: 23.8813, zoom: 6 },
  { name: "Malta", lat: 35.9375, lng: 14.3754, zoom: 10 },
  { name: "Cyprus", lat: 35.1264, lng: 33.4299, zoom: 8 },
  { name: "Turkey", lat: 38.9637, lng: 35.2433, zoom: 5 },

  // --- Middle East and Africa ---------------------------------------------
  { name: "United Arab Emirates", lat: 23.9, lng: 54.3, zoom: 6 },
  { name: "Qatar", lat: 25.3548, lng: 51.1839, zoom: 8 },
  { name: "Oman", lat: 21.4735, lng: 55.9754, zoom: 5 },
  { name: "Saudi Arabia", lat: 23.8859, lng: 45.0792, zoom: 4 },
  { name: "Jordan", lat: 30.5852, lng: 36.2384, zoom: 6 },
  { name: "Israel", lat: 31.4, lng: 35.0, zoom: 7 },
  { name: "Egypt", lat: 26.8206, lng: 30.8025, zoom: 5 },
  { name: "Morocco", lat: 31.7917, lng: -7.0926, zoom: 5 },
  { name: "Tunisia", lat: 33.8869, lng: 9.5375, zoom: 6 },
  { name: "Kenya", lat: -0.0236, lng: 37.9062, zoom: 5 },
  { name: "Tanzania", lat: -6.369, lng: 34.8888, zoom: 5 },
  { name: "Namibia", lat: -22.9576, lng: 18.4904, zoom: 5 },
  { name: "Botswana", lat: -22.3285, lng: 24.6849, zoom: 5 },
  { name: "South Africa", lat: -30.5595, lng: 22.9375, zoom: 4 },

  // --- Asia ---------------------------------------------------------------
  { name: "Japan", lat: 36.2048, lng: 138.2529, zoom: 4 },
  { name: "South Korea", lat: 36.5, lng: 127.8, zoom: 6 },
  { name: "China", lat: 35.8617, lng: 104.1954, zoom: 3 },
  { name: "Taiwan", lat: 23.6978, lng: 120.9605, zoom: 6 },
  { name: "Vietnam", lat: 14.0583, lng: 108.2772, zoom: 5 },
  { name: "Thailand", lat: 15.87, lng: 100.9925, zoom: 5 },
  { name: "Cambodia", lat: 12.5657, lng: 104.991, zoom: 6 },
  { name: "Laos", lat: 19.8563, lng: 102.4955, zoom: 6 },
  { name: "Malaysia", lat: 4.2105, lng: 108.9758, zoom: 5 },
  { name: "Indonesia", lat: -2.5489, lng: 118.0149, zoom: 4 },
  { name: "Philippines", lat: 12.8797, lng: 121.774, zoom: 5 },
  { name: "India", lat: 20.5937, lng: 78.9629, zoom: 4 },
  { name: "Sri Lanka", lat: 7.8731, lng: 80.7718, zoom: 7 },
  { name: "Nepal", lat: 28.3949, lng: 84.124, zoom: 6 },

  // --- Americas and Oceania -----------------------------------------------
  { name: "United States", lat: 39.5, lng: -98.35, zoom: 3 },
  { name: "USA", lat: 39.5, lng: -98.35, zoom: 3 },
  { name: "Canada", lat: 56.1304, lng: -106.3468, zoom: 3 },
  { name: "Mexico", lat: 23.6345, lng: -102.5528, zoom: 4 },
  { name: "Cuba", lat: 21.5218, lng: -79.5, zoom: 6 },
  { name: "Guatemala", lat: 15.7835, lng: -90.2308, zoom: 6 },
  { name: "Costa Rica", lat: 9.7489, lng: -83.7534, zoom: 7 },
  { name: "Colombia", lat: 4.5709, lng: -74.2973, zoom: 5 },
  { name: "Ecuador", lat: -1.8312, lng: -78.1834, zoom: 6 },
  { name: "Peru", lat: -9.19, lng: -75.0152, zoom: 4 },
  { name: "Bolivia", lat: -16.2902, lng: -63.5887, zoom: 5 },
  { name: "Chile", lat: -35.6751, lng: -71.543, zoom: 3 },
  { name: "Argentina", lat: -38.4161, lng: -63.6167, zoom: 3 },
  { name: "Brazil", lat: -14.235, lng: -51.9253, zoom: 3 },
  { name: "Australia", lat: -25.2744, lng: 133.7751, zoom: 3 },
  { name: "New Zealand", lat: -41.5, lng: 172.8, zoom: 4 },
];

/** Mirrors `plans.ts`'s helper of the same name — kept local so this module
 *  stays a standalone lookup with no dependency on the mock plan layer. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesWord(query: string, word: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(word)}\\b`, "i").test(query);
}

/**
 * Finds the first known place named anywhere in `query`, or `null` when the
 * query is blank or mentions nothing in the table. Matching is
 * case-insensitive and word-bounded, so "old Lisbon" resolves to Lisbon while
 * "Englishman" never resolves to England.
 */
export function resolveKnownPlace(query: string): KnownPlace | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const place of KNOWN_PLACES) {
    if (matchesWord(trimmed, place.name)) return place;
  }
  return null;
}

/**
 * Live-as-you-type companion to `resolveKnownPlace`: every entry whose name
 * *contains* `query`, best first, capped at `limit`.
 *
 * Deliberately a substring test rather than `resolveKnownPlace`'s word-boundary
 * one. The two answer different questions — that one asks "is this place named
 * in this sentence?", where a loose match turns "Englishman" into England; this
 * one asks "what is the typist reaching for?", where a prefix is all they have
 * typed yet and "Lon" must offer London long before the word is finished.
 *
 * Ranking is prefix-matches-then-substring-matches, each group keeping
 * `KNOWN_PLACES`' own most-specific-first order — so "Port" lists Porto (a
 * prefix) above Portugal's neighbours in the table, and "ram" still surfaces
 * Amsterdam. Scanning ~170 rows is cheap enough to run on every keystroke; no
 * caller needs to debounce it.
 */
export function searchKnownPlaces(query: string, limit = 6): KnownPlace[] {
  const needle = query.trim().toLowerCase();
  if (!needle || limit < 1) return [];

  const prefixed: KnownPlace[] = [];
  const contained: KnownPlace[] = [];

  for (const place of KNOWN_PLACES) {
    // Prefix hits can never be outranked, so once there are `limit` of them
    // nothing later in the table can change the answer.
    if (prefixed.length >= limit) break;

    const at = place.name.toLowerCase().indexOf(needle);
    if (at === 0) prefixed.push(place);
    else if (at > 0) contained.push(place);
  }

  return [...prefixed, ...contained].slice(0, limit);
}
