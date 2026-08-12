import type { Plan } from "./types";

/**
 * The canonical demo plan — the exact trip shown in the design doc's PlanBoard
 * and on the landing hero: "I have 5 days in Italy with a €1,000 budget".
 *
 * The mock backend (`src/lib/plans.ts`) returns this for Italy-shaped queries,
 * and the landing page imports it directly to render its static preview, so the
 * marketing page never has to round-trip its own API.
 */
export const italyPlan: Plan = {
  query: "I have 5 days in Italy with a €1,000 budget",
  destination: "Italy",
  title: "Your 5-day Italy plan",
  days: 5,
  status: "ready",
  currency: "€",
  budget: 1000,
  spent: 980,
  mapShape: "italy",
  route: {
    summary: "Rome → Florence → Venice",
    distanceKm: 512,
    stops: [
      {
        name: "Rome",
        label: "Days 1–2",
        lat: 41.9028,
        lng: 12.4964,
        overnight: true,
      },
      {
        name: "Florence",
        label: "Days 3–4",
        lat: 43.7696,
        lng: 11.2558,
        overnight: true,
      },
      {
        name: "Venice",
        label: "Day 5",
        lat: 45.4408,
        lng: 12.3155,
        overnight: true,
      },
    ],
  },
  flights: {
    roundTrip: true,
    refreshedText: "fares refreshed 4 min ago",
    outbound: {
      from: "London",
      to: "Rome FCO",
      duration: "2h 25m",
      stops: "direct",
      carrier: "Vueling",
      price: 96,
    },
    inbound: { from: "Venice VCE", to: "London", price: 74 },
  },
  checklist: [
    { label: "Passport valid 6+ months", done: true },
    { label: "Book Colosseum + Vatican tickets", done: true },
    { label: "Travel insurance (EU cover)", done: true },
    { label: "Type F / L plug adapter", done: false },
    { label: "Download offline city maps", done: false },
    { label: "Comfortable walking shoes", done: false },
  ],
  nights: 4,
  avgHotel: 89,
  hotels: [
    {
      name: "Casa Trastevere",
      area: "Trastevere, Rome",
      city: "Rome",
      rating: "9.1",
      stars: 4,
      price: 92,
      gradient: "linear-gradient(150deg,#c9a15a,#8f6a37)",
    },
    {
      name: "Palazzo Arno",
      area: "Oltrarno, Florence",
      city: "Florence",
      rating: "8.8",
      stars: 4,
      price: 84,
      gradient: "linear-gradient(150deg,#6f9fbf,#2f6d92)",
    },
    {
      name: "Ca' Lorenzo",
      area: "Dorsoduro, Venice",
      city: "Venice",
      rating: "9.0",
      stars: 4,
      price: 90,
      gradient: "linear-gradient(150deg,#7fb0ae,#2e7d78)",
    },
  ],
};
