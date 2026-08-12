/**
 * Hardcoded content for `/destinations` — the community guide feed.
 *
 * There is no backend behind this yet: the twelve guides below are static copy
 * ported from the design doc, and every filter/sort on the page runs over this
 * array in the browser. Thumbnails and avatars are CSS gradients rather than
 * photos, the same placeholder trick `Hotel.gradient` uses on the PlanBoard.
 */

export interface DestinationGuide {
  slug: string;
  title: string;
  blurb: string;
  author: string;
  /** CSS gradient standing in for the author's photo. */
  avatarGradient: string;
  likes: number;
  views: number;
  /** Trip length in days — drives the "Weekends" filter (days <= 4). */
  days: number;
  /** Rough total per person — drives the "Budget under €1k" filter. */
  approxCostEUR: number;
  /** Display string for the thumbnail pill, e.g. "7 days · ¥¥". */
  meta: string;
  /** Where the guide is set; used as the thumbnail's accessible description. */
  place: string;
  /** CSS gradient standing in for the cover photo. */
  thumbGradient: string;
  verified: boolean;
}

export const popularDestinations: string[] = [
  "Italy",
  "Japan",
  "Portugal",
  "New York City",
  "Iceland",
  "Thailand",
];

export const destinationGuides: DestinationGuide[] = [
  {
    slug: "kyoto-in-autumn-colour",
    title: "Kyoto in Autumn Colour",
    blurb:
      "A quest-like walking guide to every temple garden worth the early alarm, in peak maple season.",
    author: "Mika S.",
    avatarGradient: "linear-gradient(150deg,#c9705a,#8f3f37)",
    likes: 2777,
    views: 212000,
    days: 7,
    approxCostEUR: 1450,
    meta: "7 days · ¥¥",
    place: "Kyoto temple",
    thumbGradient: "linear-gradient(150deg,#c9705a,#8f3f37)",
    verified: true,
  },
  {
    slug: "paris-5-day-itinerary",
    title: "Paris 5-Day Itinerary",
    blurb:
      "I studied abroad here and have been back four times — this is the version I send friends.",
    author: "elisa",
    avatarGradient: "linear-gradient(150deg,#7fa9c9,#33628a)",
    likes: 753,
    views: 172000,
    days: 5,
    approxCostEUR: 1200,
    meta: "5 days · €€",
    place: "Paris skyline",
    thumbGradient: "linear-gradient(150deg,#7fa9c9,#33628a)",
    verified: true,
  },
  {
    slug: "puerto-rico-guide",
    title: "Puerto Rico Guide",
    blurb:
      "A collection of the best of the island since I moved here at the beginning of the year.",
    author: "Gillian Morris",
    avatarGradient: "linear-gradient(150deg,#79c2ae,#2c7f74)",
    likes: 210,
    views: 67600,
    days: 6,
    approxCostEUR: 950,
    meta: "6 days · $$",
    place: "San Juan coast",
    thumbGradient: "linear-gradient(150deg,#79c2ae,#2c7f74)",
    verified: true,
  },
  {
    slug: "chicago-4-day-guide",
    title: "Chicago 4-Day Guide",
    blurb:
      "A city unlike any other — known for its resilient spirit, its lake, and its architecture.",
    author: "Andrea Yáñez",
    avatarGradient: "linear-gradient(150deg,#8b93a8,#3d465f)",
    likes: 142,
    views: 20600,
    days: 4,
    approxCostEUR: 780,
    meta: "4 days · $$",
    place: "Chicago downtown",
    thumbGradient: "linear-gradient(150deg,#8b93a8,#3d465f)",
    verified: true,
  },
  {
    slug: "costa-del-sol-7-nights",
    title: "Costa Del Sol — 7 Nights",
    blurb:
      "Beach mornings, white-village afternoons, and where to eat when the tourist menus start blurring.",
    author: "Iúri Tavares",
    avatarGradient: "linear-gradient(150deg,#e0b46a,#b07a2e)",
    likes: 318,
    views: 41200,
    days: 7,
    approxCostEUR: 690,
    meta: "7 days · €",
    place: "Málaga marina",
    thumbGradient: "linear-gradient(150deg,#e0b46a,#b07a2e)",
    verified: false,
  },
  {
    slug: "northern-ireland-6-day",
    title: "Northern Ireland 6-Day",
    blurb:
      "Causeway Coast road trip, Sept 2025 — every stop, every layby, and the pub that saved the trip.",
    author: "Kate Higman",
    avatarGradient: "linear-gradient(150deg,#8fbf9a,#38714f)",
    likes: 8,
    views: 573,
    days: 6,
    approxCostEUR: 890,
    meta: "6 days · £",
    place: "Giant’s Causeway",
    thumbGradient: "linear-gradient(150deg,#8fbf9a,#38714f)",
    verified: false,
  },
  {
    slug: "milan-in-2-5-days",
    title: "Milan in 2.5 Days",
    blurb:
      "A compact itinerary built around the Duomo, the Navigli, and one very good aperitivo route.",
    author: "Casa Georgia",
    avatarGradient: "linear-gradient(150deg,#b98fb0,#6a3f74)",
    likes: 7,
    views: 1367,
    days: 3,
    approxCostEUR: 560,
    meta: "3 days · €€",
    place: "Milan Duomo",
    thumbGradient: "linear-gradient(150deg,#b98fb0,#6a3f74)",
    verified: false,
  },
  {
    slug: "the-ultimate-italy-guide",
    title: "The Ultimate Italy Guide",
    blurb:
      "Italy always feels like home. The cities are full of life, beauty, and far too much good bread.",
    author: "Anurag Sahu",
    avatarGradient: "linear-gradient(150deg,#6fa8c4,#276a8c)",
    likes: 946,
    views: 88400,
    days: 10,
    approxCostEUR: 1980,
    meta: "10 days · €€",
    place: "Venice canal",
    thumbGradient: "linear-gradient(150deg,#6fa8c4,#276a8c)",
    verified: true,
  },
  {
    slug: "switzerland-by-rail",
    title: "Switzerland by Rail",
    blurb:
      "Nine days, one rail pass, and the lake-and-peak stops that justify the ticket price.",
    author: "Lena Bühler",
    avatarGradient: "linear-gradient(150deg,#9fc4d8,#3f6f8f)",
    likes: 1204,
    views: 96100,
    days: 9,
    approxCostEUR: 2450,
    meta: "9 days · CHF",
    place: "Lake Brienz",
    thumbGradient: "linear-gradient(150deg,#9fc4d8,#3f6f8f)",
    verified: true,
  },
  {
    slug: "tokyo-after-dark",
    title: "Tokyo After Dark",
    blurb:
      "Yokocho alleys, listening bars, and the late-night noodle map I wish I’d had on night one.",
    author: "Japeating",
    avatarGradient: "linear-gradient(150deg,#c76b7a,#6d2c46)",
    likes: 431,
    views: 52900,
    days: 4,
    approxCostEUR: 980,
    meta: "4 nights · ¥¥",
    place: "Tokyo alley",
    thumbGradient: "linear-gradient(150deg,#c76b7a,#6d2c46)",
    verified: false,
  },
  {
    slug: "reno-parks-playgrounds",
    title: "Reno Parks & Playgrounds",
    blurb:
      "Family-tested: shade, parking, and bathrooms for every park worth the drive.",
    author: "Marcus Hale",
    avatarGradient: "linear-gradient(150deg,#e6a86a,#a85f31)",
    likes: 76,
    views: 9180,
    days: 3,
    approxCostEUR: 420,
    meta: "3 days · $",
    place: "Reno balloon race",
    thumbGradient: "linear-gradient(150deg,#e6a86a,#a85f31)",
    verified: false,
  },
  {
    slug: "thailand-travel-guide",
    title: "Thailand Travel Guide",
    blurb:
      "Bangkok temples to island ferries — a two-week loop that never feels rushed.",
    author: "Clever Lives",
    avatarGradient: "linear-gradient(150deg,#e0b155,#a8632a)",
    likes: 2140,
    views: 198000,
    days: 14,
    approxCostEUR: 890,
    meta: "14 days · ฿",
    place: "Thai temple",
    thumbGradient: "linear-gradient(150deg,#e0b155,#a8632a)",
    verified: true,
  },
];

/** Likes read as exact counts: 2777 → "2,777". */
export function formatLikes(n: number): string {
  return n.toLocaleString();
}

/** Views are abbreviated past a thousand: 212000 → "212k", 20600 → "20.6k". */
export function formatViews(n: number): string {
  if (n < 1000) return n.toLocaleString();
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
