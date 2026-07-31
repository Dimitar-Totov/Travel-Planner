/**
 * Mock trip-planning data layer.
 *
 * `getPlanForQuery` stands in for a future real planning + flights API. It
 * does light keyword/number parsing on the traveller's one-line request and
 * returns a fully-formed, deterministic `Plan` — no network calls, no
 * randomness, no external dependencies. `POST /api/plan` (and its `GET`
 * sibling) is the only caller; keep this file pure so it stays trivially
 * testable once a real backend replaces it.
 */
import type { ChecklistItem, Flights, Hotel, Plan, RoutePlan } from "./types";
import { italyPlan } from "./demo";

// ---------------------------------------------------------------------------
// Sentence parsing helpers
// ---------------------------------------------------------------------------

/** Matches an explicit trip length such as "5 days", "5-day", "5days". */
const DAYS_PATTERN = /\b(\d+)[\s-]*days?\b/i;

function parseDays(query: string): number | undefined {
  const explicit = query.match(DAYS_PATTERN);
  if (explicit) {
    const value = Number.parseInt(explicit[1], 10);
    if (Number.isFinite(value) && value > 0) return value;
  }
  if (/\bweekend\b/i.test(query)) return 3;
  if (/\bweeks?\b/i.test(query)) return 7;
  return undefined;
}

function normalizeAmount(raw: string): number | undefined {
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Matches "€1,000" / "$500" / "£750". */
const CURRENCY_SYMBOL_PATTERN = /[€$£]\s*([\d,]+(?:\.\d+)?)/;
/** Matches "1000 budget" / "800 euros". */
const CURRENCY_WORD_PATTERN = /([\d,]+(?:\.\d+)?)\s*(?:euros?|budget)/i;

function parseBudget(query: string): number | undefined {
  const symbolMatch = query.match(CURRENCY_SYMBOL_PATTERN);
  if (symbolMatch) {
    const amount = normalizeAmount(symbolMatch[1]);
    if (amount !== undefined) return amount;
  }
  const wordMatch = query.match(CURRENCY_WORD_PATTERN);
  if (wordMatch) {
    const amount = normalizeAmount(wordMatch[1]);
    if (amount !== undefined) return amount;
  }
  return undefined;
}

/** Rounds down to a tidy step so amounts don't end on odd numbers. */
function roundDownToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

/** Keeps spend ~2-5% under budget, rounded to a tidy number, never above it. */
function estimateSpent(budget: number): number {
  const target = budget * 0.965;
  const step = budget >= 500 ? 10 : budget >= 100 ? 5 : 1;
  const tidy = roundDownToStep(target, step);
  if (tidy > 0) return Math.min(tidy, budget);
  return Math.max(roundDownToStep(budget * 0.95, 1), 0);
}

function buildTitle(days: number, destination: string): string {
  return `Your ${days}-day ${destination} plan`;
}

// ---------------------------------------------------------------------------
// Destination routing
// ---------------------------------------------------------------------------

const ITALY_PATTERN = /\b(italy|rome|florence|venice|tuscany|amalfi)\b/i;
const PORTUGAL_PATTERN = /\b(lisbon|portugal|sintra|porto)\b/i;
const JAPAN_PATTERN = /\b(japan|tokyo|kyoto|osaka)\b/i;

// ---------------------------------------------------------------------------
// Curated plans
// ---------------------------------------------------------------------------

const portugalPlan: Plan = {
  query: "7 days in Portugal exploring Lisbon, Sintra and Porto",
  destination: "Portugal",
  title: "Your 7-day Portugal plan",
  days: 7,
  status: "ready",
  currency: "€",
  budget: 900,
  spent: 860,
  route: {
    summary: "Lisbon → Sintra → Porto",
    distanceKm: 370,
    stops: [
      { name: "Lisbon", label: "Days 1–3", lat: 38.7223, lng: -9.1393, overnight: true },
      { name: "Sintra", label: "Day 4", lat: 38.7979, lng: -9.3906, overnight: true },
      { name: "Porto", label: "Days 5–7", lat: 41.1579, lng: -8.6291, overnight: true },
    ],
  },
  flights: {
    roundTrip: true,
    refreshedText: "fares refreshed 6 min ago",
    outbound: {
      from: "London",
      to: "Lisbon LIS",
      duration: "2h 35m",
      stops: "direct",
      carrier: "TAP Air Portugal",
      price: 88,
    },
    inbound: { from: "Porto OPO", to: "London", price: 76 },
  },
  checklist: [
    { label: "Passport or EU ID card", done: true },
    { label: "Book Pena Palace tickets (Sintra)", done: true },
    { label: "Travel insurance (EU cover)", done: true },
    { label: "Type C / F plug adapter", done: false },
    { label: "Download offline city maps", done: false },
    { label: "Comfortable walking shoes", done: false },
  ],
  nights: 6,
  avgHotel: 85,
  hotels: [
    {
      name: "Casa Alfama",
      area: "Alfama, Lisbon",
      city: "Lisbon",
      rating: "9.0",
      stars: 4,
      price: 78,
      gradient: "linear-gradient(150deg,#e08a4f,#b5501f)",
    },
    {
      name: "Quinta da Serra",
      area: "Sintra Hills, Sintra",
      city: "Sintra",
      rating: "9.3",
      stars: 4,
      price: 95,
      gradient: "linear-gradient(150deg,#6fbf91,#2f8f5d)",
    },
    {
      name: "Ribeira Riverside Hotel",
      area: "Ribeira, Porto",
      city: "Porto",
      rating: "8.9",
      stars: 4,
      price: 82,
      gradient: "linear-gradient(150deg,#c97b8f,#7d3350)",
    },
  ],
};

const japanPlan: Plan = {
  query: "10 days in Japan covering Tokyo, Kyoto and Osaka",
  destination: "Japan",
  title: "Your 10-day Japan plan",
  days: 10,
  status: "ready",
  currency: "€",
  budget: 2200,
  spent: 2120,
  route: {
    summary: "Tokyo → Kyoto → Osaka",
    distanceKm: 510,
    stops: [
      { name: "Tokyo", label: "Days 1–4", lat: 35.6762, lng: 139.6503, overnight: true },
      { name: "Kyoto", label: "Days 5–7", lat: 35.0116, lng: 135.7681, overnight: true },
      { name: "Osaka", label: "Days 8–10", lat: 34.6937, lng: 135.5023, overnight: true },
    ],
  },
  flights: {
    roundTrip: true,
    refreshedText: "fares refreshed 8 min ago",
    outbound: {
      from: "London",
      to: "Tokyo HND",
      duration: "11h 50m",
      stops: "direct",
      carrier: "Japan Airlines",
      price: 620,
    },
    inbound: { from: "Osaka KIX", to: "London", price: 540 },
  },
  checklist: [
    { label: "Passport valid 6+ months", done: true },
    { label: "Book JR Rail Pass", done: true },
    { label: "Arrange pocket wifi / eSIM", done: true },
    { label: "Travel insurance", done: false },
    { label: "Download offline city maps", done: false },
    { label: "Comfortable walking shoes", done: false },
  ],
  nights: 9,
  avgHotel: 120,
  hotels: [
    {
      name: "Shinjuku Skyline Hotel",
      area: "Shinjuku, Tokyo",
      city: "Tokyo",
      rating: "9.0",
      stars: 4,
      price: 130,
      gradient: "linear-gradient(150deg,#7b6fbf,#3d2f92)",
    },
    {
      name: "Gion Machiya Inn",
      area: "Gion, Kyoto",
      city: "Kyoto",
      rating: "9.4",
      stars: 4,
      price: 120,
      gradient: "linear-gradient(150deg,#bf6f8f,#7d2f57)",
    },
    {
      name: "Dotonbori River Hotel",
      area: "Dotonbori, Osaka",
      city: "Osaka",
      rating: "8.9",
      stars: 4,
      price: 110,
      gradient: "linear-gradient(150deg,#bfa06f,#8f5a2f)",
    },
  ],
};

/** Clones a curated/demo plan, applying the caller's query + parsed overrides. */
function withOverrides(
  base: Plan,
  query: string,
  parsedDays: number | undefined,
  parsedBudget: number | undefined
): Plan {
  const days = parsedDays ?? base.days;
  const budget = parsedBudget ?? base.budget;
  // Only recompute spend when the traveller actually changed the budget, so the
  // curated demos keep their hand-tuned totals (e.g. Italy stays €980/€1,000).
  const spent =
    parsedBudget !== undefined && parsedBudget !== base.budget
      ? estimateSpent(budget)
      : base.spent;
  return {
    ...base,
    query,
    title: buildTitle(days, base.destination),
    days,
    budget,
    spent,
  };
}

// ---------------------------------------------------------------------------
// Generic fallback (unrecognised destination)
// ---------------------------------------------------------------------------

interface KnownCity {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

/**
 * Well-known cities we can plot precisely when no curated plan matches. Each
 * one doubles as the stand-in capital for its region, so a country-only query
 * ("10 days in Vietnam") still lands somewhere real.
 */
const KNOWN_CITIES: KnownCity[] = [
  { name: "Paris", region: "France", lat: 48.8566, lng: 2.3522 },
  { name: "London", region: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { name: "Madrid", region: "Spain", lat: 40.4168, lng: -3.7038 },
  { name: "Berlin", region: "Germany", lat: 52.52, lng: 13.405 },
  { name: "Amsterdam", region: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { name: "New York", region: "United States", lat: 40.7128, lng: -74.006 },
  { name: "Bangkok", region: "Thailand", lat: 13.7563, lng: 100.5018 },
  { name: "Dubai", region: "United Arab Emirates", lat: 25.2048, lng: 55.2708 },
  { name: "Athens", region: "Greece", lat: 37.9838, lng: 23.7275 },
  { name: "Prague", region: "Czechia", lat: 50.0755, lng: 14.4378 },
  { name: "Istanbul", region: "Turkey", lat: 41.0082, lng: 28.9784 },
  { name: "Marrakech", region: "Morocco", lat: 31.6295, lng: -7.9811 },
  { name: "Reykjavik", region: "Iceland", lat: 64.1466, lng: -21.9426 },
  { name: "Hanoi", region: "Vietnam", lat: 21.0278, lng: 105.8342 },
];

/** Fallback when no known city is mentioned in the query. */
const DEFAULT_CITY: KnownCity = { name: "Barcelona", region: "Spain", lat: 41.3874, lng: 2.1686 };

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesWord(query: string, word: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(word)}\\b`, "i").test(query);
}

/**
 * Picks the city to plan around. City names win over regions across the whole
 * list, so "5 days in Marrakech" and "5 days in Morocco" both resolve to
 * Marrakech while an explicit city never loses to another entry's country.
 */
function detectCity(query: string): KnownCity {
  for (const city of KNOWN_CITIES) {
    if (matchesWord(query, city.name)) return city;
  }
  for (const city of KNOWN_CITIES) {
    if (matchesWord(query, city.region)) return city;
  }
  return DEFAULT_CITY;
}

function buildGenericPlan(
  query: string,
  parsedDays: number | undefined,
  parsedBudget: number | undefined
): Plan {
  const days = parsedDays ?? 5;
  const budget = parsedBudget ?? 900;
  const spent = estimateSpent(budget);
  const city = detectCity(query);
  const nights = Math.max(days - 1, 1);

  const basePrice = Math.max(30, Math.round((budget * 0.3) / nights));
  const hotels: Hotel[] = [
    {
      name: `${city.name} Central Plaza`,
      area: `City Centre, ${city.name}`,
      city: city.name,
      rating: "8.7",
      stars: 4,
      price: Math.max(30, basePrice - 8),
      gradient: "linear-gradient(150deg,#6f8fbf,#2f4f92)",
    },
    {
      name: `Old Town ${city.name} Suites`,
      area: `Old Town, ${city.name}`,
      city: city.name,
      rating: "9.0",
      stars: 4,
      price: basePrice,
      gradient: "linear-gradient(150deg,#bf8f6f,#925f2f)",
    },
    {
      name: `${city.name} Riverside Inn`,
      area: `Riverside, ${city.name}`,
      city: city.name,
      rating: "8.5",
      stars: 3,
      price: basePrice + 10,
      gradient: "linear-gradient(150deg,#8fbf6f,#4f922f)",
    },
  ];
  const avgHotel = Math.round(hotels.reduce((sum, hotel) => sum + hotel.price, 0) / hotels.length);

  const route: RoutePlan = {
    summary: city.name,
    distanceKm: 0,
    stops: [
      {
        name: city.name,
        label: days === 1 ? "Day 1" : `Days 1–${days}`,
        lat: city.lat,
        lng: city.lng,
        overnight: true,
      },
    ],
  };

  const flights: Flights = {
    roundTrip: true,
    refreshedText: "fares refreshed 5 min ago",
    outbound: {
      from: "London",
      to: city.name,
      duration: "3h 15m",
      stops: "direct",
      carrier: "Skyline Air",
      price: Math.max(60, Math.round(budget * 0.12)),
    },
    inbound: { from: city.name, to: "London", price: Math.max(50, Math.round(budget * 0.1)) },
  };

  const checklist: ChecklistItem[] = [
    { label: "Passport valid 6+ months", done: true },
    { label: "Check visa requirements", done: true },
    { label: "Travel insurance", done: false },
    { label: "Download offline city maps", done: false },
    { label: "Comfortable walking shoes", done: false },
    { label: "Notify your bank of travel dates", done: false },
  ];

  return {
    query,
    destination: city.region,
    title: buildTitle(days, city.region),
    days,
    status: "ready",
    currency: "€",
    budget,
    spent,
    route,
    flights,
    checklist,
    hotels,
    nights,
    avgHotel,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Turns one sentence (e.g. "5 days in Italy with a €1,000 budget") into a
 * fully-formed `Plan`. Pure and deterministic — same input always produces
 * the same output.
 */
export function getPlanForQuery(query: string): Plan {
  const effectiveQuery = query.trim().length > 0 ? query : italyPlan.query;
  const parsedDays = parseDays(effectiveQuery);
  const parsedBudget = parseBudget(effectiveQuery);

  if (ITALY_PATTERN.test(effectiveQuery)) {
    return withOverrides(italyPlan, effectiveQuery, parsedDays, parsedBudget);
  }
  if (PORTUGAL_PATTERN.test(effectiveQuery)) {
    return withOverrides(portugalPlan, effectiveQuery, parsedDays, parsedBudget);
  }
  if (JAPAN_PATTERN.test(effectiveQuery)) {
    return withOverrides(japanPlan, effectiveQuery, parsedDays, parsedBudget);
  }
  return buildGenericPlan(effectiveQuery, parsedDays, parsedBudget);
}
