/**
 * Seed source data for the `guides` collection — **no longer what
 * `/guides` renders.** The feed now reads published `Guide` documents
 * from MongoDB via `src/services/guides.ts` (`listPublishedGuides`); this
 * array is only `scripts/seed-guides.ts`'s input, run once to populate the
 * database with the same guides that used to be hardcoded here.
 *
 * Kept (not deleted) because it's still that seed's source of truth, and
 * because `DestinationGuide` — the view shape — is defined here and remains
 * live: `src/services/guides.ts` maps every Mongo document onto exactly this
 * type, so every component below the feed (`GuideCard`, `GuideAuthorBar`, …)
 * is unchanged.
 *
 * Cover photos are real Unsplash images (`coverImage`, fixed photo IDs — no
 * API key needed); avatars are still CSS gradients in the seeded data, the
 * same placeholder trick `Hotel.gradient` uses on the PlanBoard — the live
 * path now derives a gradient per author instead (`deriveAvatarGradient` in
 * `src/services/guides.ts`).
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
  /**
   * Rough total per person — drives the "Budget under €1k" filter.
   *
   * Optional: every guide in this module has one, but a guide read out of
   * Mongo may not (`useCreateGuideForm` collects no budget), and a guide with
   * no disclosed cost is excluded from the budget filter rather than assumed
   * cheap. See `services/guides.ts`.
   */
  approxCostEUR?: number;
  /** Display string for the thumbnail pill, e.g. "7 days · ¥¥". */
  meta: string;
  /** Where the guide is set; used as the thumbnail's accessible description. */
  place: string;
  /** Unsplash photo URL for the cover thumbnail. */
  coverImage: string;
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
    coverImage:
      "https://images.unsplash.com/photo-1558870832-c8db4b5b47d1?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1565066021936-08655d8ec3ab?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1553775556-79c5b0914909?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1595538853083-dc3160ca6881?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1567760855784-589f09ed5dc6?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1558271736-cd043ef2e855?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1612215864092-355d4b25083f?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1573455494060-c5595004fb6c?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1631462608214-e23805290d3b?q=80&w=800&auto=format&fit=crop",
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
    coverImage:
      "https://images.unsplash.com/photo-1562602833-0f4ab2fc46e3?q=80&w=800&auto=format&fit=crop",
    verified: true,
  },
  {
    slug: "iceland-ring-road-in-winter",
    title: "Iceland Ring Road in Winter",
    blurb:
      "Ice caves, the northern lights, and how to keep a rental car alive on Route 1 in February.",
    author: "Sölvi T.",
    avatarGradient: "linear-gradient(150deg,#8fb8d8,#2e5a82)",
    likes: 1638,
    views: 143000,
    days: 8,
    approxCostEUR: 2180,
    meta: "8 days · kr",
    place: "Icelandic ice cave",
    coverImage:
      "https://images.unsplash.com/photo-1504829857797-ddff29c27927?q=80&w=800&auto=format&fit=crop",
    verified: true,
  },
  {
    slug: "new-york-city-long-weekend",
    title: "New York City Long Weekend",
    blurb:
      "Four days, no car, and the subway routes that make Manhattan and Brooklyn feel like one trip.",
    author: "Priya N.",
    avatarGradient: "linear-gradient(150deg,#a89bc9,#4f3f7a)",
    likes: 894,
    views: 121000,
    days: 4,
    approxCostEUR: 1380,
    meta: "4 days · $$",
    place: "New York skyline",
    coverImage:
      "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=800&auto=format&fit=crop",
    verified: true,
  },
  {
    slug: "lisbon-on-a-shoestring",
    title: "Lisbon on a Shoestring",
    blurb:
      "Miradouros, pastel de nata crawls, and how I did five days here for less than one night in London.",
    author: "Tomás R.",
    avatarGradient: "linear-gradient(150deg,#e0a866,#a85c2e)",
    likes: 512,
    views: 61300,
    days: 5,
    approxCostEUR: 610,
    meta: "5 days · €",
    place: "Lisbon tram",
    coverImage:
      "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?q=80&w=800&auto=format&fit=crop",
    verified: false,
  },
  {
    slug: "cape-town-10-days",
    title: "Cape Town — 10 Days",
    blurb:
      "Table Mountain at sunrise, the Cape wine lands, and a coastal drive I'd redo tomorrow.",
    author: "Naledi M.",
    avatarGradient: "linear-gradient(150deg,#7fb0a0,#2e6f5a)",
    likes: 367,
    views: 44700,
    days: 10,
    approxCostEUR: 1620,
    meta: "10 days · R",
    place: "Table Mountain",
    coverImage:
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?q=80&w=800&auto=format&fit=crop",
    verified: true,
  },
  {
    slug: "seoul-weekend-eats",
    title: "Seoul Weekend Eats",
    blurb:
      "A three-day food crawl through Myeongdong, Hongdae, and the market stall that ruined all other kimchi.",
    author: "Jiwoo K.",
    avatarGradient: "linear-gradient(150deg,#c98fae,#7a3f5e)",
    likes: 289,
    views: 33900,
    days: 3,
    approxCostEUR: 540,
    meta: "3 days · ₩₩",
    place: "Seoul night market",
    coverImage:
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=80&w=800&auto=format&fit=crop",
    verified: false,
  },
  {
    slug: "peru-highlands-and-machu-picchu",
    title: "Peru Highlands & Machu Picchu",
    blurb:
      "Cusco altitude tips, the Sacred Valley at your own pace, and booking the trek months out.",
    author: "Diego F.",
    avatarGradient: "linear-gradient(150deg,#c9a06f,#8a5a2e)",
    likes: 1029,
    views: 87200,
    days: 9,
    approxCostEUR: 1740,
    meta: "9 days · S/",
    place: "Machu Picchu ruins",
    coverImage:
      "https://images.unsplash.com/photo-1526392060635-9d6019884377?q=80&w=800&auto=format&fit=crop",
    verified: true,
  },
  {
    slug: "amsterdam-by-bike",
    title: "Amsterdam by Bike",
    blurb:
      "Canal routes, day trips to Haarlem and Zaanse Schans, and where to actually rent a bike that fits.",
    author: "Fenna de V.",
    avatarGradient: "linear-gradient(150deg,#e0895f,#a8422e)",
    likes: 63,
    views: 8940,
    days: 3,
    approxCostEUR: 720,
    meta: "3 days · €€",
    place: "Amsterdam canal",
    coverImage:
      "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=800&auto=format&fit=crop",
    verified: false,
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
