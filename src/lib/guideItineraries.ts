/**
 * Seed source data for the `guides` collection — **no longer what
 * `/destinations/guide/[guideId]/details` renders.** The detail route now
 * reads a published `Guide` document from MongoDB via
 * `src/services/guides.ts` (`getPublishedGuideDetail`); this module is only
 * `scripts/seed-guides.ts`'s input for the itinerary half of each seeded
 * guide (`destinationGuides.ts` holds the feed-card half).
 *
 * Still live, and not seed-only: `GuideItinerary` — the view shape — plus
 * `heroImageFor` and `countStops` are defined here and are exactly what
 * `src/services/guides.ts` maps a Mongo document onto / what the detail page
 * still calls, so `ItineraryDetailView` and everything under it is
 * unchanged. `getGuideItinerary`/`getGuideDetail` (the hardcoded-array
 * lookups) and the `guideItineraries` record itself are dead as render-path
 * code now — nothing outside the seed script calls them — but kept as the
 * seed's source and because deleting them wasn't asked for.
 *
 * Stop coordinates are real: they are what the map plots, so a wrong pair puts a
 * pin in the sea. Keep them accurate when adding stops.
 *
 * Per-stop photos now exist for real (`IGuideStop.photoUrl`,
 * `src/models/Guide.ts`) and are wired up on the live detail page
 * (`src/services/guides.ts`'s `toStopImages`) — but every stop below has
 * none, so a guide seeded from this file still renders the branded
 * placeholder for each stop, same as before. The only real photograph a
 * seeded guide has is its cover, reused as the hero via `heroImageFor`.
 */

import type { DestinationGuide } from "./destinationGuides";
import { destinationGuides } from "./destinationGuides";

// The day/stop shape moved to `./itinerary` once `/plan` started producing it
// too — see that file. Re-exported here so the many existing
// `from "@/lib/guideItineraries"` imports don't have to change.
export type {
  TransferMode,
  StopTransfer,
  GuideStop,
  GuideDay,
} from "./itinerary";

import type { GuideDay } from "./itinerary";

export interface GuideItinerary {
  /** Matches a `DestinationGuide.slug`. */
  slug: string;
  /** Hero headline, split so the tail can render in the serif italic accent. */
  heroTitle: string;
  heroAccent: string;
  /** Publication date shown next to the author, pre-formatted. */
  publishedAt: string;
  /** Pills over the hero photo, after the "Verified guide" badge. */
  tags: string[];
  /** The author's opening paragraph. */
  intro: string;
  /** "Best time" stat in the header strip, e.g. "May". */
  bestTime: string;
  /** Currency symbol for the budget stat and price levels, e.g. "€". */
  currency: string;
  /** Bulleted advice above the first day. */
  generalTips: string[];
  days: GuideDay[];
}

/**
 * Requests a bigger version of the guide's cover photo for the full-bleed
 * hero, where the feed thumbnail's `w=800` would look soft blown up.
 *
 * This only actually does anything for an **Unsplash-hosted cover** — the
 * seeded guides, whose URL encodes its size as a `w=800` query parameter
 * (`?q=80&w=800&auto=format&fit=crop`) that this bumps to `w=1600`. A guide
 * published through `/create-guide` has an **R2-hosted** cover instead
 * (`r2PublicUrl`, `src/lib/storage/r2.ts`), served with **no query string at
 * all** — `next.config.ts` locks that `remotePattern` to `search: ""` — so
 * there is no `"w=800"` substring to find, `.replace` is a silent no-op, and
 * the original URL comes back unchanged. Confirmed, not assumed: that's the
 * correct behaviour for that host, not a bug this function is hiding — an R2
 * cover is the author's own upload at whatever resolution they provided,
 * not a server-resizable derivative the way an Unsplash URL is.
 */
export function heroImageFor(guide: DestinationGuide): string {
  return guide.coverImage.replace("w=800", "w=1600");
}

/** Total stops across every day — the "Stops" stat in the header strip. */
export function countStops(itinerary: GuideItinerary): number {
  return itinerary.days.reduce((total, day) => total + day.stops.length, 0);
}

export function getGuideItinerary(slug: string): GuideItinerary | undefined {
  return guideItineraries[slug];
}

/** A guide plus its itinerary, or `undefined` if the slug is unknown. */
export function getGuideDetail(slug: string):
  | {
      guide: DestinationGuide;
      itinerary: GuideItinerary;
    }
  | undefined {
  const guide = destinationGuides.find((g) => g.slug === slug);
  const itinerary = guideItineraries[slug];
  if (!guide || !itinerary) return undefined;
  return { guide, itinerary };
}

export const guideItineraries: Record<string, GuideItinerary> = {
  "paris-5-day-itinerary": {
    slug: "paris-5-day-itinerary",
    heroTitle: "Paris 5-Day Tourist Itinerary",
    heroAccent: "& recommendations",
    publishedAt: "May 12, 2026",
    tags: ["5-day itinerary", "Paris guide", "€€ mid-range"],
    intro:
      "I studied abroad in Paris, and I've been back six times since — this is the version of the city I send to friends. Everything below is walkable unless I've said otherwise, and the day order is the one I'd actually repeat.",
    bestTime: "May",
    currency: "€",
    generalTips: [
      "With an EU ID and if you're 18–26, most national museums are free — bring it even if you think you won't need it.",
      "If you'd rather not walk everything, the 5-day pass is €35.70; a weekly Navigo from any métro window is €21.25. Neither covers the RER airport run (about €10 one way).",
      "Stay in Le Marais (Line 1 – Saint-Paul) for narrow streets, bakeries and a park — you'll be minutes from Notre Dame, Berthillon and Shakespeare & Co. Saint-Germain-des-Prés is the pricier, more classic alternative.",
      "Shopping days are easiest around Opéra — you land between the department stores and Rue Saint-Honoré.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Notre Dame and the Eiffel Tower",
        stops: [
          {
            name: "Notre Dame",
            lat: 48.85296,
            lng: 2.34986,
            tags: ["Cathedral", "Free entry"],
            notes: [
              "The line looks brutal and moves fast — 20 minutes at worst.",
              "Reserve a free slot on the app the night before and you skip it entirely.",
            ],
            about:
              "The reopened cathedral on the Île de la Cité. The nave is startlingly bright now the stone has been cleaned — worth going in even if you've been before the fire.",
            address: "6 Parvis Notre-Dame, 75004 Paris",
          },
          {
            name: "Sainte-Chapelle",
            lat: 48.8554,
            lng: 2.345,
            tags: ["Chapel", "Stained glass"],
            notes: [
              "Go upstairs immediately — the ground floor is not the point.",
              "Late afternoon is when the west windows light up.",
            ],
            about:
              "Fifteen windows of 13th-century glass wrapping a single room. Security is airport-style and shared with the courthouse, so leave time.",
            address: "10 Bd du Palais, 75001 Paris",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "6 min", distance: "0.3 mi" },
          },
          {
            name: "Shakespeare & Company",
            lat: 48.85252,
            lng: 2.34697,
            tags: ["Book store"],
            notes: [
              "You can stay overnight upstairs if you volunteer.",
              "Request it well in advance, online or by phone — walk-ins don't work.",
            ],
            about:
              "The English-language bookshop opposite Notre Dame. The café next door does a decent flat white and has the only quiet seats on the block.",
            address: "37 Rue de la Bûcherie, 75005 Paris",
            transfer: { mode: "walk", duration: "5 min", distance: "0.28 mi" },
          },
          {
            name: "Berthillon Glacier",
            lat: 48.85167,
            lng: 2.35682,
            tags: ["Ice cream shop", "Tea house"],
            notes: [
              "The full flavour range is only at the shop itself — cafés across Le Marais and Île Saint-Louis resell the ice cream with a fraction of the choice.",
            ],
            about:
              "On Île Saint-Louis since 1954. Closed Mondays and Tuesdays, and for most of August.",
            address: "29-31 Rue Saint-Louis en l'Île, 75004 Paris",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "9 min", distance: "0.46 mi" },
          },
          {
            name: "L'As du Fallafel",
            lat: 48.85742,
            lng: 2.35921,
            tags: ["Falafel restaurant", "Kosher"],
            notes: [
              "Takeaway is noticeably cheaper than sitting in.",
              "Get the falafel. Not the shawarma — the falafel.",
            ],
            about:
              "Rue des Rosiers institution. Closed Friday evening and Saturday; the queue on Sunday is the price of admission.",
            address: "34 Rue des Rosiers, 75004 Paris",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "11 min", distance: "0.56 mi" },
          },
          {
            name: "Trocadéro",
            lat: 48.86194,
            lng: 2.28951,
            tags: ["Town square", "Viewpoint"],
            notes: [
              "The staircases are where everyone gets the Eiffel Tower photo.",
              "Go early — before about 8am you can have the whole esplanade to yourself.",
            ],
            about:
              "In the 16th arrondissement, across the Seine from the tower — the one spot that gives you an unobstructed view of the whole Eiffel Tower, framed by the Palais de Chaillot.",
            address: "75116 Paris, France",
            highlight: true,
            transfer: { mode: "metro", duration: "16 min", distance: "4 mi" },
          },
          {
            name: "Eiffel Tower",
            lat: 48.85837,
            lng: 2.29448,
            tags: ["Landmark", "Viewpoint"],
            notes: [
              "Book the summit online weeks ahead; stairs to the second floor never sell out and cost half as much.",
              "It sparkles for five minutes on every hour after dark.",
            ],
            about:
              "Walk down through the Jardins du Trocadéro and across the Pont d'Iéna — it's the approach the tower was designed for.",
            address: "Champ de Mars, 75007 Paris",
            priceLevel: 3,
            transfer: { mode: "walk", duration: "12 min", distance: "0.62 mi" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Louvre, Tuileries and Saint-Germain",
        stops: [
          {
            name: "Musée du Louvre",
            lat: 48.86061,
            lng: 2.33764,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Enter via the Porte des Lions or the Carrousel mall, never the pyramid.",
              "Three hours is a real visit; six is a forced march. Pick two wings.",
            ],
            about:
              "Closed Tuesdays. Wednesday and Friday it stays open to 9pm, which is far and away the calmest way to see it.",
            address: "Rue de Rivoli, 75001 Paris",
            priceLevel: 2,
          },
          {
            name: "Jardin des Tuileries",
            lat: 48.8635,
            lng: 2.3275,
            tags: ["Garden", "Free entry"],
            notes: [
              "The green chairs by the round ponds are free and the best lunch spot in the 1st.",
            ],
            about:
              "Le Nôtre's garden running from the Louvre to Place de la Concorde. A funfair takes over the north side each summer.",
            address: "75001 Paris, France",
            transfer: { mode: "walk", duration: "7 min", distance: "0.35 mi" },
          },
          {
            name: "Musée de l'Orangerie",
            lat: 48.8638,
            lng: 2.3226,
            tags: ["Museum", "Monet"],
            notes: [
              "Two oval rooms of Water Lilies, and it takes 45 minutes — the best value museum in the city.",
            ],
            about:
              "At the Concorde end of the Tuileries. Same ticket family as Orsay if you buy the combined pass.",
            address: "Jardin des Tuileries, 75001 Paris",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "4 min", distance: "0.2 mi" },
          },
          {
            name: "Musée d'Orsay",
            lat: 48.86,
            lng: 2.3266,
            tags: ["Museum", "Impressionists"],
            notes: [
              "Start on the top floor and work down — the Impressionist gallery empties out latest in the day.",
              "The clock-face window is on floor five, behind the café.",
            ],
            about:
              "A converted Beaux-Arts railway station on the Left Bank. Closed Mondays; open late Thursdays.",
            address: "Esplanade Valéry Giscard d'Estaing, 75007 Paris",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "walk", duration: "10 min", distance: "0.5 mi" },
          },
          {
            name: "Saint-Germain-des-Prés",
            lat: 48.8539,
            lng: 2.3338,
            tags: ["Neighbourhood", "Cafés"],
            notes: [
              "Skip Les Deux Magots unless you want the photograph; the café one street back costs half as much.",
            ],
            about:
              "The oldest church in Paris and the streets of galleries and cafés around it.",
            address: "3 Pl. Saint-Germain des Prés, 75006 Paris",
            transfer: { mode: "walk", duration: "9 min", distance: "0.44 mi" },
          },
          {
            name: "Jardin du Luxembourg",
            lat: 48.8462,
            lng: 2.3372,
            tags: ["Garden", "Free entry"],
            notes: [
              "Rent a toy sailboat at the big pond — three euros, and it is the correct way to end the day.",
            ],
            about:
              "The Senate's garden, and the one Parisians actually sit in. Gates close at dusk, which is earlier than you think in autumn.",
            address: "75006 Paris, France",
            transfer: { mode: "walk", duration: "8 min", distance: "0.4 mi" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Montmartre and the north",
        stops: [
          {
            name: "Sacré-Cœur",
            lat: 48.8867,
            lng: 2.3431,
            tags: ["Basilica", "Free entry", "Viewpoint"],
            notes: [
              "Take the funicular up (a métro ticket covers it) and walk down.",
              "Say no firmly to anyone who tries to tie a bracelet on your wrist at the base of the steps.",
            ],
            about:
              "The white basilica on the butte. The dome climb is a separate ticket and a tight spiral, but it beats the Arc de Triomphe for the view.",
            address: "35 Rue du Chevalier de la Barre, 75018 Paris",
          },
          {
            name: "Place du Tertre",
            lat: 48.8865,
            lng: 2.3407,
            tags: ["Square", "Artists"],
            notes: [
              "Agree the price before anyone starts drawing you.",
              "One street off the square in any direction and Montmartre becomes a real neighbourhood again.",
            ],
            about:
              "The portrait-painters' square behind Sacré-Cœur, and the most touristed hundred metres in Paris.",
            address: "75018 Paris, France",
            transfer: { mode: "walk", duration: "3 min", distance: "0.13 mi" },
          },
          {
            name: "Moulin Rouge",
            lat: 48.8841,
            lng: 2.3322,
            tags: ["Cabaret", "Landmark"],
            notes: [
              "Worth a photo; the show is a real cost and dinner packages are worse value than the drinks-only ticket.",
            ],
            about:
              "Down the hill in Pigalle. The walk down Rue Lepic from Montmartre passes the bakery that supplies half the arrondissement.",
            address: "82 Bd de Clichy, 75018 Paris",
            priceLevel: 4,
            transfer: { mode: "walk", duration: "13 min", distance: "0.68 mi" },
          },
          {
            name: "Canal Saint-Martin",
            lat: 48.8709,
            lng: 2.3663,
            tags: ["Canal", "Bars", "Sunset"],
            notes: [
              "Buy a bottle and sit on the iron footbridges with everyone else — that is the evening.",
              "Sundays the quays close to cars.",
            ],
            about:
              "Tree-lined locks running through the 10th. The stretch between Rue des Récollets and Rue du Faubourg du Temple has the bars worth stopping in.",
            address: "75010 Paris, France",
            highlight: true,
            transfer: { mode: "metro", duration: "18 min", distance: "2.4 mi" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "Le Marais and the east",
        stops: [
          {
            name: "Marché des Enfants Rouges",
            lat: 48.8629,
            lng: 2.3624,
            tags: ["Market", "Lunch"],
            notes: [
              "Oldest covered market in Paris. Get there before 12.30 or you'll eat standing up.",
              "Closed Mondays.",
            ],
            about:
              "A dozen kitchens under one roof in the upper Marais — Moroccan, Japanese, Italian, and one very good galette counter.",
            address: "39 Rue de Bretagne, 75003 Paris",
            priceLevel: 2,
          },
          {
            name: "Musée Picasso",
            lat: 48.8598,
            lng: 2.3626,
            tags: ["Museum"],
            notes: [
              "The building — a 17th-century hôtel particulier — is half the reason to go.",
            ],
            about:
              "Closed Mondays. Free on the first Sunday of the month, which also means it is full on the first Sunday of the month.",
            address: "5 Rue de Thorigny, 75003 Paris",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "5 min", distance: "0.25 mi" },
          },
          {
            name: "Place des Vosges",
            lat: 48.8556,
            lng: 2.3655,
            tags: ["Square", "Free entry"],
            notes: [
              "Victor Hugo's house is in the corner and it's free.",
              "Sit on the grass in the middle — one of the few Paris lawns you're allowed on.",
            ],
            about:
              "The oldest planned square in the city, arcaded on all four sides. Enter through the arch on Rue de Birague for the best first view.",
            address: "75004 Paris, France",
            highlight: true,
            transfer: { mode: "walk", duration: "7 min", distance: "0.36 mi" },
          },
          {
            name: "Père Lachaise",
            lat: 48.8614,
            lng: 2.3933,
            tags: ["Cemetery", "Free entry"],
            notes: [
              "Take a paper map at the gate — phone GPS is useless under the plane trees.",
              "Enter at Porte Gambetta and walk downhill; the reverse is a climb.",
            ],
            about:
              "Chopin, Wilde, Piaf and Morrison, across 44 hectares of cobbled hillside. Closes at 6pm, earlier in winter.",
            address: "16 Rue du Repos, 75020 Paris",
            transfer: { mode: "metro", duration: "14 min", distance: "1.8 mi" },
          },
        ],
      },
      {
        title: "Day 5",
        summary: "Versailles, then shopping around Opéra",
        stops: [
          {
            name: "Château de Versailles",
            lat: 48.8049,
            lng: 2.1204,
            tags: ["Palace", "Day trip", "Book ahead"],
            notes: [
              "RER C to Versailles Château–Rive Gauche, about 45 minutes from the centre.",
              "Timed entry is compulsory. Take the first slot of the day and do the Hall of Mirrors before the tour groups land.",
            ],
            about:
              "Give it the whole morning: the state apartments, then the gardens and the Trianon estate, which most day-trippers skip entirely. The musical fountain shows run weekends in summer.",
            address: "Place d'Armes, 78000 Versailles",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Opéra Garnier",
            lat: 48.872,
            lng: 2.3316,
            tags: ["Opera house", "Architecture"],
            notes: [
              "You can tour it without seeing a performance — the grand staircase and the Chagall ceiling are the point.",
            ],
            about:
              "Back in the centre, and the anchor for the afternoon: the department stores are both within three minutes' walk.",
            address: "Place de l'Opéra, 75009 Paris",
            priceLevel: 2,
            transfer: { mode: "train", duration: "48 min", distance: "14 mi" },
          },
          {
            name: "Galeries Lafayette",
            lat: 48.8738,
            lng: 2.332,
            tags: ["Department store", "Viewpoint"],
            notes: [
              "The rooftop terrace is free and has a better Paris view than most paid ones.",
              "Non-EU residents can claim VAT back on the 1st floor — bring your passport.",
            ],
            about:
              "The stained-glass dome over the main hall is worth the detour even if you buy nothing.",
            address: "40 Bd Haussmann, 75009 Paris",
            priceLevel: 3,
            transfer: { mode: "walk", duration: "3 min", distance: "0.15 mi" },
          },
        ],
      },
    ],
  },

  "kyoto-in-autumn-colour": {
    slug: "kyoto-in-autumn-colour",
    heroTitle: "Kyoto in Autumn Colour",
    heroAccent: "a walking guide",
    publishedAt: "November 3, 2025",
    tags: ["7-day itinerary", "Kyoto guide", "Momiji season"],
    intro:
      "Seven Novembers here and I still plan the same way: temples at opening, markets at midday, illuminations after dark. Peak maple is a moving target — usually the third week of November — so treat the day order as fixed and the gardens as swappable.",
    bestTime: "Late Nov",
    currency: "¥",
    generalTips: [
      "Buses beat trains inside Kyoto, but they are slow in autumn. Anything before 9am, walk or cycle instead — you will beat the 100 bus to Kiyomizu every time.",
      "An ICOCA card covers buses, subway, JR and most convenience stores. Buy it at Kyoto Station on arrival and stop thinking about fares.",
      "Temple gates open at 6 or 8am and the difference between 8:05 and 9:30 at Fushimi Inari is the difference between a shrine and a queue.",
      "Autumn illuminations (Kiyomizu, Eikan-dō, Kōdai-ji) run mid-November to early December and need a separate evening ticket. They sell at the gate, not online.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Southern Higashiyama, gate to gate",
        stops: [
          {
            name: "Kiyomizu-dera",
            lat: 34.9949,
            lng: 135.785,
            tags: ["Temple", "Viewpoint", "Illumination"],
            notes: [
              "Opens at 6am. Be on the veranda by 6:30 and you will share it with a dozen people.",
              "Come back after dark in November for the light-up — it is a different building.",
            ],
            about:
              "The wooden stage over the hillside, rebuilt without a single nail. The approach up Kiyomizu-zaka is all souvenir shops; the temple earns it.",
            address: "1-294 Kiyomizu, Higashiyama Ward, Kyoto",
            priceLevel: 1,
          },
          {
            name: "Sannenzaka & Ninenzaka",
            lat: 34.9974,
            lng: 135.7808,
            tags: ["Historic street", "Free entry"],
            notes: [
              "Stone-paved lanes downhill from Kiyomizu. Superstition says falling here brings three years' bad luck — the steps are genuinely slick.",
            ],
            about:
              "Preserved Edo-period streets of tea houses and machiya. The Starbucks halfway down occupies a townhouse with tatami seating upstairs.",
            address: "Higashiyama Ward, Kyoto",
            transfer: { mode: "walk", duration: "8 min", distance: "0.4 km" },
          },
          {
            name: "Kōdai-ji",
            lat: 35.0,
            lng: 135.7803,
            tags: ["Temple", "Garden", "Illumination"],
            notes: [
              "The bamboo grove behind the main hall is a tenth the size of Arashiyama's and a hundredth as busy.",
            ],
            about:
              "Founded by Nene, Hideyoshi's widow. The autumn night illumination projects onto the garden pond and is the best of the city's light-ups.",
            address: "526 Shimokawaracho, Higashiyama Ward, Kyoto",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "6 min", distance: "0.5 km" },
          },
          {
            name: "Gion Shirakawa",
            lat: 35.0053,
            lng: 135.7752,
            tags: ["Historic district", "Evening"],
            notes: [
              "The canal-side stretch is far prettier than Hanamikoji and has no photography ban.",
              "Do not chase geiko for photos. The private lanes are signposted and fines are real.",
            ],
            about:
              "Willows over a narrow canal, wooden ochaya on both banks. Best in the hour after sunset when the lanterns come on.",
            address: "Gion, Higashiyama Ward, Kyoto",
            highlight: true,
            transfer: { mode: "walk", duration: "14 min", distance: "1.1 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Fushimi Inari before dawn, then Tōfuku-ji",
        stops: [
          {
            name: "Fushimi Inari Taisha",
            lat: 34.9671,
            lng: 135.7727,
            tags: ["Shrine", "Free entry", "Open 24h"],
            notes: [
              "Open all night and never closed. Arrive at 6:30am — by 9 the lower gates are shoulder to shoulder.",
              "Most people turn back at the Yotsutsuji lookout. The loop above it is empty and takes another hour.",
            ],
            about:
              "Ten thousand vermilion torii climbing Mount Inari, each one donated by a business. The full summit circuit is 4km and about two hours at a walk.",
            address: "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto",
          },
          {
            name: "Tōfuku-ji",
            lat: 34.9766,
            lng: 135.7743,
            tags: ["Temple", "Maples", "Book ahead"],
            notes: [
              "The Tsūten-kyō bridge over the maple valley is the single best autumn view in Kyoto, and everyone knows it.",
              "In peak season the bridge is timed-entry and one-way. Go at opening or not at all.",
            ],
            about:
              "A Zen complex whose modernist rock gardens by Shigemori Mirei are worth the ticket even out of season.",
            address: "15-778 Honmachi, Higashiyama Ward, Kyoto",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "train", duration: "6 min", distance: "1.6 km" },
          },
          {
            name: "Sanjūsangen-dō",
            lat: 34.9879,
            lng: 135.7716,
            tags: ["Temple", "No photography"],
            notes: [
              "1,001 gilded Kannon statues in a 120-metre hall. Ten minutes in and the scale stops being a number.",
            ],
            about:
              "The longest wooden building in Japan. Photography is banned inside and enforced, which is part of why it stays calm.",
            address: "657 Sanjūsangendōmawari, Higashiyama Ward, Kyoto",
            priceLevel: 1,
            transfer: { mode: "bus", duration: "12 min", distance: "1.9 km" },
          },
          {
            name: "Nishiki Market",
            lat: 35.005,
            lng: 135.7649,
            tags: ["Market", "Street food"],
            notes: [
              "Eating while walking is frowned on — most stalls have a two-foot ledge to stand at. Use it.",
              "Closed stalls on Wednesdays; the whole arcade is quietest before 11am.",
            ],
            about:
              "Five blocks of covered market, 400 years old, running parallel to Shijō. Pickles, tamagoyaki, knives, and one very good soy-milk doughnut stand.",
            address: "Nakagyo Ward, Kyoto",
            priceLevel: 1,
            transfer: { mode: "bus", duration: "15 min", distance: "2.3 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Arashiyama and the western hills",
        stops: [
          {
            name: "Arashiyama Bamboo Grove",
            lat: 35.017,
            lng: 135.6716,
            tags: ["Grove", "Free entry"],
            notes: [
              "Before 8am or forget it. The path is 500m long and by 10 it is a single moving queue.",
            ],
            about:
              "The grove runs between Tenryū-ji's north gate and Ōkōchi Sansō. Fifteen minutes end to end at a slow walk.",
            address: "Ukyo Ward, Kyoto",
          },
          {
            name: "Tenryū-ji",
            lat: 35.0159,
            lng: 135.6739,
            tags: ["Temple", "Garden", "UNESCO"],
            notes: [
              "Buy the garden-only ticket unless it is raining; the Sōgenchi pond garden is the reason to come.",
            ],
            about:
              "Kyoto's first-ranked Zen temple, its 14th-century garden borrowing the Arashiyama hills as backdrop — the oldest surviving design of its kind in Japan.",
            address: "68 Sagatenryuji Susukinobabacho, Ukyo Ward, Kyoto",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "4 min", distance: "0.3 km" },
          },
          {
            name: "Ōkōchi Sansō",
            lat: 35.0186,
            lng: 135.6684,
            tags: ["Villa", "Garden", "Tea included"],
            notes: [
              "The ¥1,000 ticket includes matcha and a sweet at the tea house — it is not an upsell, just take it.",
            ],
            about:
              "A silent-film star's hillside estate at the top of the bamboo path. Hardly anyone continues this far, and the view back over the city is the best in the west.",
            address: "8 Sagaogurayama Tabuchiyamacho, Ukyo Ward, Kyoto",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "walk", duration: "7 min", distance: "0.5 km" },
          },
          {
            name: "Katsura River & Togetsukyō Bridge",
            lat: 35.0128,
            lng: 135.6779,
            tags: ["Bridge", "Viewpoint"],
            notes: [
              "Rent a rowing boat upstream of the bridge for the maples from the water.",
            ],
            about:
              "The 'moon-crossing bridge' at the foot of the Arashiyama slope. The north bank is all restaurants; the south bank is the walk.",
            address: "Ukyo Ward, Kyoto",
            transfer: { mode: "walk", duration: "12 min", distance: "1 km" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "Kinkaku-ji, Ryōan-ji and the Kitano lanes",
        stops: [
          {
            name: "Kinkaku-ji",
            lat: 35.0394,
            lng: 135.7292,
            tags: ["Temple", "UNESCO"],
            notes: [
              "A one-way loop of about 25 minutes — it is a photograph, not an afternoon. Plan accordingly.",
              "9am opening; the coach parties land at 10.",
            ],
            about:
              "The Golden Pavilion, gold-leafed on its top two floors and mirrored in the pond. Rebuilt in 1955 after an arson that Mishima wrote a novel about.",
            address: "1 Kinkakujicho, Kita Ward, Kyoto",
            priceLevel: 1,
          },
          {
            name: "Ryōan-ji",
            lat: 35.0345,
            lng: 135.7183,
            tags: ["Temple", "Rock garden", "UNESCO"],
            notes: [
              "Sit on the veranda and stay twenty minutes. Fifteen stones, and you can never see all fifteen at once.",
            ],
            about:
              "The most famous dry-landscape garden in the world, and nobody knows who designed it or what it means. The pond garden below is nearly empty and just as good.",
            address: "13 Ryoanji Goryonoshitacho, Ukyo Ward, Kyoto",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "bus", duration: "8 min", distance: "1.3 km" },
          },
          {
            name: "Ninna-ji",
            lat: 35.0309,
            lng: 135.7137,
            tags: ["Temple", "UNESCO"],
            notes: [
              "The grounds are free; only the palace and the five-storey pagoda area are ticketed.",
            ],
            about:
              "A former imperial residence with a shinden-style palace and covered walkways that stay dry in November rain.",
            address: "33 Omuroouchi, Ukyo Ward, Kyoto",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "11 min", distance: "0.9 km" },
          },
          {
            name: "Kitano Tenmangū",
            lat: 35.0313,
            lng: 135.7352,
            tags: ["Shrine", "Flea market"],
            notes: [
              "The Tenjin-san flea market fills the grounds on the 25th of every month — go if your dates line up.",
              "The maple garden behind the shrine opens for autumn only.",
            ],
            about:
              "Dedicated to the god of learning, so it is full of students before exams. Ox statues everywhere; rubbing one is supposed to help.",
            address: "Bakurocho, Kamigyo Ward, Kyoto",
            transfer: { mode: "bus", duration: "9 min", distance: "1.8 km" },
          },
        ],
      },
      {
        title: "Day 5",
        summary: "The Philosopher's Path, north to south",
        stops: [
          {
            name: "Ginkaku-ji",
            lat: 35.027,
            lng: 135.7982,
            tags: ["Temple", "Garden", "UNESCO"],
            notes: [
              "Start here and walk downhill. Doing the path the other way is a slow climb.",
              "The raked sand cone is remade by hand every few days.",
            ],
            about:
              "The Silver Pavilion, never actually silvered. The moss garden and the short hillside loop behind it are the best part and most people skip them.",
            address: "2 Ginkakujicho, Sakyo Ward, Kyoto",
            priceLevel: 1,
          },
          {
            name: "Philosopher's Path",
            lat: 35.0247,
            lng: 135.7947,
            tags: ["Walk", "Free entry"],
            notes: [
              "Two kilometres of canal, about 35 minutes without stopping — and you will stop.",
              "Cherry season is its famous one, but the maples along the south half are better.",
            ],
            about:
              "Named for the philosopher Nishida Kitarō, who walked it daily to Kyoto University. Small temples and coffee shops open off it the whole way.",
            address: "Sakyo Ward, Kyoto",
            transfer: { mode: "walk", duration: "3 min", distance: "0.2 km" },
          },
          {
            name: "Eikan-dō Zenrin-ji",
            lat: 35.0146,
            lng: 135.7947,
            tags: ["Temple", "Maples", "Illumination"],
            notes: [
              "The single best maple temple in Kyoto in the last week of November. Also the busiest.",
              "The evening light-up sells a separate ticket from 5:30pm and the queue starts at 5.",
            ],
            about:
              "Halls linked by a covered hillside stairway climbing to a pagoda with a view over the whole eastern city.",
            address: "48 Eikandocho, Sakyo Ward, Kyoto",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "walk", duration: "18 min", distance: "1.4 km" },
          },
          {
            name: "Nanzen-ji",
            lat: 35.0114,
            lng: 135.7944,
            tags: ["Temple", "Free grounds"],
            notes: [
              "Walking the grounds and the brick aqueduct costs nothing.",
              "Climb the Sanmon gate for ¥600 — the ladder-stairs are steep and the view is worth it.",
            ],
            about:
              "Head temple of the Rinzai school, with a Meiji-era Roman aqueduct running incongruously through the back of the complex.",
            address: "86 Nanzenji Fukuchicho, Sakyo Ward, Kyoto",
            transfer: { mode: "walk", duration: "9 min", distance: "0.7 km" },
          },
        ],
      },
      {
        title: "Day 6",
        summary: "Day trip north to Kurama and Kibune",
        stops: [
          {
            name: "Kurama-dera",
            lat: 35.1179,
            lng: 135.7707,
            tags: ["Temple", "Mountain", "Hike"],
            notes: [
              "Eizan line from Demachiyanagi, about 30 minutes. Sit at the back for the maple tunnel.",
              "The cable car saves the first climb; the walk up is only 30 minutes and much better.",
            ],
            about:
              "A mountain temple above the village of Kurama, where a hiking trail crosses the ridge and descends into Kibune on the far side.",
            address: "1074 Kuramahonmachi, Sakyo Ward, Kyoto",
            priceLevel: 1,
          },
          {
            name: "Kibune Shrine",
            lat: 35.1216,
            lng: 135.7626,
            tags: ["Shrine", "Water fortunes"],
            notes: [
              "The stone stairway under red lanterns is the photo everyone comes for.",
              "Buy a blank paper fortune and float it in the spring — the text appears in the water.",
            ],
            about:
              "The shrine of the water god, at the head of a river gorge lined with ryokan. Reached over the ridge from Kurama in about an hour of walking.",
            address: "180 Kuramakibunecho, Sakyo Ward, Kyoto",
            highlight: true,
            transfer: { mode: "walk", duration: "65 min", distance: "3.9 km" },
          },
          {
            name: "Demachi Futaba",
            lat: 35.0299,
            lng: 135.7692,
            tags: ["Confectioner", "Takeaway"],
            notes: [
              "Mame-mochi, eaten the same day. There is always a queue and it always moves.",
            ],
            about:
              "A century-old wagashi shop by Demachiyanagi station — the obvious stop on the way back into town from the mountains.",
            address: "236 Seiryucho, Kamigyo Ward, Kyoto",
            priceLevel: 1,
            transfer: { mode: "train", duration: "32 min", distance: "13 km" },
          },
        ],
      },
      {
        title: "Day 7",
        summary: "Uji, tea and the last temple",
        stops: [
          {
            name: "Byōdō-in",
            lat: 34.8892,
            lng: 135.8077,
            tags: ["Temple", "UNESCO", "Day trip"],
            notes: [
              "JR Nara line to Uji, about 25 minutes from Kyoto Station.",
              "The Phoenix Hall interior is a separate timed ticket sold on the day — get it as you enter, not after.",
            ],
            about:
              "The building on the ¥10 coin. An 11th-century Pure Land hall reflected in its own pond, and one of the very few original Heian-period structures left standing.",
            address: "116 Uji Renge, Uji, Kyoto Prefecture",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Nakamura Tōkichi Honten",
            lat: 34.8912,
            lng: 135.8065,
            tags: ["Tea house", "Lunch"],
            notes: [
              "Put your name on the list outside first, then go and see Byōdō-in while you wait.",
              "The matcha jelly is the order.",
            ],
            about:
              "An 1854 tea merchant on Uji's main street. Uji is where Japanese tea culture starts, and this is the least touristy of the famous houses.",
            address: "10 Uji Ichiban, Uji, Kyoto Prefecture",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "5 min", distance: "0.4 km" },
          },
          {
            name: "Nijō Castle",
            lat: 35.0142,
            lng: 135.7481,
            tags: ["Castle", "UNESCO"],
            notes: [
              "The nightingale floors squeak by design — an anti-assassination alarm. Worth the ticket alone.",
              "Last entry an hour before closing and they mean it.",
            ],
            about:
              "The shogun's Kyoto residence, and the room where the Tokugawa handed power back to the emperor in 1867. A flat, easy last afternoon.",
            address: "541 Nijojocho, Nakagyo Ward, Kyoto",
            priceLevel: 2,
            transfer: { mode: "train", duration: "35 min", distance: "17 km" },
          },
        ],
      },
    ],
  },

  "puerto-rico-guide": {
    slug: "puerto-rico-guide",
    heroTitle: "Puerto Rico Guide",
    heroAccent: "one year in",
    publishedAt: "March 8, 2026",
    tags: ["6-day itinerary", "Island guide", "$$ mid-range"],
    intro:
      "I moved here in January and spent the year driving every road on the island. This is the six-day version — Old San Juan, the rainforest, one bioluminescent bay, and the west coast most visitors never reach.",
    bestTime: "April",
    currency: "$",
    generalTips: [
      "Rent a car. Public transport outside San Juan effectively does not exist, and the island is only 100 miles end to end.",
      "It's US territory: no passport for US citizens, dollars, and your US phone plan works with no roaming charge.",
      "Hurricane season runs June to November and peaks in September. February to May is dry, cheap and reliable.",
      "The bio bay only glows on a dark night — book within a few days either side of the new moon or you will pay to see nothing.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Old San Juan on foot",
        stops: [
          {
            name: "Castillo San Felipe del Morro",
            lat: 18.4709,
            lng: -66.1236,
            tags: ["Fortress", "UNESCO"],
            notes: [
              "One $10 ticket covers both forts for 24 hours — do San Cristóbal the same day.",
              "The lawn out front is the city's kite field on weekends.",
            ],
            about:
              "A six-level Spanish fort begun in 1539, guarding the mouth of San Juan Bay. The tunnels and gun galleries go a long way down.",
            address: "501 Calle Norzagaray, San Juan",
            priceLevel: 1,
          },
          {
            name: "Paseo del Morro",
            lat: 18.4676,
            lng: -66.1247,
            tags: ["Walk", "Free entry", "Waterfront"],
            notes: [
              "Flat, shaded on the way out, and full of cats. Go late afternoon.",
            ],
            about:
              "A promenade running along the base of the city walls from the San Juan Gate to the tip of the headland.",
            address: "Old San Juan, San Juan",
            transfer: { mode: "walk", duration: "10 min", distance: "0.6 mi" },
          },
          {
            name: "Calle Fortaleza & Calle del Cristo",
            lat: 18.4655,
            lng: -66.1187,
            tags: ["Historic street", "Shopping"],
            notes: [
              "The umbrella street is on Fortaleza. It is exactly as small as it looks in photos.",
              "Blue cobbles are 19th-century ballast from Spanish ships — bad in flip-flops, worse in rain.",
            ],
            about:
              "The two shopping streets of the old town, running downhill from the cathedral to La Fortaleza, the governor's house.",
            address: "Old San Juan, San Juan",
            transfer: { mode: "walk", duration: "12 min", distance: "0.7 mi" },
          },
          {
            name: "Castillo San Cristóbal",
            lat: 18.4693,
            lng: -66.1094,
            tags: ["Fortress", "UNESCO", "Sunset"],
            notes: [
              "Bigger than El Morro and half as busy. The sentry box on the far bastion is the sunset spot.",
            ],
            about:
              "The largest Spanish fortification in the Americas, built to defend San Juan from a land attack after the English tried exactly that.",
            address: "501 Calle Norzagaray, San Juan",
            highlight: true,
            transfer: { mode: "walk", duration: "15 min", distance: "0.8 mi" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "El Yunque and the Luquillo kiosks",
        stops: [
          {
            name: "El Yunque National Forest",
            lat: 18.2946,
            lng: -65.7899,
            tags: ["Rainforest", "Book ahead", "Hike"],
            notes: [
              "Reservations for the main road corridor are required and released 30 days ahead at 10am. Set an alarm.",
              "It rains most afternoons. That is what a rainforest is; go in the morning.",
            ],
            about:
              "The only tropical rainforest in the US national forest system. La Mina Falls, the Yokahú tower and the Mount Britton trail all sit off Road 191.",
            address: "Rio Grande, Puerto Rico",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Luquillo Kiosks",
            lat: 18.3808,
            lng: -65.7167,
            tags: ["Food stalls", "Beach"],
            notes: [
              "Sixty-odd kiosks in a row. Get the alcapurrias and a bacalaíto and keep walking.",
              "Busiest and best on Sunday afternoons.",
            ],
            about:
              "A strip of open-front food stands on Route 3 at the entrance to Luquillo, feeding the beach behind it since the 1950s.",
            address: "Route 3, Luquillo",
            priceLevel: 1,
            transfer: { mode: "car", duration: "22 min", distance: "12 mi" },
          },
          {
            name: "Playa Azul",
            lat: 18.3853,
            lng: -65.7113,
            tags: ["Beach", "Calm water"],
            notes: [
              "Palm-backed, reef-sheltered and shallow a long way out — the swimming beach if you have kids.",
            ],
            about:
              "Luquillo's main beach, facing north-east with El Yunque's ridge behind it.",
            address: "Luquillo, Puerto Rico",
            transfer: { mode: "walk", duration: "8 min", distance: "0.4 mi" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Vieques and the bio bay",
        stops: [
          {
            name: "Ceiba Ferry Terminal",
            lat: 18.2211,
            lng: -65.6072,
            tags: ["Ferry", "Book ahead"],
            notes: [
              "Tickets go on sale online at midnight, 14 days ahead, and sell out. Do not turn up hoping.",
              "Crossing is about 30 minutes to Vieques.",
            ],
            about:
              "The mainland ferry port for Vieques and Culebra, on the site of the old naval base at Roosevelt Roads.",
            address: "Ceiba, Puerto Rico",
            priceLevel: 1,
          },
          {
            name: "Sun Bay (Sombé)",
            lat: 18.0993,
            lng: -65.4395,
            tags: ["Beach", "Wild horses"],
            notes: [
              "A mile of sand and usually a handful of people. The horses are feral and not tame — give them room.",
            ],
            about:
              "A crescent public beach outside Esperanza, on the south coast of Vieques.",
            address: "Vieques, Puerto Rico",
            transfer: { mode: "ferry", duration: "35 min", distance: "9 mi" },
          },
          {
            name: "Mosquito Bay",
            lat: 18.0972,
            lng: -65.4736,
            tags: ["Bioluminescent bay", "Night tour", "Book ahead"],
            notes: [
              "Brightest bioluminescent bay on record. Kayak tours only — swimming is banned to protect the organisms.",
              "No sunscreen or bug spray on your skin that day; it kills the dinoflagellates.",
            ],
            about:
              "Every paddle stroke lights up blue-green. Book the tour closest to the new moon you can — moonlight washes the whole effect out.",
            address: "Vieques, Puerto Rico",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "car", duration: "12 min", distance: "3 mi" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "South across the mountains to Ponce",
        stops: [
          {
            name: "Guavate lechón strip",
            lat: 18.1349,
            lng: -66.1042,
            tags: ["Lechón", "Weekends only"],
            notes: [
              "Route 184 in Cayey. Whole pigs on spits, ordered by the pound at the counter.",
              "Saturday and Sunday only, and there is live music by 2pm.",
            ],
            about:
              "The island's roast-pork pilgrimage, up in the mountains an hour south of San Juan. Lechonera Los Piños and El Rancho Original are the two to aim for.",
            address: "Route 184, Cayey",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Plaza Las Delicias",
            lat: 18.0111,
            lng: -66.6141,
            tags: ["Square", "Architecture"],
            notes: [
              "The red-and-black striped firehouse on the square is the most photographed building on the island.",
            ],
            about:
              "Ponce's main plaza, with its cathedral, fountains and the 1883 Parque de Bombas. The city calls itself La Perla del Sur and behaves like it.",
            address: "Ponce, Puerto Rico",
            transfer: { mode: "car", duration: "70 min", distance: "48 mi" },
          },
          {
            name: "Museo de Arte de Ponce",
            lat: 18.0069,
            lng: -66.6104,
            tags: ["Museum"],
            notes: [
              "Small, superbly hung, and air-conditioned at the hottest hour of the day.",
            ],
            about:
              "A Edward Durell Stone building holding the best European collection in the Caribbean — the Pre-Raphaelites in particular.",
            address: "2325 Av. Las Américas, Ponce",
            priceLevel: 1,
            transfer: { mode: "car", duration: "6 min", distance: "0.9 mi" },
          },
        ],
      },
      {
        title: "Day 5",
        summary: "The south-west corner",
        stops: [
          {
            name: "La Parguera",
            lat: 17.9736,
            lng: -67.0453,
            tags: ["Mangroves", "Boat trip"],
            notes: [
              "Boat out through the mangrove channels; this is the one bio bay you are still allowed to swim in.",
              "It is dimmer than Mosquito Bay. Do this one for the swim, not the glow.",
            ],
            about:
              "A stilt-house fishing village in Lajas, with cays and mangrove channels immediately offshore.",
            address: "Lajas, Puerto Rico",
            priceLevel: 2,
          },
          {
            name: "Cabo Rojo Lighthouse",
            lat: 17.9339,
            lng: -67.1903,
            tags: ["Lighthouse", "Cliffs", "Free entry"],
            notes: [
              "Park at the bottom and walk up. The cliff edge has no railing and the drop is 200 feet.",
            ],
            about:
              "An 1882 lighthouse on white limestone cliffs at the island's south-west tip, above salt flats worked since the 1500s.",
            address: "Cabo Rojo, Puerto Rico",
            highlight: true,
            transfer: { mode: "car", duration: "28 min", distance: "16 mi" },
          },
          {
            name: "Playa Sucia (Playuela)",
            lat: 17.9382,
            lng: -67.1873,
            tags: ["Beach", "Swimming"],
            notes: [
              "Below the lighthouse and reached by a rough track — a normal rental car is fine, slowly.",
            ],
            about:
              "A sheltered horseshoe cove under the cliffs. No facilities, no shade, bring water.",
            address: "Cabo Rojo, Puerto Rico",
            transfer: { mode: "walk", duration: "14 min", distance: "0.8 mi" },
          },
        ],
      },
      {
        title: "Day 6",
        summary: "Karst country on the way back",
        stops: [
          {
            name: "Cueva Ventana",
            lat: 18.3833,
            lng: -66.7017,
            tags: ["Cave", "Viewpoint", "Guided"],
            notes: [
              "Guided only, helmets provided, about an hour. Closed-toe shoes.",
            ],
            about:
              "A cave whose far end opens as a window in a cliff face, framing the Río Grande de Arecibo valley below.",
            address: "Route 10, Arecibo",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Cueva del Indio",
            lat: 18.4874,
            lng: -66.6157,
            tags: ["Petroglyphs", "Coast"],
            notes: [
              "Taíno carvings on the walls, and the sea blowholes on the ledge outside are unfenced. Careful.",
            ],
            about:
              "A collapsed sea cave in the coastal limestone at Arecibo, with pre-Columbian petroglyphs inside it.",
            address: "Route 681, Arecibo",
            priceLevel: 1,
            transfer: { mode: "car", duration: "25 min", distance: "12 mi" },
          },
          {
            name: "La Placita de Santurce",
            lat: 18.4489,
            lng: -66.0664,
            tags: ["Nightlife", "Market square"],
            notes: [
              "Produce market by day, open-air party by night, Thursday to Saturday.",
              "Eat at one of the restaurants around the edge first — the middle is drinks only.",
            ],
            about:
              "A 1910 market building in Santurce whose surrounding blocks close to traffic after dark. The best last night on the island.",
            address: "Calle Dos Hermanos, San Juan",
            priceLevel: 2,
            transfer: { mode: "car", duration: "50 min", distance: "45 mi" },
          },
        ],
      },
    ],
  },

  "chicago-4-day-guide": {
    slug: "chicago-4-day-guide",
    heroTitle: "Chicago 4-Day Guide",
    heroAccent: "the architecture city",
    publishedAt: "September 19, 2025",
    tags: ["4-day itinerary", "City break", "$$ mid-range"],
    intro:
      "Chicago rewards a short trip better than almost any US city because everything worth seeing sits on one lakefront strip. Four days is enough for the Loop, the river, two neighbourhoods and a ballgame — in that order.",
    bestTime: "September",
    currency: "$",
    generalTips: [
      "The architecture river cruise is not a tourist trap — it is the single best thing to do in the city, and it is the right thing to do first because it explains everything you'll walk past afterwards.",
      "Ventra passes cover the 'L' and buses; a 3-day pass is $20 and pays for itself on day one. The Blue Line from O'Hare is $5 and beats a $50 cab in traffic.",
      "The wind is a lake wind, not a skyscraper wind — it comes off the water and it is real from October onwards. Bring a layer more than the forecast suggests.",
      "Deep dish is a once-per-trip thing and takes 45 minutes to bake; order it when you sit down. Tavern-style thin crust is what locals actually eat.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "The Loop, the river and the lakefront",
        stops: [
          {
            name: "Chicago Architecture Center river cruise",
            lat: 41.888,
            lng: -87.6247,
            tags: ["Boat tour", "Book ahead"],
            notes: [
              "90 minutes, docks at Michigan Avenue Bridge. Book the CAC one, not the cheaper knock-offs — the docents are trained architects.",
              "Sit on the top deck, port side, for the best of the first stretch.",
            ],
            about:
              "The tour that makes sense of the skyline: how the 1871 fire, the steel frame and the 1909 Burnham Plan produced the city you're standing in.",
            address: "112 E Wacker Dr, Chicago",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Chicago Riverwalk",
            lat: 41.8879,
            lng: -87.627,
            tags: ["Walk", "Free entry", "Bars"],
            notes: [
              "Runs from Lake Shore Drive to Lake Street, all below street level.",
              "The wine bar at the La Salle stretch has the best seats on the water.",
            ],
            about:
              "A continuous 1.25-mile promenade along the south bank of the main branch, each block designed as a different room.",
            address: "Chicago Riverwalk, Chicago",
          },
          {
            name: "Millennium Park & Cloud Gate",
            lat: 41.8827,
            lng: -87.6233,
            tags: ["Park", "Free entry", "Sculpture"],
            notes: [
              "The Bean before 8am is empty and it photographs far better without a crowd underneath it.",
              "Free concerts at the Pritzker Pavilion most summer evenings.",
            ],
            about:
              "Kapoor's mirrored sculpture, Gehry's band shell and the Crown Fountain, all built over a railyard.",
            address: "201 E Randolph St, Chicago",
            transfer: { mode: "walk", duration: "9 min", distance: "0.5 mi" },
          },
          {
            name: "Art Institute of Chicago",
            lat: 41.8796,
            lng: -87.6237,
            tags: ["Museum", "Impressionists"],
            notes: [
              "Nighthawks, American Gothic and a Sunday Afternoon are all in one building and all in different wings.",
              "Thursday evenings are free for Illinois residents and quiet for everyone.",
            ],
            about:
              "One of the great encyclopaedic museums, entered between two bronze lions on Michigan Avenue. The Modern Wing has its own bridge from Millennium Park.",
            address: "111 S Michigan Ave, Chicago",
            priceLevel: 3,
            transfer: { mode: "walk", duration: "5 min", distance: "0.3 mi" },
          },
          {
            name: "Skydeck at Willis Tower",
            lat: 41.8789,
            lng: -87.6359,
            tags: ["Viewpoint", "Book ahead"],
            notes: [
              "The glass Ledge boxes are on the 103rd floor. Go at dusk and you get day and night in one ticket.",
              "360 Chicago at the Hancock is the better view — of the Willis Tower, which the Willis Tower cannot show you.",
            ],
            about:
              "1,353 feet up the former Sears Tower, whose nine bundled tubes were a genuine structural invention in 1973.",
            address: "233 S Wacker Dr, Chicago",
            priceLevel: 3,
            transfer: { mode: "walk", duration: "13 min", distance: "0.7 mi" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "North Side — Lincoln Park and Wrigleyville",
        stops: [
          {
            name: "Lincoln Park Zoo",
            lat: 41.9217,
            lng: -87.6337,
            tags: ["Zoo", "Free entry"],
            notes: [
              "Free, every day, since 1868 — one of the last free zoos in the country.",
            ],
            about:
              "35 acres inside the park itself, with the conservatory and the lily pool a short walk north.",
            address: "2001 N Clark St, Chicago",
          },
          {
            name: "Alfred Caldwell Lily Pool",
            lat: 41.9257,
            lng: -87.6338,
            tags: ["Garden", "Free entry", "Quiet"],
            notes: [
              "Hidden behind a hedge and almost nobody finds it. Closed in winter.",
            ],
            about:
              "A Prairie School water garden of stratified stone and native planting, restored in 2002 and now a National Historic Landmark.",
            address: "125 W Fullerton Pkwy, Chicago",
            transfer: { mode: "walk", duration: "7 min", distance: "0.4 mi" },
          },
          {
            name: "Wrigley Field",
            lat: 41.9484,
            lng: -87.6553,
            tags: ["Ballpark", "Landmark"],
            notes: [
              "Even without a game, the tour gets you into the dugout and the ivy.",
              "With a game: sit in the outfield bleachers, not behind home plate.",
            ],
            about:
              "1914, ivy-covered brick outfield walls and a hand-turned scoreboard. The Red Line stops at the gate.",
            address: "1060 W Addison St, Chicago",
            priceLevel: 3,
            highlight: true,
            transfer: { mode: "train", duration: "14 min", distance: "2.4 mi" },
          },
          {
            name: "The Green Mill",
            lat: 41.9698,
            lng: -87.6597,
            tags: ["Jazz club", "Late night"],
            notes: [
              "Cash at the door. Talking during a set will get you shushed by the room, not the staff.",
              "Sunday is the poetry slam that invented poetry slams.",
            ],
            about:
              "An Uptown jazz club open since 1907, with Capone's booth still in the corner and the original Deco fittings intact.",
            address: "4802 N Broadway, Chicago",
            priceLevel: 2,
            transfer: { mode: "train", duration: "11 min", distance: "1.8 mi" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "West and south — Pilsen, murals and the museum campus",
        stops: [
          {
            name: "Garfield Park Conservatory",
            lat: 41.8863,
            lng: -87.717,
            tags: ["Conservatory", "Free entry"],
            notes: [
              "Jens Jensen's 1908 glasshouse, and free. The Fern Room is designed to feel like prehistoric Illinois.",
            ],
            about:
              "Two acres under glass on the Green Line, and one of the largest conservatories in the country.",
            address: "300 N Central Park Ave, Chicago",
          },
          {
            name: "Pilsen murals & 16th Street",
            lat: 41.857,
            lng: -87.6572,
            tags: ["Street art", "Neighbourhood"],
            notes: [
              "The 16th Street railway embankment is a continuous mural for over a mile.",
              "Eat on 18th Street — the bakeries open at 6am and sell out by noon.",
            ],
            about:
              "A Mexican-American neighbourhood on the Lower West Side with the densest concentration of public murals in the city.",
            address: "18th St & Blue Island Ave, Chicago",
            highlight: true,
            transfer: { mode: "train", duration: "22 min", distance: "4.2 mi" },
          },
          {
            name: "Field Museum",
            lat: 41.8663,
            lng: -87.617,
            tags: ["Museum", "Family"],
            notes: [
              "Sue, the most complete T. rex ever found, is now in her own hall upstairs, not the main lobby.",
            ],
            about:
              "The natural history anchor of the Museum Campus, in a 1921 neoclassical hall on the lakefront.",
            address: "1400 S Lake Shore Dr, Chicago",
            priceLevel: 3,
            transfer: { mode: "bus", duration: "18 min", distance: "2.6 mi" },
          },
          {
            name: "Northerly Island / Adler skyline view",
            lat: 41.8663,
            lng: -87.6068,
            tags: ["Viewpoint", "Free entry", "Sunset"],
            notes: [
              "The lakefront path east of the Adler Planetarium is the postcard skyline shot. Free, and best 20 minutes after sunset.",
            ],
            about:
              "A man-made peninsula, formerly Meigs Field airport, now prairie and a concert lawn — with the whole city lined up behind it.",
            address: "1521 S Linn White Dr, Chicago",
            transfer: { mode: "walk", duration: "12 min", distance: "0.7 mi" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "Oak Park, then one last deep dish",
        stops: [
          {
            name: "Frank Lloyd Wright Home & Studio",
            lat: 41.8946,
            lng: -87.7995,
            tags: ["Architecture", "Guided", "Book ahead"],
            notes: [
              "Green Line to Harlem, then a ten-minute walk. Tickets go fast on weekends.",
              "The self-guided neighbourhood audio tour afterwards covers 25 more Wright houses in six blocks.",
            ],
            about:
              "Where Wright developed the Prairie style between 1889 and 1909, in the suburb that holds the world's densest concentration of his work.",
            address: "951 Chicago Ave, Oak Park",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Unity Temple",
            lat: 41.8882,
            lng: -87.7998,
            tags: ["Architecture", "UNESCO"],
            notes: [
              "Poured concrete in 1908, when nobody built public buildings that way. The interior light is the whole point.",
            ],
            about:
              "Wright's Unitarian church a few blocks south of the studio, restored in 2017 and now a UNESCO World Heritage site.",
            address: "875 Lake St, Oak Park",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "9 min", distance: "0.5 mi" },
          },
          {
            name: "Lou Malnati's Pizzeria",
            lat: 41.8925,
            lng: -87.63,
            tags: ["Deep dish", "Dinner"],
            notes: [
              "Order the moment you sit — it bakes for 45 minutes.",
              "Butter crust, sausage patty. One pie feeds three people, whatever the menu says.",
            ],
            about:
              "The River North branch of the family that has been arguing about deep dish since 1971.",
            address: "439 N Wells St, Chicago",
            priceLevel: 2,
            transfer: { mode: "train", duration: "26 min", distance: "9 mi" },
          },
        ],
      },
    ],
  },

  "costa-del-sol-7-nights": {
    slug: "costa-del-sol-7-nights",
    heroTitle: "Costa del Sol — 7 Nights",
    heroAccent: "beyond the beach",
    publishedAt: "June 2, 2025",
    tags: ["7-night itinerary", "Andalusia", "€ budget"],
    intro:
      "The coast gets written off as sunbeds and English breakfasts, and that is only true of about four miles of it. Base yourself in Málaga, drive inland every other day, and it turns into one of the best weeks in Spain.",
    bestTime: "May",
    currency: "€",
    generalTips: [
      "Stay in Málaga city, not on the beach strip. It has the airport train, the museums and the food, and a car park costs less than a resort transfer.",
      "Hire a car for days 3, 5 and 6 only. Everything else is walkable or on the coastal Cercanías line.",
      "Andalusian lunch is 2–4pm and dinner starts at 9. Turning up at a good restaurant at 7pm gets you an empty room and a worse kitchen.",
      "Caminito del Rey sells out weeks ahead and is one-way — book the shuttle bus back at the same time or you'll walk 8km along the road.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Málaga old town",
        stops: [
          {
            name: "Alcazaba de Málaga",
            lat: 36.7213,
            lng: -4.4152,
            tags: ["Fortress", "Gardens"],
            notes: [
              "Combined ticket with the Gibralfaro castle above it is €5.50 and the walk between them is the good part.",
              "Free on Sunday afternoons.",
            ],
            about:
              "An 11th-century Moorish palace-fortress built over a Roman theatre, layered up the hill behind the city.",
            address: "Calle Alcazabilla 2, Málaga",
            priceLevel: 1,
          },
          {
            name: "Museo Picasso Málaga",
            lat: 36.7222,
            lng: -4.4172,
            tags: ["Museum"],
            notes: [
              "The collection is family-donated: sketchbooks and late work rather than the famous canvases.",
            ],
            about:
              "In the Buenavista Palace, five minutes from the house where Picasso was born on Plaza de la Merced.",
            address: "Palacio de Buenavista, Calle San Agustín 8, Málaga",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "3 min", distance: "0.2 km" },
          },
          {
            name: "Mercado de Atarazanas",
            lat: 36.7195,
            lng: -4.4256,
            tags: ["Market", "Lunch"],
            notes: [
              "Mornings only, closed Sundays. Eat at the bar counters at the back, not the tourist stalls by the door.",
            ],
            about:
              "A 19th-century iron market hall built around a Nasrid shipyard gate, with a huge stained-glass window at the end.",
            address: "Calle Atarazanas 10, Málaga",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "8 min", distance: "0.6 km" },
          },
          {
            name: "Playa de la Malagueta",
            lat: 36.718,
            lng: -4.4046,
            tags: ["Beach", "Espetos"],
            notes: [
              "Order espetos — sardines grilled on a cane over a boat full of sand. Only at the chiringuitos on the sand itself.",
            ],
            about:
              "The city beach, a ten-minute walk from the cathedral, backed by the promenade and the port redevelopment.",
            address: "Málaga, Spain",
            highlight: true,
            transfer: { mode: "walk", duration: "16 min", distance: "1.3 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Nerja and the white village above it",
        stops: [
          {
            name: "Balcón de Europa",
            lat: 36.7455,
            lng: -3.8756,
            tags: ["Viewpoint", "Free entry"],
            notes: [
              "A promontory over the sea at the end of the main street. Go before 10 or after 7.",
            ],
            about:
              "Built on the base of a ruined fortress, with the Sierra Almijara dropping into the Mediterranean on both sides.",
            address: "Balcón de Europa, Nerja",
          },
          {
            name: "Cuevas de Nerja",
            lat: 36.7621,
            lng: -3.8452,
            tags: ["Caves", "Book ahead"],
            notes: [
              "Timed entry, and the 10am slot is 15 degrees cooler than the outside air in June.",
            ],
            about:
              "A cave system with the largest known stalagmite column in the world — 32 metres — and Palaeolithic paintings not open to the public.",
            address: "Ctra. de Maro, Nerja",
            priceLevel: 2,
            transfer: { mode: "car", duration: "9 min", distance: "4.5 km" },
          },
          {
            name: "Frigiliana",
            lat: 36.7906,
            lng: -3.8936,
            tags: ["White village", "Hilltop"],
            notes: [
              "Park at the bottom and walk. The upper barrio is stepped and no car fits.",
              "The mosaics on the walls tell the story of the 1569 Morisco rebellion in sequence.",
            ],
            about:
              "Repeatedly voted the prettiest village in Andalusia, six kilometres up the valley from Nerja and about 300m higher.",
            address: "Frigiliana, Málaga",
            highlight: true,
            transfer: { mode: "car", duration: "15 min", distance: "7 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Caminito del Rey",
        stops: [
          {
            name: "Caminito del Rey",
            lat: 36.9297,
            lng: -4.7999,
            tags: ["Gorge walk", "Book ahead", "One-way"],
            notes: [
              "€10, sells out a month ahead. Walkways are one-way north to south — book the shuttle back to the car park.",
              "About 3 hours end to end, 7.7km, and no shade. Water and a hat.",
            ],
            about:
              "A metre-wide boardwalk pinned 100 metres up the wall of the Gaitanes gorge, rebuilt in 2015 over the collapsed 1905 original.",
            address: "El Chorro, Álora",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "El Chorro reservoirs",
            lat: 36.9111,
            lng: -4.7649,
            tags: ["Lake", "Swimming"],
            notes: [
              "The turquoise water is real and it is freezing. Swim at the Tajo de la Encantada end.",
            ],
            about:
              "Three linked reservoirs below the gorge — the obvious swim after three hours on a walkway.",
            address: "Ardales, Málaga",
            transfer: { mode: "car", duration: "12 min", distance: "8 km" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "A slow coastal day",
        stops: [
          {
            name: "Marbella Casco Antiguo",
            lat: 36.5108,
            lng: -4.885,
            tags: ["Old town", "Orange square"],
            notes: [
              "The Plaza de los Naranjos is the whole reason to come. Skip Puerto Banús unless you want to look at boats.",
            ],
            about:
              "A genuinely old Andalusian centre surviving inside the most developed municipality on the coast.",
            address: "Plaza de los Naranjos, Marbella",
            priceLevel: 2,
          },
          {
            name: "Mijas Pueblo",
            lat: 36.5959,
            lng: -4.6377,
            tags: ["White village", "Viewpoint"],
            notes: [
              "428m up with the whole coast laid out below. Go for sunset and stay for dinner.",
            ],
            about:
              "A hill village above Fuengirola, touristy on the main square and completely quiet three streets back.",
            address: "Mijas, Málaga",
            highlight: true,
            transfer: { mode: "car", duration: "35 min", distance: "28 km" },
          },
        ],
      },
      {
        title: "Days 5–6",
        summary: "Inland — Ronda and the pueblos blancos",
        stops: [
          {
            name: "Puente Nuevo, Ronda",
            lat: 36.7419,
            lng: -5.1655,
            tags: ["Bridge", "Gorge"],
            notes: [
              "The famous view is from below — take the path down from Plaza María Auxiliadora, not the bridge itself.",
              "Stay the night. Ronda after the day-trippers leave is a different town.",
            ],
            about:
              "A 98-metre stone bridge spanning the El Tajo gorge, which splits the town in two. Forty-two years to build, finished 1793.",
            address: "Plaza España, Ronda",
            highlight: true,
          },
          {
            name: "Plaza de Toros de Ronda",
            lat: 36.7434,
            lng: -5.1666,
            tags: ["Bullring", "Museum"],
            notes: [
              "One of the oldest in Spain and the birthplace of modern bullfighting on foot. Museum only — no fights outside September.",
            ],
            about:
              "An 1785 ring of double-tiered stone arcades, unusually roofed the whole way round.",
            address: "Calle Virgen de la Paz 15, Ronda",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "4 min", distance: "0.3 km" },
          },
          {
            name: "Setenil de las Bodegas",
            lat: 36.8639,
            lng: -5.1817,
            tags: ["White village", "Cave houses"],
            notes: [
              "Houses built under overhanging rock — Calle Cuevas del Sol is the street.",
              "Twenty minutes from Ronda and worth the detour for lunch alone.",
            ],
            about:
              "A village compressed into a river gorge, where the cliff forms the roof of an entire street of buildings.",
            address: "Setenil de las Bodegas, Cádiz",
            transfer: { mode: "car", duration: "22 min", distance: "18 km" },
          },
          {
            name: "Zahara de la Sierra",
            lat: 36.8399,
            lng: -5.3934,
            tags: ["White village", "Reservoir"],
            notes: [
              "The drive over the Puerto de las Palomas pass to get here is the point as much as the village.",
            ],
            about:
              "A castle tower on a crag above a turquoise reservoir, at the edge of the Grazalema natural park.",
            address: "Zahara de la Sierra, Cádiz",
            transfer: { mode: "car", duration: "40 min", distance: "32 km" },
          },
        ],
      },
      {
        title: "Day 7",
        summary: "Back in Málaga, slowly",
        stops: [
          {
            name: "Centre Pompidou Málaga",
            lat: 36.7146,
            lng: -4.4155,
            tags: ["Museum", "Modern art"],
            notes: [
              "Under a glass cube on the quayside. Small enough to do properly in an hour.",
            ],
            about:
              "The Pompidou's first outpost outside France, opened 2015 as part of the port redevelopment.",
            address: "Pasaje Doctor Carrillo Casaux, Málaga",
            priceLevel: 1,
          },
          {
            name: "Muelle Uno & La Farola",
            lat: 36.7136,
            lng: -4.4128,
            tags: ["Promenade", "Sunset"],
            notes: [
              "Walk out to the lighthouse at the end of the mole for the last view of the coast.",
            ],
            about:
              "The reclaimed port promenade linking the old town to the beach, with the 1817 lighthouse at the far end.",
            address: "Muelle Uno, Málaga",
            highlight: true,
            transfer: { mode: "walk", duration: "5 min", distance: "0.4 km" },
          },
        ],
      },
    ],
  },

  "northern-ireland-6-day": {
    slug: "northern-ireland-6-day",
    heroTitle: "Northern Ireland 6-Day",
    heroAccent: "the Causeway Coast",
    publishedAt: "October 14, 2025",
    tags: ["6-day road trip", "Causeway Coast", "£ budget"],
    intro:
      "Belfast in, Derry out, and the coast road in between. We did this in September 2025 in a hire car and it rained on four of the six days, which turns out not to matter at all — every stop below is better under weather.",
    bestTime: "September",
    currency: "£",
    generalTips: [
      "It's the UK: pounds sterling, not euros, even though the Republic is 40 minutes away. Cards work everywhere; the border has no checkpoint and you will cross it without noticing.",
      "Hire the car in Belfast and drop it in Derry — one-way fees inside Northern Ireland are small, and it saves you a day of backtracking.",
      "The Causeway itself is free to walk to. The £15 visitor centre ticket buys the audio guide and the car park, and you can park in Bushmills and take the bus instead.",
      "Book Giant's Causeway and Carrick-a-Rede for first thing. Both are coach-tour stops from about 11am and both are half the experience with 300 people on them.",
    ],
    days: [
      {
        title: "Days 1–2",
        summary: "Belfast",
        stops: [
          {
            name: "Titanic Belfast",
            lat: 54.6079,
            lng: -5.9098,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Two and a half hours if you read everything. The shipyard gantry ride in the middle is better than it sounds.",
              "Your ticket includes the SS Nomadic outside — actually go and see it.",
            ],
            about:
              "Built on the slipway where the ship was launched, in a hull-shaped aluminium building the same height as Titanic's bow.",
            address: "1 Olympic Way, Queen's Road, Belfast",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Crumlin Road Gaol",
            lat: 54.6089,
            lng: -5.9497,
            tags: ["Prison", "Guided tour"],
            notes: [
              "The tunnel to the courthouse and the condemned man's cell are the parts you remember.",
            ],
            about:
              "A Victorian prison that operated from 1846 to 1996, through the entire Troubles. Guided tours only.",
            address: "53-55 Crumlin Rd, Belfast",
            priceLevel: 2,
          },
          {
            name: "Falls & Shankill murals",
            lat: 54.5966,
            lng: -5.9552,
            tags: ["Murals", "Black taxi tour"],
            notes: [
              "Take a black taxi tour with a driver from the area. It is the only way to get both sides of it honestly.",
              "The peace wall gates still close at night.",
            ],
            about:
              "Two roads either side of a wall, and the political murals that have documented the conflict and its aftermath since the 1970s.",
            address: "Falls Rd, Belfast",
            priceLevel: 2,
            transfer: { mode: "car", duration: "9 min", distance: "1.9 mi" },
          },
          {
            name: "Cave Hill",
            lat: 54.6425,
            lng: -5.9542,
            tags: ["Hike", "Viewpoint", "Free entry"],
            notes: [
              "Ninety minutes up and back from Belfast Castle. McArt's Fort at the top is the profile that supposedly gave Swift his sleeping giant.",
            ],
            about:
              "The basalt escarpment over the north of the city, with the whole of Belfast Lough below it.",
            address: "Antrim Rd, Belfast",
            transfer: { mode: "car", duration: "16 min", distance: "4 mi" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "North up the Antrim coast road",
        stops: [
          {
            name: "Carrickfergus Castle",
            lat: 54.7136,
            lng: -5.8065,
            tags: ["Castle", "Norman"],
            notes: [
              "Twenty minutes out of Belfast and a good first stop rather than a destination.",
            ],
            about:
              "A Norman keep on a basalt outcrop in the harbour, besieged in every century from the 12th to the 18th.",
            address: "Marine Highway, Carrickfergus",
            priceLevel: 1,
          },
          {
            name: "The Gobbins",
            lat: 54.7898,
            lng: -5.7042,
            tags: ["Cliff path", "Guided", "Book ahead"],
            notes: [
              "Guided only, three hours, and cancelled outright in heavy swell. Book a spare day.",
              "Helmets and waterproofs supplied; boots are not.",
            ],
            about:
              "An Edwardian cliff path of bridges and tunnels bolted into the face of Islandmagee, restored and reopened in 2015.",
            address: "68 Middle Rd, Larne",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "car", duration: "22 min", distance: "12 mi" },
          },
          {
            name: "Glenariff Forest Park",
            lat: 55.0169,
            lng: -6.0672,
            tags: ["Waterfalls", "Walk"],
            notes: [
              "The Waterfall Walkway is 3 miles, boardwalked, and does not need boots.",
            ],
            about:
              "The 'Queen of the Glens' — a glacial valley of waterfalls off the coast road, and the best of the nine Glens of Antrim.",
            address: "98 Glenariff Rd, Ballymena",
            priceLevel: 1,
            transfer: { mode: "car", duration: "45 min", distance: "26 mi" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "The Causeway itself",
        stops: [
          {
            name: "Carrick-a-Rede Rope Bridge",
            lat: 55.2394,
            lng: -6.3294,
            tags: ["Rope bridge", "Book ahead", "Coastal"],
            notes: [
              "Timed tickets, National Trust. The walk from the car park is a mile each way and it is the best mile on the coast.",
              "Closes in high wind with no notice.",
            ],
            about:
              "A 20-metre rope bridge to a salmon-fishery island, 30 metres above the water. Fishermen strung a version of it for 350 years.",
            address: "119a Whitepark Rd, Ballintoy",
            priceLevel: 2,
          },
          {
            name: "Ballintoy Harbour",
            lat: 55.2419,
            lng: -6.3728,
            tags: ["Harbour", "Free entry"],
            notes: [
              "The road down is single-track with hairpins. Worth it.",
              "Iron Islands in Game of Thrones, if that matters to you.",
            ],
            about:
              "A tiny working harbour under a limestone cliff, with a strange landscape of eroded rock stacks around the bay.",
            address: "Harbour Rd, Ballintoy",
            transfer: { mode: "car", duration: "8 min", distance: "3 mi" },
          },
          {
            name: "Giant's Causeway",
            lat: 55.2408,
            lng: -6.5116,
            tags: ["UNESCO", "Basalt columns"],
            notes: [
              "Take the red trail down and the blue clifftop path back — most people walk the road both ways and miss the amphitheatre entirely.",
              "8am or 6pm. In between it is a queue on hexagons.",
            ],
            about:
              "Forty thousand interlocking basalt columns from a 60-million-year-old lava flow, at the foot of a cliff on the north coast.",
            address: "44 Causeway Rd, Bushmills",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "car", duration: "16 min", distance: "8 mi" },
          },
          {
            name: "Old Bushmills Distillery",
            lat: 55.2033,
            lng: -6.5222,
            tags: ["Distillery", "Tour"],
            notes: [
              "Licensed in 1608, which makes it the oldest in the world on paper.",
              "Driver's measures are handed over in a bottle to take away.",
            ],
            about:
              "A working triple-distillation whiskey plant in the village of the same name, two miles inland from the Causeway.",
            address: "2 Distillery Rd, Bushmills",
            priceLevel: 2,
            transfer: { mode: "car", duration: "7 min", distance: "2.5 mi" },
          },
        ],
      },
      {
        title: "Day 5",
        summary: "Dunluce, the Dark Hedges and Mussenden",
        stops: [
          {
            name: "Dunluce Castle",
            lat: 55.2107,
            lng: -6.5789,
            tags: ["Castle ruin", "Cliffs"],
            notes: [
              "The kitchen fell into the sea in 1639, taking the staff with it. You can see where.",
            ],
            about:
              "A ruined clifftop castle separated from the mainland by a chasm and reached by a bridge.",
            address: "87 Dunluce Rd, Bushmills",
            priceLevel: 1,
          },
          {
            name: "The Dark Hedges",
            lat: 55.1349,
            lng: -6.381,
            tags: ["Beech avenue", "Free entry"],
            notes: [
              "The road is closed to traffic — park at the hotel and walk in.",
              "Two minutes to see, and it is genuinely striking at dawn and unremarkable at midday.",
            ],
            about:
              "An avenue of beeches planted in the 18th century to impress visitors arriving at Gracehill House. Storms have taken several.",
            address: "Bregagh Rd, Stranocum",
            transfer: { mode: "car", duration: "24 min", distance: "14 mi" },
          },
          {
            name: "Mussenden Temple",
            lat: 55.1633,
            lng: -6.7739,
            tags: ["Folly", "Clifftop", "Viewpoint"],
            notes: [
              "Park at Downhill Demesne and walk through the estate; the temple appears without warning at the cliff edge.",
            ],
            about:
              "A domed 1785 library modelled on the Temple of Vesta, perched on a cliff 40 metres above Downhill Strand.",
            address: "Mussenden Rd, Castlerock",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "car", duration: "35 min", distance: "20 mi" },
          },
        ],
      },
      {
        title: "Day 6",
        summary: "Derry, and the walls",
        stops: [
          {
            name: "Derry City Walls",
            lat: 54.9958,
            lng: -7.3222,
            tags: ["City walls", "Free entry"],
            notes: [
              "A complete circuit, about a mile, and you can do it in 40 minutes.",
              "Start at Magazine Gate so you finish above the Bogside.",
            ],
            about:
              "The only fully intact walled city in Ireland, built 1613–19 and never breached — including through the 105-day siege of 1689.",
            address: "Derry~Londonderry",
            highlight: true,
          },
          {
            name: "Museum of Free Derry",
            lat: 54.9979,
            lng: -7.3283,
            tags: ["Museum", "History"],
            notes: [
              "Run by families of the Bloody Sunday victims. Small, and the most affecting hour of the trip.",
            ],
            about:
              "In the Bogside, below the walls, covering the civil rights movement, Free Derry and 1972.",
            address: "55 Glenfada Park, Derry",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "9 min", distance: "0.5 mi" },
          },
          {
            name: "Peace Bridge",
            lat: 54.9976,
            lng: -7.3186,
            tags: ["Bridge", "Free entry"],
            notes: [
              "Built in 2011 to link the two banks — and the two communities — on foot. Walk it at dusk.",
            ],
            about:
              "A curving cable-stayed footbridge over the Foyle, connecting the city side to Ebrington Square on the old army barracks.",
            address: "Derry~Londonderry",
            transfer: { mode: "walk", duration: "12 min", distance: "0.7 mi" },
          },
        ],
      },
    ],
  },

  "milan-in-2-5-days": {
    slug: "milan-in-2-5-days",
    heroTitle: "Milan in 2.5 Days",
    heroAccent: "a compact itinerary",
    publishedAt: "February 20, 2026",
    tags: ["Weekend break", "Milan guide", "€€ mid-range"],
    intro:
      "Milan gets called boring by people who spent six hours here between flights. Give it two and a half days, treat the aperitivo hour as a fixed appointment, and it makes a very good case for itself.",
    bestTime: "April",
    currency: "€",
    generalTips: [
      "Book The Last Supper the day tickets are released — 90 days ahead, and the 15-minute slots for a whole month can go in an afternoon.",
      "The Duomo rooftop is a separate ticket from the cathedral. Take the stairs, not the lift: it's €5 cheaper and only 250 steps.",
      "Aperitivo runs 6–9pm. One drink at €10–12 comes with a buffet, and in the Navigli that genuinely replaces dinner.",
      "Malpensa Express to Cadorna is 30 minutes and €13. Taxis are a flat €104 and slower in traffic.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "The Duomo and the centre",
        stops: [
          {
            name: "Duomo di Milano",
            lat: 45.4642,
            lng: 9.19,
            tags: ["Cathedral", "Rooftop", "Book ahead"],
            notes: [
              "The roof terraces are the reason to come — you walk among the flying buttresses and 3,400 statues.",
              "Shoulders and knees covered, enforced at the door.",
            ],
            about:
              "Six centuries to build, in pink-veined Candoglia marble. The fourth-largest church in the world and still the centre of the city in every sense.",
            address: "Piazza del Duomo, Milan",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Galleria Vittorio Emanuele II",
            lat: 45.4659,
            lng: 9.1899,
            tags: ["Arcade", "Free entry"],
            notes: [
              "Spin on the bull mosaic's, ah, anatomy for luck — there is a visible hole in the floor from 150 years of it.",
              "A coffee standing at the bar is €1.50; sitting down in the Galleria is €12.",
            ],
            about:
              "An 1877 iron-and-glass arcade linking the Duomo to La Scala, and the model for every shopping arcade built since.",
            address: "Piazza del Duomo, Milan",
            transfer: { mode: "walk", duration: "2 min", distance: "0.15 km" },
          },
          {
            name: "Teatro alla Scala",
            lat: 45.4674,
            lng: 9.1895,
            tags: ["Opera house", "Museum"],
            notes: [
              "The museum gets you a look into a box. Actual tickets: 140 gallery seats go on sale at the box office on the day.",
            ],
            about:
              "Opened 1778 and rebuilt after 1943 bombing. The exterior is deliberately plain — the point was always what happens inside.",
            address: "Via Filodrammatici 2, Milan",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "3 min", distance: "0.2 km" },
          },
          {
            name: "Brera & Pinacoteca",
            lat: 45.472,
            lng: 9.188,
            tags: ["Neighbourhood", "Gallery"],
            notes: [
              "Mantegna's Dead Christ and Piero's Brera Madonna are both here and both worth the ticket alone.",
              "The streets around it are the prettiest in central Milan.",
            ],
            about:
              "An artists' quarter of cobbled lanes around a 17th-century palace holding the city's main old-master collection.",
            address: "Via Brera 28, Milan",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "8 min", distance: "0.6 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "The Last Supper, the castle, the canals",
        stops: [
          {
            name: "Santa Maria delle Grazie",
            lat: 45.4659,
            lng: 9.1706,
            tags: ["Last Supper", "UNESCO", "Book ahead"],
            notes: [
              "Fifteen minutes, 35 people, airlock doors to control humidity. There is no way to extend it and no way to get in without a booking.",
              "Arrive 20 minutes early or they give the slot away.",
            ],
            about:
              "Leonardo painted it on a dry wall in 1495–98, which is why it started deteriorating within twenty years. The refectory survived a 1943 bomb that took the rest of the cloister.",
            address: "Piazza di Santa Maria delle Grazie 2, Milan",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Castello Sforzesco",
            lat: 45.4707,
            lng: 9.1795,
            tags: ["Castle", "Museums"],
            notes: [
              "Courtyards are free to walk through. One ticket covers all the museums inside, including Michelangelo's unfinished Rondanini Pietà.",
            ],
            about:
              "The Sforza dukes' fortress, later a barracks, now the city's municipal museum complex. Leonardo frescoed one of the rooms.",
            address: "Piazza Castello, Milan",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "13 min", distance: "1 km" },
          },
          {
            name: "Parco Sempione & Arco della Pace",
            lat: 45.4753,
            lng: 9.1725,
            tags: ["Park", "Free entry"],
            notes: [
              "Straight through behind the castle. The Torre Branca lift gives a city view for €6 and almost nobody uses it.",
            ],
            about:
              "The castle's former hunting park, laid out as an English garden in 1888, with a Napoleonic triumphal arch closing the axis.",
            address: "Piazza Sempione, Milan",
            transfer: { mode: "walk", duration: "6 min", distance: "0.5 km" },
          },
          {
            name: "Navigli",
            lat: 45.4508,
            lng: 9.173,
            tags: ["Canals", "Aperitivo", "Nightlife"],
            notes: [
              "Naviglio Grande for the buffet aperitivo, Naviglio Pavese for fewer tourists.",
              "Last Sunday of the month is the antiques market along the whole canal.",
            ],
            about:
              "The surviving canals of a medieval system Leonardo worked on, used to barge in the marble for the Duomo. Now the city's drinking quarter.",
            address: "Naviglio Grande, Milan",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "metro", duration: "14 min", distance: "3 km" },
          },
        ],
      },
      {
        title: "Day 3 (half day)",
        summary: "Modern Milan before the airport",
        stops: [
          {
            name: "Fondazione Prada",
            lat: 45.4386,
            lng: 9.1953,
            tags: ["Contemporary art", "Architecture"],
            notes: [
              "Bar Luce in the courtyard was designed by Wes Anderson and looks precisely as you'd expect.",
            ],
            about:
              "A converted 1910 gin distillery reworked by OMA, including a tower entirely clad in gold leaf.",
            address: "Largo Isarco 2, Milan",
            priceLevel: 2,
          },
          {
            name: "Bosco Verticale & Porta Nuova",
            lat: 45.4859,
            lng: 9.1913,
            tags: ["Architecture", "Free entry"],
            notes: [
              "You can't go in — it's private flats. Walk the raised Piazza Gae Aulenti behind it instead.",
            ],
            about:
              "Two residential towers carrying 900 trees on their balconies, and the centrepiece of the business district that replaced the old railway yards.",
            address: "Via Gaetano de Castillia 11, Milan",
            highlight: true,
            transfer: { mode: "metro", duration: "18 min", distance: "5 km" },
          },
          {
            name: "Mercato Centrale Milano",
            lat: 45.4864,
            lng: 9.205,
            tags: ["Food hall", "Lunch"],
            notes: [
              "Inside Stazione Centrale, so it is the correct last stop before a train or the airport bus.",
            ],
            about:
              "Independent food counters under the vaults of the 1931 station — pasta, pizza al taglio, and a decent coffee roaster.",
            address: "Via Giovanni Battista Sammartini 2, Milan",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "7 min", distance: "0.6 km" },
          },
        ],
      },
    ],
  },

  "the-ultimate-italy-guide": {
    slug: "the-ultimate-italy-guide",
    heroTitle: "The Ultimate Italy Guide",
    heroAccent: "ten days, north to south",
    publishedAt: "April 4, 2026",
    tags: ["10-day itinerary", "Italy guide", "€€ mid-range"],
    intro:
      "Italy always feels like home. Ten days is not enough for the country, but it is exactly enough for Rome, Florence, one stretch of coast and Venice, without ever spending more than four hours on a train.",
    bestTime: "May",
    currency: "€",
    generalTips: [
      "Take the trains. Rome–Florence is 1h35, Florence–Venice is 2h. Book Frecciarossa or Italo weeks ahead and the fares are a third of the walk-up price.",
      "Every major sight — Colosseum, Vatican, Uffizi, Accademia, Doge's Palace — is timed-entry now. Book all five before you fly, in one sitting.",
      "Coffee standing at the bar costs a third of coffee at a table, by law, and the price is posted. This is not a scam either way.",
      "Museums close on Mondays with maddening inconsistency. The Uffizi and the Vatican do; the Colosseum doesn't. Check the day you build the plan around.",
    ],
    days: [
      {
        title: "Days 1–3",
        summary: "Rome",
        stops: [
          {
            name: "Colosseum",
            lat: 41.8902,
            lng: 12.4922,
            tags: ["Amphitheatre", "UNESCO", "Book ahead"],
            notes: [
              "The €18 ticket includes the Forum and Palatine and is valid over 24 hours — do the Colosseum late, the Forum next morning.",
              "The arena-floor and underground add-ons are separate and sell out first.",
            ],
            about:
              "Fifty thousand seats, finished in AD 80. Two-thirds of the original stone was quarried away for Renaissance palaces, which is why it looks like a cross-section.",
            address: "Piazza del Colosseo 1, Rome",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Roman Forum & Palatine Hill",
            lat: 41.8925,
            lng: 12.4853,
            tags: ["Ruins", "UNESCO"],
            notes: [
              "Enter at the Palatine gate on Via di San Gregorio — the Forum entrance queue is three times longer for the same ticket.",
            ],
            about:
              "The civic centre of the republic and empire, with the hill above it where the emperors actually lived.",
            address: "Via della Salara Vecchia 5/6, Rome",
            transfer: { mode: "walk", duration: "6 min", distance: "0.4 km" },
          },
          {
            name: "Pantheon",
            lat: 41.8986,
            lng: 12.4769,
            tags: ["Temple", "Church"],
            notes: [
              "€5 now, and worth booking to skip the piazza queue.",
              "Go when it rains. The oculus is open and the drainage in the floor is original.",
            ],
            about:
              "A 2nd-century concrete dome still the largest unreinforced one on earth, continuously in use for 1,900 years.",
            address: "Piazza della Rotonda, Rome",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "16 min", distance: "1.3 km" },
          },
          {
            name: "Vatican Museums & Sistine Chapel",
            lat: 41.9065,
            lng: 12.4536,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Book the earliest slot there is. By 11am the Raphael Rooms corridor is a single shuffling mass.",
              "The shortcut door from the Sistine Chapel into St Peter's is officially for tour groups; join the end of one and nobody checks.",
            ],
            about:
              "Seven kilometres of galleries ending in Michelangelo's ceiling. Closed Sundays except the last of the month, when it is free and unbearable.",
            address: "Viale Vaticano, Vatican City",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "St Peter's Basilica",
            lat: 41.9022,
            lng: 12.4539,
            tags: ["Basilica", "Free entry", "Dome climb"],
            notes: [
              "The basilica is free; the dome is €10 and 551 steps, the last hundred at a lean.",
              "Security queue wraps the colonnade by 10am. First thing or after 4pm.",
            ],
            about:
              "Bramante, Michelangelo, Maderno and Bernini across 120 years. The Pietà is immediately on the right, behind glass since 1972.",
            address: "Piazza San Pietro, Vatican City",
            transfer: { mode: "walk", duration: "12 min", distance: "0.9 km" },
          },
          {
            name: "Trastevere",
            lat: 41.889,
            lng: 12.47,
            tags: ["Neighbourhood", "Dinner"],
            notes: [
              "Cross the river for dinner every night. Piazza di Santa Maria after dark is the best free entertainment in Rome.",
              "Eat west of Viale di Trastevere, not east.",
            ],
            about:
              "Ivy, cobbles and a 12th-century mosaic façade, on the unfashionable bank that became the city's favourite dinner destination.",
            address: "Trastevere, Rome",
            priceLevel: 2,
            highlight: true,
          },
        ],
      },
      {
        title: "Days 4–5",
        summary: "Florence",
        stops: [
          {
            name: "Duomo & Brunelleschi's Dome",
            lat: 43.7731,
            lng: 11.256,
            tags: ["Cathedral", "Dome climb", "Book ahead"],
            notes: [
              "463 steps between the two shells of the dome, timed entry, and no way to turn back once you start.",
              "The Brunelleschi Pass covers the dome, campanile, baptistery and museum for €30 over three days.",
            ],
            about:
              "The largest masonry dome ever built, raised without centering between 1420 and 1436 by a goldsmith who refused to explain how.",
            address: "Piazza del Duomo, Florence",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Galleria degli Uffizi",
            lat: 43.7678,
            lng: 11.2553,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Botticelli is in rooms 10–14 and everyone goes straight there. Start at the far end and work backwards.",
              "Closed Mondays.",
            ],
            about:
              "The Medici's private collection in Vasari's 1560 office building — arguably the single most important room-for-room art collection in the world.",
            address: "Piazzale degli Uffizi 6, Florence",
            priceLevel: 2,
          },
          {
            name: "Galleria dell'Accademia",
            lat: 43.7768,
            lng: 11.2585,
            tags: ["Museum", "David", "Book ahead"],
            notes: [
              "Forty minutes is a full visit. The unfinished Prisoners in the corridor before David are, honestly, more interesting.",
            ],
            about:
              "Built to house the David when it was moved indoors in 1873 after 370 years in the Piazza della Signoria.",
            address: "Via Ricasoli 58/60, Florence",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "11 min", distance: "0.8 km" },
          },
          {
            name: "Ponte Vecchio",
            lat: 43.768,
            lng: 11.2531,
            tags: ["Bridge", "Free entry"],
            notes: [
              "See it from the Ponte Santa Trinita, one bridge west — that's the view, not the bridge itself.",
            ],
            about:
              "Shops have stood on it since the 13th century — butchers until 1593, goldsmiths ever since. The only Florence bridge the Germans didn't blow up in 1944.",
            address: "Ponte Vecchio, Florence",
            transfer: { mode: "walk", duration: "10 min", distance: "0.8 km" },
          },
          {
            name: "Piazzale Michelangelo",
            lat: 43.7629,
            lng: 11.265,
            tags: ["Viewpoint", "Free entry", "Sunset"],
            notes: [
              "Climb the steps from Piazza Poggi rather than taking the bus, and carry on up to San Miniato al Monte above it — the view is the same and there is nobody there.",
            ],
            about:
              "A 19th-century terrace on the south bank with the whole city, the dome and the hills lined up behind it.",
            address: "Piazzale Michelangelo, Florence",
            highlight: true,
            transfer: { mode: "walk", duration: "22 min", distance: "1.6 km" },
          },
        ],
      },
      {
        title: "Day 6",
        summary: "Tuscany — Siena and San Gimignano",
        stops: [
          {
            name: "Piazza del Campo, Siena",
            lat: 43.3183,
            lng: 11.3316,
            tags: ["Square", "Free entry"],
            notes: [
              "Sit on the brick fan and do nothing for an hour. That is the correct use of it.",
              "Climb the Torre del Mangia for €10 — 400 steps, timed, 25 people at once.",
            ],
            about:
              "A shell-shaped square sloping to the town hall, and twice a summer the track for the Palio horse race.",
            address: "Piazza del Campo, Siena",
            highlight: true,
          },
          {
            name: "Duomo di Siena",
            lat: 43.3175,
            lng: 11.3288,
            tags: ["Cathedral", "Mosaic floor"],
            notes: [
              "The inlaid marble floor is uncovered only from late June to October. Outside that window it's under boards.",
            ],
            about:
              "Banded black and white marble inside and out, with a Pinturicchio-frescoed library off the nave and an unfinished nave outside that shows how much bigger it was meant to be.",
            address: "Piazza del Duomo 8, Siena",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "7 min", distance: "0.5 km" },
          },
          {
            name: "San Gimignano",
            lat: 43.4677,
            lng: 11.0431,
            tags: ["Hill town", "UNESCO"],
            notes: [
              "Fourteen towers left of an original seventy-two.",
              "The gelato place on the main square has won the world championship twice and the queue reflects it.",
            ],
            about:
              "A medieval skyline of family towers on a Tuscan ridge, unchanged since a plague in 1348 froze the town in place.",
            address: "San Gimignano, Siena",
            transfer: { mode: "car", duration: "50 min", distance: "42 km" },
          },
        ],
      },
      {
        title: "Days 7–8",
        summary: "Cinque Terre",
        stops: [
          {
            name: "Vernazza",
            lat: 44.135,
            lng: 9.684,
            tags: ["Village", "Harbour", "Swimming"],
            notes: [
              "The prettiest of the five and the one to stay in. Book months ahead — there are maybe 200 beds.",
              "Climb to the Doria castle for €1.50 for the view down onto the harbour.",
            ],
            about:
              "A natural harbour with houses stacked around it, and the only proper anchorage on this stretch of the Ligurian coast.",
            address: "Vernazza, La Spezia",
            highlight: true,
          },
          {
            name: "Sentiero Azzurro (Blue Trail)",
            lat: 44.1405,
            lng: 9.6693,
            tags: ["Coastal hike", "Ticket required"],
            notes: [
              "Monterosso–Vernazza is the hardest and best section: 2 hours, a lot of steps, and no shade.",
              "Sections close after rain and stay closed for months. Check the day before, not the week before.",
            ],
            about:
              "The cliff path linking all five villages. A Cinque Terre Card covers the trail and unlimited trains between them.",
            address: "Cinque Terre National Park",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "5 min", distance: "0.3 km" },
          },
          {
            name: "Monterosso al Mare",
            lat: 44.1461,
            lng: 9.6547,
            tags: ["Village", "Beach"],
            notes: [
              "The only one of the five with a real sand beach, and therefore the only one to swim properly at.",
            ],
            about:
              "The northernmost and largest village, split into an old town and a resort half by a headland tunnel.",
            address: "Monterosso al Mare, La Spezia",
            transfer: { mode: "train", duration: "4 min", distance: "3 km" },
          },
          {
            name: "Manarola",
            lat: 44.1069,
            lng: 9.7276,
            tags: ["Village", "Sunset"],
            notes: [
              "The Nessun Dorma bar terrace has the famous view. Put your name down when you arrive, then swim while you wait.",
            ],
            about:
              "Houses stacked on a black rock above a tiny inlet, and the oldest of the five villages.",
            address: "Manarola, La Spezia",
            highlight: true,
            transfer: { mode: "train", duration: "9 min", distance: "6 km" },
          },
        ],
      },
      {
        title: "Days 9–10",
        summary: "Venice",
        stops: [
          {
            name: "Basilica di San Marco",
            lat: 45.4341,
            lng: 12.3388,
            tags: ["Basilica", "Mosaics", "Book ahead"],
            notes: [
              "€3 to book a slot and skip a two-hour queue. Obviously do that.",
              "Pay the extra for the Pala d'Oro and the loggia with the bronze horses.",
            ],
            about:
              "Eight thousand square metres of gold mosaic over a Byzantine plan, built to house the body of St Mark, stolen from Alexandria in 828.",
            address: "Piazza San Marco 328, Venice",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Doge's Palace",
            lat: 45.4337,
            lng: 12.3402,
            tags: ["Palace", "Book ahead"],
            notes: [
              "The Secret Itineraries tour gets you into the prisons and Casanova's cell, and must be booked separately.",
            ],
            about:
              "The seat of the Venetian Republic for a thousand years, linked to its prison by the Bridge of Sighs.",
            address: "Piazza San Marco 1, Venice",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "2 min", distance: "0.1 km" },
          },
          {
            name: "Rialto Market",
            lat: 45.4404,
            lng: 12.3346,
            tags: ["Market", "Morning only"],
            notes: [
              "Fish market Tuesday to Saturday, mornings only, done by 1pm. Closed Mondays.",
              "The bacari around it do cicchetti and an ombra for a couple of euros — that's lunch.",
            ],
            about:
              "The commercial heart of the city since the 11th century, just north of the bridge of the same name.",
            address: "Campo de la Pescaria, Venice",
            priceLevel: 1,
          },
          {
            name: "Burano",
            lat: 45.4853,
            lng: 12.4167,
            tags: ["Island", "Lace", "Day trip"],
            notes: [
              "Vaporetto 12 from Fondamente Nove, 45 minutes. Combine with Torcello, one stop further, for the 7th-century basilica.",
            ],
            about:
              "A lagoon fishing island where every house is painted a different saturated colour, by regulation, so fishermen could find them in fog.",
            address: "Burano, Venice",
            highlight: true,
            transfer: { mode: "ferry", duration: "45 min", distance: "9 km" },
          },
        ],
      },
    ],
  },

  "switzerland-by-rail": {
    slug: "switzerland-by-rail",
    heroTitle: "Switzerland by Rail",
    heroAccent: "nine days, one pass",
    publishedAt: "July 21, 2025",
    tags: ["9-day itinerary", "Rail travel", "CHF premium"],
    intro:
      "Nine days, one Swiss Travel Pass, and no car at any point. Switzerland is the one country where the train genuinely is the best way to see everything — the routes below are chosen so the journeys are as good as the destinations.",
    bestTime: "July",
    currency: "CHF",
    generalTips: [
      "A 8-day consecutive Swiss Travel Pass is around CHF 419 second class and covers trains, buses, boats, 90 city transport networks and free entry to 500 museums. Work out your route first, then price it against point-to-point.",
      "It does NOT fully cover the mountain railways: Jungfraujoch, Gornergrat and Pilatus are separately ticketed, with a 25–50% pass discount.",
      "Seat reservations are not needed on ordinary trains and are compulsory on the panoramic ones (Glacier Express, Bernina). Book those the moment your dates are fixed.",
      "Check the webcams before paying for any summit. CHF 250 to stand in cloud is the classic Swiss mistake.",
    ],
    days: [
      {
        title: "Days 1–2",
        summary: "Lucerne and Mount Pilatus",
        stops: [
          {
            name: "Chapel Bridge (Kapellbrücke)",
            lat: 47.0517,
            lng: 8.3076,
            tags: ["Bridge", "Free entry"],
            notes: [
              "Oldest covered wooden bridge in Europe, 1365 — though most of it was rebuilt after a 1993 fire.",
              "The painted panels in the roof gables are the bit people walk under without looking up.",
            ],
            about:
              "Crosses the Reuss at the mouth of the lake, with the octagonal water tower halfway along.",
            address: "Kapellbrücke, Lucerne",
          },
          {
            name: "Lion Monument",
            lat: 47.0583,
            lng: 8.3105,
            tags: ["Monument", "Free entry"],
            notes: [
              "Ten minutes' walk from the old town and takes five minutes to see. Go anyway.",
            ],
            about:
              "A dying lion carved into a cliff face in 1821, commemorating the Swiss Guards killed at the Tuileries in 1792. Mark Twain called it the saddest piece of stone in the world.",
            address: "Denkmalstrasse 4, Lucerne",
            transfer: { mode: "walk", duration: "12 min", distance: "0.9 km" },
          },
          {
            name: "Mount Pilatus",
            lat: 46.979,
            lng: 8.2528,
            tags: ["Mountain", "Cogwheel railway"],
            notes: [
              "Do the Golden Round Trip: boat across the lake, the world's steepest cogwheel railway up (48%), cable car and gondola down.",
              "The cogwheel line only runs May to November.",
            ],
            about:
              "2,128m directly above Lucerne. On a clear day you can see 73 Alpine peaks from the terrace.",
            address: "Schlossweg 1, Kriens",
            priceLevel: 4,
            highlight: true,
            transfer: { mode: "ferry", duration: "60 min", distance: "12 km" },
          },
        ],
      },
      {
        title: "Days 3–5",
        summary: "The Bernese Oberland",
        stops: [
          {
            name: "Lauterbrunnen valley",
            lat: 46.5934,
            lng: 7.9088,
            tags: ["Valley", "Waterfalls", "Base"],
            notes: [
              "Seventy-two waterfalls in one U-shaped valley. Stay here rather than Interlaken — it's 20 minutes closer to everything.",
              "Trümmelbach Falls, inside the mountain, is the one to pay for.",
            ],
            about:
              "The valley Tolkien is said to have based Rivendell on, with 300-metre cliffs on both sides and the Staubbach falls dropping straight off the western wall.",
            address: "Lauterbrunnen, Bern",
            highlight: true,
          },
          {
            name: "Jungfraujoch",
            lat: 46.5474,
            lng: 7.9855,
            tags: ["Summit", "Railway", "Expensive"],
            notes: [
              "'Top of Europe' — the highest railway station on the continent at 3,454m. Around CHF 210 return with a pass discount.",
              "Only worth it in clear weather. Check the summit webcam at breakfast and change plans without regret.",
            ],
            about:
              "A tunnel bored through the Eiger and Mönch between 1896 and 1912, ending at a saddle between two 4,000m peaks above the Aletsch Glacier.",
            address: "Jungfraujoch, Bern",
            priceLevel: 4,
            transfer: { mode: "train", duration: "75 min", distance: "18 km" },
          },
          {
            name: "Schilthorn / Piz Gloria",
            lat: 46.5578,
            lng: 7.8351,
            tags: ["Summit", "Cable car", "Cheaper"],
            notes: [
              "Half the price of Jungfraujoch and, for the view of the Eiger–Mönch–Jungfrau wall, arguably better.",
              "Via Mürren, which is car-free and worth an afternoon in itself.",
            ],
            about:
              "2,970m, with a revolving restaurant built for the 1969 Bond film that was shot here while it was still being finished.",
            address: "Schilthorn, Mürren",
            priceLevel: 3,
          },
          {
            name: "Grindelwald First",
            lat: 46.6242,
            lng: 8.0414,
            tags: ["Cliff walk", "Hike"],
            notes: [
              "The Cliff Walk is free with the gondola ticket. Bachalpsee is an hour's easy walk from the top station and is the classic reflection photo.",
            ],
            about:
              "A gondola from Grindelwald to 2,166m, with a walkway bolted round the cliff face and a series of engineered descents back down.",
            address: "Dorfstrasse 187, Grindelwald",
            priceLevel: 3,
            transfer: { mode: "train", duration: "40 min", distance: "20 km" },
          },
        ],
      },
      {
        title: "Day 6",
        summary: "Bern, on the way west",
        stops: [
          {
            name: "Bern Old Town",
            lat: 46.948,
            lng: 7.4474,
            tags: ["UNESCO", "Arcades"],
            notes: [
              "Six kilometres of covered arcades — the longest weather-proof shopping promenade in Europe.",
              "The Zytglogge clock performs four minutes before every hour, not on it.",
            ],
            about:
              "A medieval capital inside a loop of the Aare, essentially unchanged since a 1405 fire forced it to be rebuilt in sandstone.",
            address: "Altstadt, Bern",
            highlight: true,
          },
          {
            name: "Aare river swim",
            lat: 46.9435,
            lng: 7.4575,
            tags: ["Swimming", "Free entry", "Local"],
            notes: [
              "Locals float down from the Eichholz campsite to the Marzili pool and walk back. The current is strong — get out at the handrails, they are the only exit.",
            ],
            about:
              "Glacier-fed, about 18°C in August, and the thing the whole city does after work on a hot day.",
            address: "Marzilistrasse, Bern",
            transfer: { mode: "walk", duration: "15 min", distance: "1.2 km" },
          },
        ],
      },
      {
        title: "Days 7–8",
        summary: "Zermatt and the Gornergrat",
        stops: [
          {
            name: "Zermatt",
            lat: 46.0207,
            lng: 7.7491,
            tags: ["Village", "Car-free"],
            notes: [
              "No cars at all — you park in Täsch and take the shuttle train up.",
              "The Matterhorn is visible from the main street. Walk to the Kirchbrücke for the classic composition.",
            ],
            about:
              "A mountaineering village at 1,600m that has run on the Matterhorn since Whymper's first ascent in 1865 killed four of his party on the descent.",
            address: "Zermatt, Valais",
            priceLevel: 3,
          },
          {
            name: "Gornergrat",
            lat: 45.9834,
            lng: 7.7847,
            tags: ["Cogwheel railway", "Viewpoint"],
            notes: [
              "Sit on the RIGHT going up. This is not negotiable.",
              "Walk down one or two stations to Riffelberg — an hour, all downhill, with the Matterhorn in front of you the whole way.",
            ],
            about:
              "An open-air cogwheel railway climbing to 3,089m, facing 29 peaks over 4,000m including the Matterhorn and Monte Rosa.",
            address: "Gornergrat, Zermatt",
            priceLevel: 4,
            highlight: true,
            transfer: { mode: "train", duration: "33 min", distance: "9 km" },
          },
          {
            name: "Riffelsee",
            lat: 45.9902,
            lng: 7.7621,
            tags: ["Lake", "Reflection", "Free entry"],
            notes: [
              "The reflection shot needs still air, which means before about 10am.",
            ],
            about:
              "A small tarn one stop below the Gornergrat summit, positioned so the Matterhorn lands square in it.",
            address: "Rotenboden, Zermatt",
            transfer: { mode: "walk", duration: "10 min", distance: "0.6 km" },
          },
        ],
      },
      {
        title: "Day 9",
        summary: "The Glacier Express east",
        stops: [
          {
            name: "Glacier Express",
            lat: 46.6167,
            lng: 8.3333,
            tags: ["Panoramic train", "Book ahead", "8 hours"],
            notes: [
              "Zermatt to St Moritz, 291 bridges, 91 tunnels, eight hours, and it is billed as the slowest express train in the world.",
              "Reservation is compulsory and separate from the pass — around CHF 49 in summer.",
            ],
            about:
              "The route crosses the Oberalp Pass at 2,033m and the Landwasser Viaduct, which curves straight into a cliff face.",
            address: "Andermatt, Uri",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "St Moritz",
            lat: 46.4908,
            lng: 9.8355,
            tags: ["Resort", "Lake"],
            notes: [
              "Expensive even by Swiss standards. Walk the lake path and eat one village over in Pontresina.",
            ],
            about:
              "The Engadine resort that effectively invented winter tourism in 1864 on a hotelier's bet, and has hosted two Winter Olympics since.",
            address: "St Moritz, Graubünden",
            priceLevel: 4,
            transfer: {
              mode: "train",
              duration: "480 min",
              distance: "291 km",
            },
          },
        ],
      },
    ],
  },

  "tokyo-after-dark": {
    slug: "tokyo-after-dark",
    heroTitle: "Tokyo After Dark",
    heroAccent: "four nights",
    publishedAt: "December 9, 2025",
    tags: ["4-night itinerary", "Food & nightlife", "¥¥ mid-range"],
    intro:
      "This is a night guide. Days are yours; every entry below starts somewhere between 5pm and midnight, and the running order is built around where the last train leaves from. Tokyo's best rooms hold eight people and have no sign on the door.",
    bestTime: "November",
    currency: "¥",
    generalTips: [
      "Last trains run around 00:30 and there is no night service. Either finish by midnight or commit to staying out until 5am — the middle is a ¥8,000 taxi.",
      "Many small bars charge a table seating fee (otōshi, ¥300–800) that arrives as a small dish you didn't order. It's not a scam, it's rent.",
      "Cash still matters in yokocho alleys. Draw ¥20,000 at a 7-Eleven ATM — they take foreign cards when bank ATMs don't.",
      "'No foreigners' signs are usually a language-capacity problem, not hostility. A translation app on the table solves it more often than not.",
    ],
    days: [
      {
        title: "Night 1",
        summary: "Shinjuku — the alleys",
        stops: [
          {
            name: "Omoide Yokocho",
            lat: 35.6934,
            lng: 139.6994,
            tags: ["Yakitori", "Alley", "Standing bars"],
            notes: [
              "'Memory Lane', and still known locally by its older, ruder name. Sixty tiny yakitori counters under the tracks.",
              "Smoky, cramped, six seats a bar. Eat at two or three, not one.",
            ],
            about:
              "A surviving block of post-war black-market stalls on the west side of Shinjuku station, saved from redevelopment more or less by accident.",
            address: "1 Chome Nishishinjuku, Shinjuku City, Tokyo",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Golden Gai",
            lat: 35.6939,
            lng: 139.7043,
            tags: ["Bars", "Late night"],
            notes: [
              "Six alleys, 200-odd bars, most seating five to eight people. Look for the ones with English menus taped outside if it's your first visit.",
              "Cover charges are ¥500–1,500 and posted at the door. Read before you climb the stairs.",
            ],
            about:
              "A block of two-storey shacks that survived every wave of Shinjuku development, each bar a different owner's obsession — jazz, punk, film, one that only plays 1960s French pop.",
            address: "1 Chome Kabukicho, Shinjuku City, Tokyo",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "12 min", distance: "0.9 km" },
          },
          {
            name: "Tokyo Metropolitan Gov. Building",
            lat: 35.6896,
            lng: 139.6921,
            tags: ["Observation deck", "Free entry"],
            notes: [
              "202m, free, open until 10pm. The single best-value view in Tokyo.",
              "North tower stays open later than the south.",
            ],
            about:
              "Kenzō Tange's twin-towered city hall, with public observatories on the 45th floor of both towers.",
            address: "2 Chome-8-1 Nishishinjuku, Shinjuku City, Tokyo",
            transfer: { mode: "walk", duration: "14 min", distance: "1.1 km" },
          },
        ],
      },
      {
        title: "Night 2",
        summary: "Shibuya and Ebisu",
        stops: [
          {
            name: "Shibuya Crossing",
            lat: 35.6595,
            lng: 139.7005,
            tags: ["Crossing", "Free entry"],
            notes: [
              "Watch it from the Starbucks upstairs in Tsutaya, or from the free walkway in Shibuya Scramble Square's lower floors.",
              "Peak flow is around 7pm on a Friday — roughly 3,000 people per light change.",
            ],
            about:
              "Five crossings released at once from every direction. The most photographed intersection on earth and it still works as a functioning junction.",
            address: "2 Chome Dogenzaka, Shibuya City, Tokyo",
          },
          {
            name: "Nonbei Yokocho",
            lat: 35.66,
            lng: 139.7015,
            tags: ["Alley bars", "Tiny"],
            notes: [
              "'Drunkard's Alley' — two lanes of bars beside the Yamanote tracks, most seating four.",
              "Almost nobody who visits Shibuya finds it, despite it being 90 seconds from the crossing.",
            ],
            about:
              "A 1950s survivor squeezed against the railway embankment north of the station, unchanged while everything around it was rebuilt twice.",
            address: "1 Chome-25 Shibuya, Shibuya City, Tokyo",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "walk", duration: "5 min", distance: "0.4 km" },
          },
          {
            name: "Ebisu Yokocho",
            lat: 35.6467,
            lng: 139.71,
            tags: ["Indoor market", "Izakaya"],
            notes: [
              "An indoor food alley in an old market building — twenty stalls sharing communal tables. Loud, cheap, easy for a group.",
              "Nobody minds if you order from three stalls at once.",
            ],
            about:
              "Ebisu is where Tokyo's twenty-somethings drink when Shibuya feels too young. This is its front door.",
            address: "1 Chome-7-4 Ebisu, Shibuya City, Tokyo",
            priceLevel: 2,
            transfer: { mode: "train", duration: "6 min", distance: "1.6 km" },
          },
        ],
      },
      {
        title: "Night 3",
        summary: "Old Tokyo — Asakusa and the river",
        stops: [
          {
            name: "Sensō-ji",
            lat: 35.7148,
            lng: 139.7967,
            tags: ["Temple", "Free entry", "Open late"],
            notes: [
              "The grounds never close and the lanterns are lit until 11pm. After 8pm you can have the main hall almost to yourself.",
              "Nakamise shopping street shutters at 6 — the painted metal shutters are themselves worth seeing.",
            ],
            about:
              "Tokyo's oldest temple, founded in 645 around a statue two fishermen pulled from the Sumida. Rebuilt in concrete after 1945 bombing.",
            address: "2 Chome-3-1 Asakusa, Taito City, Tokyo",
            highlight: true,
          },
          {
            name: "Hoppy Street",
            lat: 35.7136,
            lng: 139.7938,
            tags: ["Izakaya", "Outdoor seating"],
            notes: [
              "Plastic stools on the pavement, motsunikomi stew, and hoppy — a near-beer you mix with shōchū yourself.",
              "Starts early and is done by 10pm. This is an early evening, not a late one.",
            ],
            about:
              "A two-block strip behind Sensō-ji where every restaurant spills onto the street, named for the drink it runs on.",
            address: "2 Chome Asakusa, Taito City, Tokyo",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "5 min", distance: "0.4 km" },
          },
          {
            name: "Tokyo Skytree",
            lat: 35.7101,
            lng: 139.8107,
            tags: ["Tower", "Viewpoint", "Book ahead"],
            notes: [
              "634m. Book the timed slot online — the walk-up queue is an hour and costs more.",
              "The lower deck at 350m is enough; the 450m deck adds height and not much view.",
            ],
            about:
              "The tallest tower in the world, on the far bank of the Sumida, lit in two alternating colour schemes named for Edo aesthetics.",
            address: "1 Chome-1-2 Oshiage, Sumida City, Tokyo",
            priceLevel: 3,
            transfer: { mode: "walk", duration: "20 min", distance: "1.6 km" },
          },
        ],
      },
      {
        title: "Night 4",
        summary: "West side — Shimokitazawa and Nakameguro",
        stops: [
          {
            name: "Nakameguro canal",
            lat: 35.644,
            lng: 139.6989,
            tags: ["Canal", "Bars", "Walk"],
            notes: [
              "Start at the station and walk the Meguro river south. Every third doorway is a bar or a record shop.",
              "In late March this is the best cherry blossom in the city, lit at night.",
            ],
            about:
              "A canal-side neighbourhood of low-rise independents that has stayed stubbornly un-chained despite becoming fashionable a decade ago.",
            address: "Nakameguro, Meguro City, Tokyo",
            highlight: true,
          },
          {
            name: "Shimokitazawa",
            lat: 35.6613,
            lng: 139.668,
            tags: ["Vintage", "Live houses", "Bars"],
            notes: [
              "Streets are too narrow for cars, which is the whole character of it.",
              "Live houses here are where most Japanese indie bands start. Cover is usually ¥2,500 with a drink.",
            ],
            about:
              "A student and musician quarter of second-hand shops, tiny theatres and basement venues, ten minutes west of Shibuya.",
            address: "Kitazawa, Setagaya City, Tokyo",
            priceLevel: 2,
            transfer: { mode: "train", duration: "13 min", distance: "4 km" },
          },
          {
            name: "Harmonica Yokocho, Kichijōji",
            lat: 35.7036,
            lng: 139.5793,
            tags: ["Alley bars", "Local"],
            notes: [
              "Named because the stalls are packed like harmonica reeds. Almost no tourists get this far west.",
              "Kichijōji is 20 minutes from Shinjuku and consistently voted the place Tokyoites most want to live.",
            ],
            about:
              "A hundred-odd micro-bars and stalls in a post-war market block by the station, half of them opened in the last ten years by people who grew up here.",
            address: "1 Chome Kichijoji Honcho, Musashino, Tokyo",
            priceLevel: 2,
            transfer: { mode: "train", duration: "16 min", distance: "8 km" },
          },
        ],
      },
    ],
  },

  "new-york-city-long-weekend": {
    slug: "new-york-city-long-weekend",
    heroTitle: "New York City Long Weekend",
    heroAccent: "four days, no car",
    publishedAt: "October 2, 2025",
    tags: ["4-day itinerary", "City break", "$$ mid-range"],
    intro:
      "Four days is enough for New York if you stop trying to see all of it. One borough per day, everything on the subway, and at least one afternoon with nothing planned — the city is better wandered than scheduled.",
    bestTime: "October",
    currency: "$",
    generalTips: [
      "OMNY: tap the same contactless card or phone at every turnstile and it caps at $34 a week automatically. Don't buy a MetroCard.",
      "The free ferry to Staten Island passes the Statue of Liberty and costs nothing. The $25 boat gets you closer; the ferry gets you the skyline.",
      "Museums with 'suggested admission' — the Met is only pay-what-you-wish for New York State residents now. The Bronx Zoo and the Brooklyn Botanic have genuine free windows.",
      "Avenues run north–south, streets east–west, and addresses go up as you go north. Once that clicks you will never need a map in Manhattan again.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Midtown and the park",
        stops: [
          {
            name: "Grand Central Terminal",
            lat: 40.7527,
            lng: -73.9772,
            tags: ["Station", "Free entry", "Architecture"],
            notes: [
              "Stand in the whispering gallery outside the Oyster Bar — diagonal corners, and it genuinely works.",
              "The ceiling constellation is backwards. Nobody has ever satisfactorily explained why.",
            ],
            about:
              "1913 Beaux-Arts, saved from demolition in the 1970s by a campaign Jackie Onassis fronted. 44 platforms, more than any station in the world.",
            address: "89 E 42nd St, New York",
          },
          {
            name: "Top of the Rock",
            lat: 40.7593,
            lng: -73.9794,
            tags: ["Viewpoint", "Book ahead"],
            notes: [
              "Better than the Empire State for one reason: the Empire State is in the view.",
              "Book the slot 45 minutes before sunset and you get both.",
            ],
            about:
              "Three open-air decks on the 70th floor of 30 Rockefeller Plaza, looking straight down Fifth Avenue and over Central Park.",
            address: "30 Rockefeller Plaza, New York",
            priceLevel: 3,
            highlight: true,
            transfer: { mode: "walk", duration: "12 min", distance: "0.6 mi" },
          },
          {
            name: "Central Park — the Ramble & Bethesda",
            lat: 40.7829,
            lng: -73.9654,
            tags: ["Park", "Free entry"],
            notes: [
              "Enter at 72nd and walk north through the Ramble. It is the only part of the park designed to make you lose your bearings.",
              "Bethesda Terrace's undercroft has the tiled ceiling and, usually, someone singing under it.",
            ],
            about:
              "843 acres, entirely man-made — Olmsted and Vaux moved more earth building it than was moved digging the Suez Canal.",
            address: "Central Park, New York",
            transfer: { mode: "walk", duration: "18 min", distance: "1 mi" },
          },
          {
            name: "The Metropolitan Museum of Art",
            lat: 40.7794,
            lng: -73.9632,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Pick three departments and let the rest go. Two million objects; nobody sees the Met in an afternoon.",
              "The roof garden is open May to October and has a bar.",
            ],
            about:
              "On the park's eastern edge, with a Roman temple in one wing and the American Wing's courtyard in another.",
            address: "1000 5th Ave, New York",
            priceLevel: 3,
            transfer: { mode: "walk", duration: "9 min", distance: "0.5 mi" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Downtown — the High Line to the Village",
        stops: [
          {
            name: "The High Line",
            lat: 40.748,
            lng: -74.0048,
            tags: ["Elevated park", "Free entry"],
            notes: [
              "Start at Gansevoort in the south and walk north — the planting gets wilder as you go.",
              "1.45 miles end to end and about 45 minutes at a stroll.",
            ],
            about:
              "A freight viaduct abandoned in 1980, replanted with the self-seeded meadow that had colonised it, and opened as a park in 2009.",
            address: "Gansevoort St, New York",
            highlight: true,
          },
          {
            name: "Chelsea Market",
            lat: 40.7424,
            lng: -74.0061,
            tags: ["Food hall", "Lunch"],
            notes: [
              "In the old Nabisco factory where the Oreo was invented. Busy at noon; go at 11 or 3.",
            ],
            about:
              "A block-long brick concourse of food stalls under the southern end of the High Line.",
            address: "75 9th Ave, New York",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "4 min", distance: "0.2 mi" },
          },
          {
            name: "Washington Square Park",
            lat: 40.7308,
            lng: -73.9973,
            tags: ["Park", "Free entry", "Buskers"],
            notes: [
              "The piano in the south-west corner is not a busker's gimmick — it lives there.",
              "Best on a warm Sunday afternoon, when the whole park is a performance.",
            ],
            about:
              "The centre of Greenwich Village, on top of a former potter's field holding perhaps 20,000 burials.",
            address: "Washington Square, New York",
            transfer: { mode: "walk", duration: "22 min", distance: "1.1 mi" },
          },
          {
            name: "Katz's Delicatessen",
            lat: 40.7223,
            lng: -73.9874,
            tags: ["Deli", "Cash-friendly", "Late"],
            notes: [
              "You get a ticket at the door. Do not lose it — the fine is $50 and they are not joking.",
              "Go to the carver's counter, tip a dollar, get pastrami on rye. Table service is slower and worse.",
            ],
            about:
              "Open since 1888 on Houston Street, and essentially unchanged: fluorescent lights, formica, and the best cured meat in the city.",
            address: "205 E Houston St, New York",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "walk", duration: "16 min", distance: "0.8 mi" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Brooklyn",
        stops: [
          {
            name: "Brooklyn Bridge",
            lat: 40.7061,
            lng: -73.9969,
            tags: ["Bridge", "Free entry"],
            notes: [
              "Walk Brooklyn to Manhattan, not the other way — that way the skyline is in front of you the whole time.",
              "The pedestrian and cycle lanes were separated in 2021. Stay in yours.",
            ],
            about:
              "The first steel-wire suspension bridge, opened 1883 after fourteen years and around thirty deaths, including the designer's.",
            address: "Brooklyn Bridge, New York",
            highlight: true,
          },
          {
            name: "DUMBO & Brooklyn Bridge Park",
            lat: 40.7033,
            lng: -73.9881,
            tags: ["Waterfront", "Free entry"],
            notes: [
              "Washington Street frames the Manhattan Bridge between two warehouses — that photo. Get there before 9am.",
              "Jane's Carousel is $2 and sits in a glass box on the water.",
            ],
            about:
              "Down Under the Manhattan Bridge Overpass: a converted warehouse district and 85 acres of park along the East River piers.",
            address: "Water St, Brooklyn",
          },
          {
            name: "Williamsburg",
            lat: 40.7145,
            lng: -73.9613,
            tags: ["Neighbourhood", "Food", "Bars"],
            notes: [
              "Smorgasburg runs Saturdays in Williamsburg, April to October — around 100 food vendors on the waterfront.",
              "Take the L one stop from Manhattan or the East River Ferry for the view.",
            ],
            about:
              "North Brooklyn's warehouse district turned nightlife and restaurant centre, with the Domino Sugar refinery redeveloped at its southern edge.",
            address: "Williamsburg, Brooklyn",
            priceLevel: 2,
            transfer: { mode: "ferry", duration: "14 min", distance: "2.4 mi" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "Lower Manhattan and the harbour",
        stops: [
          {
            name: "9/11 Memorial & Museum",
            lat: 40.7115,
            lng: -74.0134,
            tags: ["Memorial", "Museum"],
            notes: [
              "The plaza and the pools are free and open to all. The museum below is ticketed and takes two hours you should allow for.",
              "One survivor tree, a callery pear, stands among 400 oaks. It is signposted.",
            ],
            about:
              "Two voids in the footprints of the towers, with the names cut into bronze parapets around the falling water.",
            address: "180 Greenwich St, New York",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Staten Island Ferry",
            lat: 40.7013,
            lng: -74.0134,
            tags: ["Ferry", "Free entry", "Skyline"],
            notes: [
              "Free, every 30 minutes, 25 minutes each way. Stand on the right-hand side going out.",
              "You have to get off and re-board at St George — you can't stay on for the return.",
            ],
            about:
              "A commuter service that happens to pass Governors Island, Ellis Island and the Statue of Liberty at no charge whatsoever.",
            address: "4 Whitehall St, New York",
            transfer: { mode: "walk", duration: "12 min", distance: "0.6 mi" },
          },
          {
            name: "Oculus & Wall Street",
            lat: 40.7115,
            lng: -74.0111,
            tags: ["Architecture", "Free entry"],
            notes: [
              "Calatrava's transit hall is worth ten minutes even though it cost $4bn and everyone in the city resents it.",
            ],
            about:
              "The World Trade Center transportation hub, whose ribs align to frame the sky on every September 11th at the moment of the first impact.",
            address: "185 Greenwich St, New York",
            transfer: { mode: "walk", duration: "10 min", distance: "0.5 mi" },
          },
        ],
      },
    ],
  },

  "lisbon-on-a-shoestring": {
    slug: "lisbon-on-a-shoestring",
    heroTitle: "Lisbon on a Shoestring",
    heroAccent: "five days, under €650",
    publishedAt: "January 30, 2026",
    tags: ["5-day itinerary", "Budget", "€ cheap"],
    intro:
      "I did five days here for less than one night in London. Lisbon's best things — the viewpoints, the light, the tram ride, the hills — are free or nearly free, and the food only gets expensive if you eat where the tour groups eat.",
    bestTime: "April",
    currency: "€",
    generalTips: [
      "A Viva Viagem card is €0.50 and makes every metro, tram, bus and funicular ride €1.85 instead of €3.20 or €4. Buy one in the first ten minutes.",
      "Tram 28 costs €4 as a single from the driver and €1.85 on the Viva card. Same tram.",
      "The couvert — bread, olives, cheese — put on your table unasked is chargeable. Waving it away is completely normal and costs nothing.",
      "Lisbon is seven hills and the pavement is polished limestone. In rain it is genuinely slippery; wear something with grip.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Alfama and the castle hill",
        stops: [
          {
            name: "Miradouro das Portas do Sol",
            lat: 38.7118,
            lng: -9.1305,
            tags: ["Viewpoint", "Free entry"],
            notes: [
              "The whole of Alfama and the river below it, for nothing. The kiosk coffee is €1.",
            ],
            about:
              "A terrace on the tram 28 route where the old Moorish quarter drops away towards the Tagus in one uninterrupted sweep of tiled roofs.",
            address: "Largo Portas do Sol, Lisbon",
            highlight: true,
          },
          {
            name: "Castelo de São Jorge",
            lat: 38.7139,
            lng: -9.1335,
            tags: ["Castle", "Viewpoint"],
            notes: [
              "€15 and the view is barely better than the free miradouros below it. Skip it if money is tight — the walk up through Alfama is the real attraction.",
            ],
            about:
              "A Moorish citadel taken in 1147, on the highest of the seven hills. Peacocks, ramparts, and an archaeological site under the courtyard.",
            address: "R. de Santa Cruz do Castelo, Lisbon",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "11 min", distance: "0.6 km" },
          },
          {
            name: "Alfama backstreets",
            lat: 38.7112,
            lng: -9.1289,
            tags: ["Neighbourhood", "Free entry", "Fado"],
            notes: [
              "Get deliberately lost between the cathedral and the castle — it's the one district the 1755 earthquake didn't flatten.",
              "Fado houses charge €25+ with dinner. The small bars on Rua dos Remédios have it free with a €3 beer.",
            ],
            about:
              "A maze of stairways and washing lines that predates the grid city below it by six centuries.",
            address: "Alfama, Lisbon",
            priceLevel: 1,
          },
          {
            name: "Miradouro da Senhora do Monte",
            lat: 38.7167,
            lng: -9.133,
            tags: ["Viewpoint", "Free entry", "Sunset"],
            notes: [
              "The highest viewpoint in the city, and the sunset one. Take a bottle from the corner shop like everyone else.",
            ],
            about:
              "A small terrace under a pine in Graça, looking west over the castle and the whole downtown.",
            address: "Largo Monte, Lisbon",
            transfer: { mode: "walk", duration: "14 min", distance: "0.9 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Baixa, Chiado and Bairro Alto",
        stops: [
          {
            name: "Praça do Comércio",
            lat: 38.7075,
            lng: -9.1364,
            tags: ["Square", "Free entry", "Riverfront"],
            notes: [
              "Sit on the steps into the river. The Rua Augusta arch has a lift to the top for €3.50 and it's the cheapest good view in the city.",
            ],
            about:
              "The royal palace stood here until the 1755 earthquake and tsunami; what replaced it is Europe's grandest riverside square.",
            address: "Praça do Comércio, Lisbon",
          },
          {
            name: "Elevador de Santa Justa",
            lat: 38.7123,
            lng: -9.1393,
            tags: ["Lift", "Viewpoint"],
            notes: [
              "Don't queue and don't pay €5.30. Walk up through Chiado to the Carmo ruins and enter the top platform from behind for free.",
            ],
            about:
              "A 45-metre wrought-iron lift of 1902, built by a student of Eiffel's to connect the lower city to the Carmo square above.",
            address: "R. do Ouro, Lisbon",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "walk", duration: "6 min", distance: "0.4 km" },
          },
          {
            name: "Convento do Carmo",
            lat: 38.7118,
            lng: -9.1401,
            tags: ["Ruins", "Museum"],
            notes: [
              "€7 and the most affecting site in Lisbon — a Gothic nave left roofless since 1755 exactly as the earthquake left it.",
            ],
            about:
              "The arches stand open to the sky above the square where the 1974 Carnation Revolution ended.",
            address: "Largo do Carmo, Lisbon",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "3 min", distance: "0.2 km" },
          },
          {
            name: "Bairro Alto",
            lat: 38.7133,
            lng: -9.1462,
            tags: ["Nightlife", "Cheap drinks"],
            notes: [
              "Bars sell to the street and everyone drinks outside. A beer is €1.50–2.",
              "It doesn't start until 11pm and it stops abruptly at 2 when the noise rules kick in.",
            ],
            about:
              "A grid of 16th-century streets above Chiado that is residential by day and one continuous open-air bar by night.",
            address: "Bairro Alto, Lisbon",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "8 min", distance: "0.5 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Belém",
        stops: [
          {
            name: "Mosteiro dos Jerónimos",
            lat: 38.6979,
            lng: -9.2065,
            tags: ["Monastery", "UNESCO"],
            notes: [
              "The church is free; only the cloister is ticketed. Most of the queue is for the cloister — walk past it into the nave.",
              "Free on the first Sunday of the month.",
            ],
            about:
              "Built on the profits of the spice trade in the Manueline style — stone carved into ropes, coral and armillary spheres. Vasco da Gama is buried inside the door.",
            address: "Praça do Império, Lisbon",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Pastéis de Belém",
            lat: 38.6975,
            lng: -9.2032,
            tags: ["Bakery", "Cheap"],
            notes: [
              "€1.40 each, made to the monastery's 1837 recipe. The takeaway queue looks enormous and moves in five minutes; the sit-down rooms at the back are usually half empty.",
              "Cinnamon and icing sugar are on the table. Use both.",
            ],
            about:
              "The original custard tart, and the only place allowed to call them pastéis de Belém rather than pastéis de nata.",
            address: "R. de Belém 84-92, Lisbon",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "3 min", distance: "0.2 km" },
          },
          {
            name: "Torre de Belém",
            lat: 38.6916,
            lng: -9.216,
            tags: ["Tower", "UNESCO"],
            notes: [
              "Nice from the outside, cramped and queue-bound inside. Photograph it from the waterfront and keep the €8.",
            ],
            about:
              "A 1519 fortified lighthouse in the river, from which the ships of the discoveries departed. It once stood mid-channel; the earthquake moved the river.",
            address: "Av. Brasília, Lisbon",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "13 min", distance: "1 km" },
          },
          {
            name: "LX Factory",
            lat: 38.7027,
            lng: -9.1786,
            tags: ["Creative quarter", "Free entry"],
            notes: [
              "Sunday market, and Ler Devagar — a bookshop in a print works with the presses still in place.",
              "On the way back from Belém, under the bridge.",
            ],
            about:
              "An 1846 industrial complex under the 25 de Abril bridge, now studios, restaurants and shops in the original sheds.",
            address: "R. Rodrigues de Faria 103, Lisbon",
            transfer: { mode: "tram", duration: "12 min", distance: "3 km" },
          },
        ],
      },
      {
        title: "Day 4",
        summary: "Sintra, on the cheap",
        stops: [
          {
            name: "Quinta da Regaleira",
            lat: 38.7963,
            lng: -9.3963,
            tags: ["Estate", "Initiation well"],
            notes: [
              "Train from Rossio, €2.40 each way, 40 minutes. Walk up from Sintra station rather than paying €6 for the tourist bus.",
              "Go here first, at 9:30 opening. The spiral well fills with people by 11.",
            ],
            about:
              "A Rosicrucian fantasy of grottoes, towers and an inverted 27-metre initiation well, built by a millionaire and an opera set designer in 1904.",
            address: "R. Barbosa du Bocage 5, Sintra",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Pena Palace",
            lat: 38.7876,
            lng: -9.3906,
            tags: ["Palace", "Book ahead"],
            notes: [
              "Park-only ticket is €7.50 and gets you to the terraces where all the famous photos are taken. The interior is €14 and timed.",
              "It's a 40-minute uphill walk from town, or bus 434.",
            ],
            about:
              "A yellow-and-red Romanticist palace on a volcanic peak, built on a ruined monastery in the 1840s and frequently above the cloud line.",
            address: "Estrada da Pena, Sintra",
            priceLevel: 2,
            transfer: { mode: "bus", duration: "18 min", distance: "3.5 km" },
          },
          {
            name: "Cabo da Roca",
            lat: 38.7805,
            lng: -9.4989,
            tags: ["Cliffs", "Free entry", "Sunset"],
            notes: [
              "Bus 1624 from Sintra, covered by a day ticket. Windy in a way that is difficult to overstate.",
            ],
            about:
              "The westernmost point of continental Europe — 140-metre cliffs and, as the marker puts it, where the land ends and the sea begins.",
            address: "Cabo da Roca, Colares",
            transfer: { mode: "bus", duration: "40 min", distance: "18 km" },
          },
        ],
      },
      {
        title: "Day 5",
        summary: "Markets and the last tram",
        stops: [
          {
            name: "Feira da Ladra",
            lat: 38.7156,
            lng: -9.1249,
            tags: ["Flea market", "Free entry"],
            notes: [
              "Tuesdays and Saturdays only, from dawn. Everything from real antiques to genuine junk, and the prices reflect how early you came.",
            ],
            about:
              "The 'thieves' market', running since the 12th century, spread across Campo de Santa Clara behind the National Pantheon.",
            address: "Campo de Santa Clara, Lisbon",
            priceLevel: 1,
          },
          {
            name: "Time Out Market",
            lat: 38.7071,
            lng: -9.1459,
            tags: ["Food hall", "Lunch"],
            notes: [
              "Expensive by Lisbon standards — €12–18 a plate — but it's chef stalls at food-court prices and a fair splurge for a last lunch.",
              "The traditional market on the other side of the building is where the €5 lunch is.",
            ],
            about:
              "Half of the 1892 Mercado da Ribeira, converted in 2014 into 40 counters curated by the city magazine.",
            address: "Av. 24 de Julho 49, Lisbon",
            priceLevel: 2,
            transfer: { mode: "tram", duration: "16 min", distance: "3 km" },
          },
          {
            name: "Tram 28, end to end",
            lat: 38.7157,
            lng: -9.136,
            tags: ["Tram", "Cheap"],
            notes: [
              "Board at Martim Moniz at the start of the line for a seat — anywhere else and you stand for 40 minutes.",
              "Watch your bag. It is the most pickpocketed tram in Europe and that is not folklore.",
            ],
            about:
              "A 1930s Remodelado tram climbing from Graça through Alfama, Baixa, Chiado and Estrela on a route no modern vehicle could physically take.",
            address: "Martim Moniz, Lisbon",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "walk", duration: "14 min", distance: "1.1 km" },
          },
        ],
      },
    ],
  },

  "amsterdam-by-bike": {
    slug: "amsterdam-by-bike",
    heroTitle: "Amsterdam by Bike",
    heroAccent: "three days on two wheels",
    publishedAt: "May 28, 2025",
    tags: ["3-day itinerary", "Cycling", "€€ mid-range"],
    intro:
      "Amsterdam is flat, compact and built for bikes, and the moment you stop walking the city halves in size. Three days, one rented bike, and two day trips you can reach on it or on a train with it.",
    bestTime: "May",
    currency: "€",
    generalTips: [
      "Rent from a local shop, not the big tourist chains near Centraal — €9–12 a day instead of €20, and they'll fit the frame to you. Ask for a coaster brake bike only if you have used one before.",
      "Cycle paths are red asphalt and they are roads, not decoration. Signal with your arm, don't stop dead on them, and never stand on one to take a photograph.",
      "Lock the frame AND the front wheel to something fixed. Around 70,000 bikes a year are stolen here and an unlocked wheel is gone in seconds.",
      "Trams have right of way and their rails will eat a thin tyre — cross them at an angle, never along them.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "The canal ring and the museums",
        stops: [
          {
            name: "Rijksmuseum",
            lat: 52.36,
            lng: 4.8852,
            tags: ["Museum", "Book ahead"],
            notes: [
              "The cycle path runs straight through the middle of the building — the only museum in the world you can legally ride through.",
              "Night Watch first, at 9am opening, then everything else.",
            ],
            about:
              "The Dutch national museum, reopened in 2013 after a ten-year restoration, with the Golden Age collection in the Gallery of Honour.",
            address: "Museumstraat 1, Amsterdam",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Van Gogh Museum",
            lat: 52.3584,
            lng: 4.8811,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Timed entry only, no walk-ups at all. Book the day you book flights.",
              "Chronological across three floors — start at the top and the last room is devastating.",
            ],
            about:
              "The largest collection of his work anywhere, 200 paintings and 500 drawings, assembled from what his brother's family kept.",
            address: "Museumplein 6, Amsterdam",
            priceLevel: 3,
            transfer: { mode: "bike", duration: "3 min", distance: "0.5 km" },
          },
          {
            name: "Vondelpark",
            lat: 52.358,
            lng: 4.8686,
            tags: ["Park", "Free entry", "Cycling"],
            notes: [
              "Cycle the full 1.5km loop. Open-air theatre on summer weekends, free.",
            ],
            about:
              "An English-style landscape park of 1865, and the green centre of the city's daily life.",
            address: "Vondelpark, Amsterdam",
            transfer: { mode: "bike", duration: "4 min", distance: "0.8 km" },
          },
          {
            name: "The Nine Streets (De 9 Straatjes)",
            lat: 52.369,
            lng: 4.885,
            tags: ["Shopping", "Canals"],
            notes: [
              "Nine short streets crossing the three main canals — the best block of independent shops in the city.",
              "Walk this one. It's too busy and too interesting to ride.",
            ],
            about:
              "A grid inside the 17th-century canal ring, between the Singel and the Prinsengracht.",
            address: "De 9 Straatjes, Amsterdam",
            priceLevel: 2,
            transfer: { mode: "bike", duration: "8 min", distance: "1.6 km" },
          },
          {
            name: "Anne Frank House",
            lat: 52.3752,
            lng: 4.884,
            tags: ["Museum", "Book ahead"],
            notes: [
              "Tickets release six weeks ahead at 10am CET and are gone the same day. There is no other way in.",
              "Allow an hour, and don't plan anything demanding straight after.",
            ],
            about:
              "The canal-house annexe where eight people hid for two years, preserved unfurnished at Otto Frank's insistence.",
            address: "Westermarkt 20, Amsterdam",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "bike", duration: "5 min", distance: "0.9 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "De Pijp, the Jordaan, and north over the water",
        stops: [
          {
            name: "Albert Cuyp Market",
            lat: 52.3556,
            lng: 4.8917,
            tags: ["Market", "Street food"],
            notes: [
              "Monday to Saturday, 9–5. Get a stroopwafel made fresh on the iron, not a packet one.",
              "Raw herring from a fish stall: hold it by the tail, dip in the onions. It's a rite of passage.",
            ],
            about:
              "The largest daily street market in the Netherlands, running the length of De Pijp's main street since 1905.",
            address: "Albert Cuypstraat, Amsterdam",
            priceLevel: 1,
          },
          {
            name: "Jordaan",
            lat: 52.3747,
            lng: 4.8807,
            tags: ["Neighbourhood", "Brown cafés"],
            notes: [
              "Look for a bruin café — dark wood, sand on the floor, no music. Café Chris has been serving since 1624.",
              "The hofjes, hidden almshouse courtyards, are marked by plain doors on the street. Several let you walk in quietly.",
            ],
            about:
              "A former workers' district of narrow houses west of the canal ring, now the most sought-after postcode in the city.",
            address: "Jordaan, Amsterdam",
            priceLevel: 2,
            transfer: { mode: "bike", duration: "12 min", distance: "2.4 km" },
          },
          {
            name: "NDSM Wharf",
            lat: 52.4013,
            lng: 4.8929,
            tags: ["Art district", "Free ferry"],
            notes: [
              "The ferry behind Centraal is free and takes bikes. Fifteen minutes across the IJ.",
              "Europe's largest street-art gallery is in the old warehouse — STRAAT, and it's worth the ticket.",
            ],
            about:
              "A derelict shipyard squatted by artists in the 1990s and now a permanent creative colony of studios, containers and a beach bar.",
            address: "NDSM-Plein, Amsterdam",
            highlight: true,
            transfer: { mode: "ferry", duration: "15 min", distance: "3.5 km" },
          },
          {
            name: "EYE Filmmuseum",
            lat: 52.3839,
            lng: 4.9007,
            tags: ["Museum", "Architecture", "Riverside"],
            notes: [
              "The terrace faces south over the water at Centraal — best free view in Amsterdam Noord.",
            ],
            about:
              "A folded white building on the north bank, holding the Dutch national film archive and four cinemas.",
            address: "IJpromenade 1, Amsterdam",
            priceLevel: 2,
            transfer: { mode: "bike", duration: "9 min", distance: "2 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Out of the city — Zaanse Schans and Haarlem",
        stops: [
          {
            name: "Zaanse Schans",
            lat: 52.4742,
            lng: 4.8168,
            tags: ["Windmills", "Day trip", "Free entry"],
            notes: [
              "The village is free to walk through; only the individual mills and museums charge.",
              "Train from Centraal to Zaandijk Zaanse Schans, 17 minutes, then a ten-minute walk.",
            ],
            about:
              "Working 18th-century industrial windmills — oil, dye, sawing — relocated to one riverside site, with the wooden houses that went with them.",
            address: "Schansend 7, Zaandam",
            highlight: true,
          },
          {
            name: "Haarlem — Grote Markt",
            lat: 52.3811,
            lng: 4.6368,
            tags: ["Town square", "Day trip"],
            notes: [
              "Fifteen minutes by train from Amsterdam and it feels like the 17th century got left running.",
              "Saturday market fills the whole square.",
            ],
            about:
              "A medieval square under St Bavo's church, whose organ Mozart played at the age of ten.",
            address: "Grote Markt, Haarlem",
            priceLevel: 2,
            transfer: { mode: "train", duration: "22 min", distance: "18 km" },
          },
          {
            name: "Frans Hals Museum",
            lat: 52.377,
            lng: 4.6339,
            tags: ["Museum"],
            notes: [
              "In a 17th-century almshouse, and never busy. The group portraits are the best in the country outside the Rijksmuseum.",
            ],
            about:
              "Dedicated to Haarlem's own Golden Age painter, whose late civic guard portraits hang in the room they were painted for.",
            address: "Groot Heiligland 62, Haarlem",
            priceLevel: 2,
            transfer: { mode: "bike", duration: "5 min", distance: "0.7 km" },
          },
        ],
      },
    ],
  },

  "seoul-weekend-eats": {
    slug: "seoul-weekend-eats",
    heroTitle: "Seoul Weekend Eats",
    heroAccent: "a three-day food crawl",
    publishedAt: "August 11, 2025",
    tags: ["3-day itinerary", "Food guide", "₩₩ mid-range"],
    intro:
      "Three days, built entirely around eating. Seoul's markets open at dawn and its alleys don't close, so this runs long — pace yourself, and treat every listed stop as one dish, not a meal.",
    bestTime: "October",
    currency: "₩",
    generalTips: [
      "Get a T-money card at any convenience store. Subway rides are about ₩1,400, transfers are free, and it works on buses and in taxis.",
      "Korean meals are shared and side dishes (banchan) are free and refilled on request. Ordering one dish each for two people is the norm, not stinginess.",
      "Most street stalls are cash-only despite Korea being otherwise cashless. Carry ₩50,000 in small notes.",
      "Naver Map or KakaoMap, not Google — Google Maps has no walking directions in South Korea for legal reasons and will send you in circles.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Markets — Gwangjang and Euljiro",
        stops: [
          {
            name: "Gwangjang Market",
            lat: 37.5701,
            lng: 126.9997,
            tags: ["Market", "Street food", "Cash only"],
            notes: [
              "Bindaetteok (mung bean pancake) at the stall with the grinding stone out front, and mayak gimbap — 'narcotic' rice rolls — from the aunties in the middle aisle.",
              "Go 10am–noon. By 6pm it's a drinking crowd and the food stalls are three deep.",
            ],
            about:
              "Korea's oldest permanent market, opened 1905, with a covered food alley of about 200 stalls that has barely changed in fifty years.",
            address: "88 Changgyeonggung-ro, Jongno-gu, Seoul",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Ikseon-dong",
            lat: 37.5735,
            lng: 126.9902,
            tags: ["Hanok alleys", "Cafés"],
            notes: [
              "Coffee and a break between meals. The alleys are one person wide and the courtyards open off them without warning.",
            ],
            about:
              "A 1920s hanok village that avoided demolition and became the city's densest concentration of small restaurants and cafés inside traditional courtyard houses.",
            address: "Ikseon-dong, Jongno-gu, Seoul",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "12 min", distance: "0.9 km" },
          },
          {
            name: "Euljiro Nogari Alley",
            lat: 37.566,
            lng: 126.991,
            tags: ["Beer", "Grilled fish", "Outdoor"],
            notes: [
              "Plastic tables in the street, dried pollack grilled over coals, and beer at ₩4,000. It starts at 6pm and fills up by 7.",
            ],
            about:
              "A printing and machine-shop district by day; after dark, three streets of tables outside 1970s beer halls that have never bothered to modernise.",
            address: "Euljiro 3-ga, Jung-gu, Seoul",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "14 min", distance: "1.1 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Palace, then west to Hongdae and Yeonnam",
        stops: [
          {
            name: "Gyeongbokgung Palace",
            lat: 37.5796,
            lng: 126.977,
            tags: ["Palace", "Free in hanbok"],
            notes: [
              "Free entry if you're wearing hanbok — rental shops outside charge ₩15,000 for four hours and half the courtyard is doing it.",
              "Guard-changing ceremony at 10am and 2pm. Closed Tuesdays.",
            ],
            about:
              "The main Joseon dynasty palace of 1395, burned in the Japanese invasion, rebuilt in 1867, and largely demolished under occupation — what stands is a 40-year reconstruction still in progress.",
            address: "161 Sajik-ro, Jongno-gu, Seoul",
            priceLevel: 1,
          },
          {
            name: "Tongin Market",
            lat: 37.58,
            lng: 126.97,
            tags: ["Market", "Lunch box"],
            notes: [
              "Buy brass tokens at the info desk and use them as currency at the stalls to fill your own dosirak tray. ₩5,000 gets ten tokens.",
              "Get the oil tteokbokki — it's specific to this market.",
            ],
            about:
              "A small neighbourhood market west of the palace that invented the token lunch-box system in 2012 and now runs on it.",
            address: "18 Jahamun-ro 15-gil, Jongno-gu, Seoul",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "walk", duration: "10 min", distance: "0.8 km" },
          },
          {
            name: "Yeonnam-dong",
            lat: 37.5606,
            lng: 126.925,
            tags: ["Café street", "Park"],
            notes: [
              "The Gyeongui Line Forest Park is a disused railway turned linear park — locals call it Yeontral Park and sit on it all afternoon.",
            ],
            about:
              "A low-rise residential grid behind Hongdae that filled with small restaurants and coffee roasters once the railway went underground.",
            address: "Yeonnam-dong, Mapo-gu, Seoul",
            priceLevel: 2,
            transfer: { mode: "metro", duration: "22 min", distance: "6 km" },
          },
          {
            name: "Hongdae",
            lat: 37.5563,
            lng: 126.9236,
            tags: ["Nightlife", "Street performers", "Late"],
            notes: [
              "Buskers on the main walking street from about 8pm — it's the closest thing Seoul has to a nightly free festival.",
              "Late-night food: gopchang, or a 24-hour gamjatang place for the 3am version.",
            ],
            about:
              "The area around Hongik University's art school, and the centre of Korean indie music since the 1990s.",
            address: "Hongdae, Mapo-gu, Seoul",
            priceLevel: 2,
            transfer: { mode: "walk", duration: "11 min", distance: "0.9 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Fish market dawn, city view dusk",
        stops: [
          {
            name: "Noryangjin Fish Market",
            lat: 37.5148,
            lng: 126.9398,
            tags: ["Fish market", "Early", "Sashimi"],
            notes: [
              "Buy downstairs, take it upstairs, and a restaurant will prepare it for a ₩5,000–10,000 fee per person.",
              "Prices are negotiable and quoted higher for tourists. Walk away once and see what happens.",
            ],
            about:
              "A 24-hour wholesale market of around 700 stalls, rehoused in 2016 in a building the old traders spent years resisting.",
            address: "674 Nodeul-ro, Dongjak-gu, Seoul",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Mangwon Market",
            lat: 37.5556,
            lng: 126.9036,
            tags: ["Market", "Local", "Cheap"],
            notes: [
              "No tourists, no English, and the best fried chicken and tteokbokki in the city for a third of Myeongdong prices.",
            ],
            about:
              "A working neighbourhood market in the west of the city that stayed local while everything around it gentrified.",
            address: "14 Poeun-ro 8-gil, Mapo-gu, Seoul",
            priceLevel: 1,
            transfer: { mode: "metro", duration: "26 min", distance: "7 km" },
          },
          {
            name: "N Seoul Tower, Namsan",
            lat: 37.5512,
            lng: 126.9882,
            tags: ["Viewpoint", "Cable car"],
            notes: [
              "Walk up through Namsan park instead of taking the cable car — 40 minutes, shaded, and free.",
              "Go for the hour after sunset when the city is lit and the mountains behind it are still visible.",
            ],
            about:
              "A 1971 broadcast tower on the mountain in the middle of the city, and the only place you can see how completely the mountains enclose Seoul.",
            address: "105 Namsangongwon-gil, Yongsan-gu, Seoul",
            priceLevel: 2,
            transfer: { mode: "metro", duration: "32 min", distance: "9 km" },
          },
        ],
      },
    ],
  },

  "iceland-ring-road-in-winter": {
    slug: "iceland-ring-road-in-winter",
    heroTitle: "Iceland Ring Road in Winter",
    heroAccent: "eight days on Route 1",
    publishedAt: "February 17, 2026",
    tags: ["8-day road trip", "Winter", "kr premium"],
    intro:
      "The full ring in February is genuinely harder than the summer version and worth it for one reason: ice caves and aurora only exist in winter. This is the route we drove, with the days deliberately short because four hours of usable daylight is what you get.",
    bestTime: "February",
    currency: "kr",
    generalTips: [
      "road.is and vedur.is, checked every single morning before you turn the key. Roads close without warning and driving a closed road voids every insurance policy you have.",
      "Take the 4x4 and take the full insurance including sand-and-ash and gravel protection. It is not an upsell here; a windscreen is 90,000 ISK.",
      "Daylight in February is roughly 10am to 5:30pm and it grows by five minutes a day. Plan two stops per day, not five, and never plan to arrive anywhere after dark.",
      "Aurora needs a clear sky and a KP index of 3+. Check the vedur.is aurora forecast — the cloud map matters far more than the KP number.",
      "Petrol stations can be 100km apart in the east. Fill at half a tank as a rule, not a quarter.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "Reykjavík and the Reykjanes peninsula",
        stops: [
          {
            name: "Hallgrímskirkja",
            lat: 64.1417,
            lng: -21.9266,
            tags: ["Church", "Viewpoint"],
            notes: [
              "The tower lift is 1,400 ISK and gives you the coloured roofs and the bay in one view.",
            ],
            about:
              "A 74-metre concrete church whose façade is modelled on the basalt columns you'll be seeing all week. Took 41 years to build.",
            address: "Hallgrímstorg 1, Reykjavík",
            priceLevel: 1,
          },
          {
            name: "Sky Lagoon",
            lat: 64.1177,
            lng: -21.9231,
            tags: ["Geothermal", "Ocean view"],
            notes: [
              "Cheaper than the Blue Lagoon, ten minutes from the city, and the infinity edge faces the North Atlantic rather than a car park.",
              "The seven-step ritual is included in the higher ticket and is worth it.",
            ],
            about:
              "A geothermal lagoon at Kársnes built into the shoreline turf, opened 2021.",
            address: "Vesturvör 44-48, Kópavogur",
            priceLevel: 4,
            highlight: true,
            transfer: { mode: "car", duration: "12 min", distance: "7 km" },
          },
        ],
      },
      {
        title: "Day 2",
        summary: "The Golden Circle",
        stops: [
          {
            name: "Þingvellir National Park",
            lat: 64.2559,
            lng: -21.1301,
            tags: ["UNESCO", "Rift valley"],
            notes: [
              "Parking is 1,000 ISK, paid at a machine or online — they check by plate.",
              "The Almannagjá path is icy in winter and crampons off the rack at any petrol station cost 3,000 ISK. Buy them on day one.",
            ],
            about:
              "Where the North American and Eurasian plates pull apart, and where the Alþingi — the world's oldest parliament — met from 930 AD.",
            address: "Þingvellir, Bláskógabyggð",
            priceLevel: 1,
          },
          {
            name: "Geysir & Strokkur",
            lat: 64.3104,
            lng: -20.3024,
            tags: ["Geothermal", "Free entry"],
            notes: [
              "Geysir itself is dormant. Strokkur next to it goes every 5–10 minutes and that's the one everyone photographs.",
              "Stand upwind. The water is 80–100°C.",
            ],
            about:
              "The geothermal field that gave every geyser in the world its name.",
            address: "Haukadalur, Bláskógabyggð",
            transfer: { mode: "car", duration: "50 min", distance: "60 km" },
          },
          {
            name: "Gullfoss",
            lat: 64.3271,
            lng: -20.1199,
            tags: ["Waterfall", "Free entry"],
            notes: [
              "In winter the lower path is usually closed and the spray freezes the upper one. It's still the best of the three stops.",
            ],
            about:
              "A two-stage fall dropping 32 metres into a canyon, saved from a hydroelectric scheme in the 1920s by a farmer's daughter who threatened to throw herself in.",
            address: "Gullfoss, Bláskógabyggð",
            highlight: true,
            transfer: { mode: "car", duration: "12 min", distance: "10 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "The south coast waterfalls",
        stops: [
          {
            name: "Seljalandsfoss",
            lat: 63.6156,
            lng: -19.9886,
            tags: ["Waterfall", "Paid parking"],
            notes: [
              "The path behind the curtain is closed most of winter — ice makes it lethal, and they mean the closure.",
              "Walk five minutes north to Gljúfrabúi, hidden in a cleft, which almost nobody does.",
            ],
            about:
              "A 60-metre fall over a former sea cliff, dropping clear of the rock so you can normally walk right around it.",
            address: "Seljalandsfoss, Rangárþing eystra",
            priceLevel: 1,
          },
          {
            name: "Skógafoss",
            lat: 63.5321,
            lng: -19.5114,
            tags: ["Waterfall", "Free entry"],
            notes: [
              "527 steps up the side for the top view. In ice, don't.",
              "Stand at the base only if you accept being soaked.",
            ],
            about:
              "Sixty metres high and twenty-five wide, at the foot of the glacier that erupted as Eyjafjallajökull in 2010.",
            address: "Skógar, Rangárþing eystra",
            transfer: { mode: "car", duration: "30 min", distance: "30 km" },
          },
          {
            name: "Reynisfjara black sand beach",
            lat: 63.4054,
            lng: -19.0448,
            tags: ["Beach", "Basalt columns", "Danger"],
            notes: [
              "Sneaker waves here have killed several visitors. Never turn your back on the sea and stay 30 metres up the beach. There is a warning light system — obey it.",
            ],
            about:
              "Black volcanic sand under a cliff of hexagonal basalt columns, with the Reynisdrangar sea stacks offshore.",
            address: "Reynisfjara, Vík í Mýrdal",
            highlight: true,
            transfer: { mode: "car", duration: "35 min", distance: "33 km" },
          },
        ],
      },
      {
        title: "Days 4–5",
        summary: "Glacier country and the ice cave",
        stops: [
          {
            name: "Skaftafell & Vatnajökull",
            lat: 64.0166,
            lng: -16.9666,
            tags: ["Glacier", "Guided", "Book ahead"],
            notes: [
              "Ice caves are guided-only and change every year — the tour operator finds the safe one, you do not.",
              "Book the crystal cave tour from Jökulsárlón, not from Reykjavík: same cave, half the day in a bus saved.",
            ],
            about:
              "The southern edge of Europe's largest glacier by volume, with outlet tongues reaching almost to the ring road.",
            address: "Skaftafell, Öræfi",
            priceLevel: 4,
            highlight: true,
          },
          {
            name: "Jökulsárlón glacier lagoon",
            lat: 64.0784,
            lng: -16.2306,
            tags: ["Lagoon", "Icebergs", "Free entry"],
            notes: [
              "The lagoon has quadrupled in size since 1975 and it is still growing. That is what you are looking at.",
              "Seals in the channel year-round.",
            ],
            about:
              "Icebergs calving off Breiðamerkurjökull and drifting to the sea through a short river — the deepest lake in Iceland, and only about 90 years old.",
            address: "Jökulsárlón, Hornafjörður",
            transfer: { mode: "car", duration: "50 min", distance: "57 km" },
          },
          {
            name: "Diamond Beach",
            lat: 64.043,
            lng: -16.1785,
            tags: ["Beach", "Icebergs", "Free entry"],
            notes: [
              "Directly across the road from the lagoon. Best in low winter sun, when the ice lights up from inside.",
            ],
            about:
              "Blocks of glacier ice washed back onto black sand by the tide, on the seaward side of the lagoon outlet.",
            address: "Breiðamerkursandur, Hornafjörður",
            transfer: { mode: "walk", duration: "8 min", distance: "0.6 km" },
          },
        ],
      },
      {
        title: "Days 6–7",
        summary: "The east fjords and the north",
        stops: [
          {
            name: "Eastfjords coastal road",
            lat: 64.9631,
            lng: -14.2836,
            tags: ["Scenic drive", "Reindeer"],
            notes: [
              "The longest and emptiest stretch of the ring. Reindeer come down to the road in winter and do not move for cars.",
              "Fill up at Höfn. The next reliable station is a long way.",
            ],
            about:
              "Route 1 threading between mountain and sea through a string of fishing villages — Djúpivogur, Breiðdalsvík, Fáskrúðsfjörður.",
            address: "Route 1, Eastfjords",
          },
          {
            name: "Mývatn & Jarðböðin nature baths",
            lat: 65.6039,
            lng: -16.9961,
            tags: ["Geothermal", "Lake"],
            notes: [
              "A third of the Blue Lagoon's price and a tenth of the crowd, facing north over the lake — which makes it the best aurora bath in the country.",
            ],
            about:
              "A shallow volcanic lake ringed by pseudocraters, lava pillars and the steaming Hverir mudpots ten minutes east.",
            address: "Jarðbaðshólar, Mývatn",
            priceLevel: 3,
            highlight: true,
            transfer: { mode: "car", duration: "230 min", distance: "270 km" },
          },
          {
            name: "Goðafoss",
            lat: 65.6828,
            lng: -17.5503,
            tags: ["Waterfall", "Free entry"],
            notes: [
              "Right on the ring road with a car park either side. Ten minutes, and in winter it is half-frozen and much better than its summer photographs.",
            ],
            about:
              "The 'waterfall of the gods' — where, in the year 1000, the lawspeaker is said to have thrown his pagan idols in after Iceland voted to convert.",
            address: "Goðafoss, Þingeyjarsveit",
            transfer: { mode: "car", duration: "40 min", distance: "48 km" },
          },
        ],
      },
      {
        title: "Day 8",
        summary: "Snæfellsnes on the way back",
        stops: [
          {
            name: "Kirkjufell & Kirkjufellsfoss",
            lat: 64.9271,
            lng: -23.3067,
            tags: ["Mountain", "Waterfall", "Free entry"],
            notes: [
              "The composition everyone comes for is from the waterfall car park across the road, not from the mountain itself.",
              "Do not attempt to climb it. Two people died doing so in 2018 and it is not a hiking route.",
            ],
            about:
              "A 463-metre arrowhead of layered rock beside Grundarfjörður, and probably the most photographed mountain in Iceland.",
            address: "Grundarfjörður, Snæfellsnes",
            highlight: true,
          },
          {
            name: "Arnarstapi & Hellnar",
            lat: 64.7686,
            lng: -23.6222,
            tags: ["Coastal cliffs", "Walk"],
            notes: [
              "The 2.5km clifftop path between the two villages is the best short walk on the peninsula.",
            ],
            about:
              "Basalt sea arches and blowholes on the south coast of Snæfellsnes, under the glacier Jules Verne used as his route to the centre of the earth.",
            address: "Arnarstapi, Snæfellsbær",
            transfer: { mode: "car", duration: "45 min", distance: "45 km" },
          },
        ],
      },
    ],
  },

  "cape-town-10-days": {
    slug: "cape-town-10-days",
    heroTitle: "Cape Town — 10 Days",
    heroAccent: "mountain, wine, coast",
    publishedAt: "November 26, 2025",
    tags: ["10-day itinerary", "South Africa", "R mid-range"],
    intro:
      "Ten days is the right length for Cape Town because the weather makes half your plans for you. Keep Table Mountain and Cape Point flexible, book the wine lands and Robben Island firm, and let the wind decide the rest.",
    bestTime: "March",
    currency: "R",
    generalTips: [
      "Hire a car. The peninsula, the wine lands and the whale coast are all day trips and there is no practical public transport to any of them.",
      "Table Mountain: check the cableway website in the morning. It closes for wind more often than not in summer and the queue on the first clear day after a closure is three hours.",
      "'Load shedding' — scheduled power cuts — still happens. Download the EskomSePush app; restaurants and hotels mostly have generators, traffic lights don't.",
      "Normal city caution applies: don't walk between neighbourhoods after dark, use e-hailing rather than street taxis, and don't leave anything visible in a parked car. Daytime in the tourist areas is relaxed.",
    ],
    days: [
      {
        title: "Days 1–2",
        summary: "The city bowl",
        stops: [
          {
            name: "Table Mountain",
            lat: -33.9628,
            lng: 18.4098,
            tags: ["Mountain", "Cableway", "Weather-dependent"],
            notes: [
              "Book the cableway online to skip the ticket queue — it does not skip the boarding queue.",
              "Platteklip Gorge is the walking route: 2–3 hours, relentless steps, no shade, and you can take the cable car down.",
            ],
            about:
              "A 3km flat-topped sandstone plateau 1,086m above the city, with more plant species on it than the whole United Kingdom.",
            address: "Tafelberg Rd, Cape Town",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Bo-Kaap",
            lat: -33.921,
            lng: 18.4142,
            tags: ["Neighbourhood", "Free entry"],
            notes: [
              "It's a residential area, not a set. Ask before photographing anyone's house, and consider the small museum on Wale Street.",
            ],
            about:
              "The historic Cape Malay quarter on the slopes of Signal Hill — brightly painted houses on cobbled streets, and the oldest mosque in South Africa.",
            address: "Bo-Kaap, Cape Town",
          },
          {
            name: "V&A Waterfront",
            lat: -33.9036,
            lng: 18.4201,
            tags: ["Waterfront", "Museum"],
            notes: [
              "The Zeitz MOCAA — Africa's largest contemporary art museum, in a carved-out grain silo — is the reason to come, not the shops.",
              "Free entry to Zeitz on Wednesday mornings for African residents.",
            ],
            about:
              "A working harbour redeveloped around the original Victorian basins, with Table Mountain framed behind it.",
            address: "V&A Waterfront, Cape Town",
            priceLevel: 2,
          },
          {
            name: "Signal Hill",
            lat: -33.9147,
            lng: 18.403,
            tags: ["Viewpoint", "Free entry", "Sunset"],
            notes: [
              "Drive up for sunset. The Noon Gun below it has been fired every day since 1806 — it is startling if nobody warns you.",
            ],
            about:
              "The ridge running from Lion's Head to the sea, with the city on one side and the Atlantic on the other.",
            address: "Signal Hill Rd, Cape Town",
            transfer: { mode: "car", duration: "15 min", distance: "5 km" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Robben Island and the harbour",
        stops: [
          {
            name: "Robben Island",
            lat: -33.8067,
            lng: 18.3667,
            tags: ["UNESCO", "Book ahead", "Half day"],
            notes: [
              "Book weeks ahead — 3.5 hours including the ferry, and it cancels in swell.",
              "The prison section is guided by former political prisoners. That is the whole point of going.",
            ],
            about:
              "The island prison where Mandela spent 18 of his 27 years, seven kilometres offshore with the city in full view from the yard.",
            address: "Robben Island, Cape Town",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "District Six Museum",
            lat: -33.9282,
            lng: 18.4232,
            tags: ["Museum", "History"],
            notes: [
              "Small, and staffed by former residents. Go here before Robben Island if you can — it frames everything else.",
            ],
            about:
              "In a former church, documenting the forced removal of 60,000 people from a mixed inner-city neighbourhood after it was declared white-only in 1966.",
            address: "25A Buitenkant St, Cape Town",
            priceLevel: 1,
            transfer: { mode: "car", duration: "14 min", distance: "4 km" },
          },
        ],
      },
      {
        title: "Days 4–5",
        summary: "The Cape Peninsula",
        stops: [
          {
            name: "Chapman's Peak Drive",
            lat: -34.0733,
            lng: 18.36,
            tags: ["Scenic drive", "Toll road"],
            notes: [
              "Nine kilometres, 114 curves, cut into a near-vertical cliff. Toll is about R60 and worth every cent.",
              "Closes in high wind and after rockfalls — check chapmanspeakdrive.co.za.",
            ],
            about:
              "The road from Hout Bay to Noordhoek, blasted along the contact line between granite and sandstone 600 metres above the sea.",
            address: "Chapman's Peak Dr, Cape Town",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Cape Point & Cape of Good Hope",
            lat: -34.3568,
            lng: 18.497,
            tags: ["National park", "Lighthouse"],
            notes: [
              "Not the southernmost point of Africa — that's Cape Agulhas, 150km east. Come anyway.",
              "Baboons here will open a car door and take your bag. Windows up, food out of sight.",
            ],
            about:
              "The tip of the peninsula inside Table Mountain National Park, with a funicular to the old lighthouse and a cliff path to the new one.",
            address: "Cape Point, Cape Town",
            priceLevel: 2,
            transfer: { mode: "car", duration: "55 min", distance: "48 km" },
          },
          {
            name: "Boulders Beach penguins",
            lat: -34.1975,
            lng: 18.4517,
            tags: ["Penguins", "Beach"],
            notes: [
              "The boardwalk colony is the photo; Foxy Beach next door is where you can actually swim among them.",
              "They bite. Genuinely, they bite.",
            ],
            about:
              "A colony of African penguins that established itself here in 1982 and now numbers a few thousand, on a sheltered beach of granite boulders.",
            address: "Kleintuin Rd, Simon's Town",
            priceLevel: 1,
            transfer: { mode: "car", duration: "25 min", distance: "18 km" },
          },
          {
            name: "Kirstenbosch Botanical Garden",
            lat: -33.988,
            lng: 18.4327,
            tags: ["Garden", "Canopy walk"],
            notes: [
              "The Boomslang canopy walkway is included. Summer sunset concerts on the lawn, Sundays — bring a picnic and book ahead.",
            ],
            about:
              "On the eastern slopes of Table Mountain, growing only southern African plants, on land Cecil Rhodes left to the nation.",
            address: "Rhodes Dr, Newlands, Cape Town",
            priceLevel: 1,
          },
        ],
      },
      {
        title: "Days 6–7",
        summary: "The wine lands",
        stops: [
          {
            name: "Stellenbosch",
            lat: -33.9321,
            lng: 18.8602,
            tags: ["Wine", "University town"],
            notes: [
              "Tastings are R80–150 for five wines and often waived if you buy a bottle.",
              "Use a driver or a wine tram. The road police here take drink-driving seriously and so should you.",
            ],
            about:
              "The second-oldest European settlement in South Africa, all oaks and Cape Dutch gables, surrounded by 150 wine estates.",
            address: "Stellenbosch, Western Cape",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Franschhoek Wine Tram",
            lat: -33.9111,
            lng: 19.12,
            tags: ["Wine", "Hop-on tram"],
            notes: [
              "Pick a coloured line, hop off at four or five estates over a day. Book the line, not individual stops.",
              "Franschhoek is also the best restaurant town in the country.",
            ],
            about:
              "A valley settled by Huguenots in 1688, ringed by mountains, with a restored tram-and-bus circuit linking the estates.",
            address: "32 Huguenot Rd, Franschhoek",
            priceLevel: 3,
          },
          {
            name: "Groot Constantia",
            lat: -34.0281,
            lng: 18.4239,
            tags: ["Wine", "Historic estate"],
            notes: [
              "Inside the city, so it's the estate to do on a day you don't want to drive an hour.",
            ],
            about:
              "The oldest wine estate in South Africa, founded 1685, whose sweet Constantia wine was shipped to Napoleon on St Helena.",
            address: "Groot Constantia Rd, Cape Town",
            priceLevel: 2,
          },
        ],
      },
      {
        title: "Days 8–10",
        summary: "The coast — whales and one last swim",
        stops: [
          {
            name: "Hermanus",
            lat: -34.4187,
            lng: 19.2345,
            tags: ["Whale watching", "Cliff path"],
            notes: [
              "June to November for southern right whales, peaking in September. From the cliff path you see them from land — no boat needed.",
              "The town has an official whale crier who blows a kelp horn when they're in the bay.",
            ],
            about:
              "A coastal town 90 minutes east, with a 12km clifftop path along Walker Bay where the whales calve close inshore.",
            address: "Hermanus, Western Cape",
            highlight: true,
          },
          {
            name: "Muizenberg",
            lat: -34.1083,
            lng: 18.47,
            tags: ["Beach", "Surf lessons"],
            notes: [
              "False Bay side, so the water is 5–8°C warmer than the Atlantic beaches. This is where you learn to surf.",
              "The painted beach huts are the photograph.",
            ],
            about:
              "A long shallow beach break on the warm side of the peninsula, and the birthplace of South African surfing.",
            address: "Muizenberg Beach, Cape Town",
            priceLevel: 1,
          },
          {
            name: "Camps Bay",
            lat: -33.9509,
            lng: 18.3776,
            tags: ["Beach", "Sunset", "Restaurants"],
            notes: [
              "The Atlantic here is about 13°C. People swim for exactly four minutes and then get out.",
              "Sunset from the beach with the Twelve Apostles behind you is the last thing to do in Cape Town.",
            ],
            about:
              "White sand under the Twelve Apostles ridge, with a strip of restaurants across the road.",
            address: "Camps Bay, Cape Town",
            priceLevel: 3,
          },
        ],
      },
    ],
  },

  "peru-highlands-and-machu-picchu": {
    slug: "peru-highlands-and-machu-picchu",
    heroTitle: "Peru Highlands & Machu Picchu",
    heroAccent: "nine days at altitude",
    publishedAt: "September 5, 2025",
    tags: ["9-day itinerary", "Andes", "S/ mid-range"],
    intro:
      "The single most common mistake here is landing in Cusco and going straight up a mountain. This itinerary spends its first days deliberately low and slow in the Sacred Valley, which is both more comfortable and, it turns out, more interesting.",
    bestTime: "May",
    currency: "S/",
    generalTips: [
      "Cusco is 3,400m and the Sacred Valley is 600m lower. Sleep in the valley for the first two nights and acclimatise properly — altitude sickness ruins more Peru trips than anything else.",
      "Machu Picchu entry is by timed circuit now, capped daily, and Huayna Picchu sells out months ahead. Buy from the official tuboleto site, not a reseller.",
      "Dry season is May to September. In the wet season the Inca Trail closes for all of February.",
      "Coca tea and mate de coca are offered everywhere and genuinely help. So does going to bed early on night one instead of drinking pisco sours.",
    ],
    days: [
      {
        title: "Days 1–2",
        summary: "The Sacred Valley, low and slow",
        stops: [
          {
            name: "Pisac ruins & market",
            lat: -13.4211,
            lng: -71.8489,
            tags: ["Ruins", "Market", "Terraces"],
            notes: [
              "Taxi to the top of the ruins and walk down through the terraces to the village — an hour, all downhill.",
              "The market is daily; Sunday is the big one and the one worth timing for.",
            ],
            about:
              "An Inca hillside site of agricultural terraces and a cliff cemetery of over a thousand tombs, above a colonial village at 2,970m.",
            address: "Pisac, Sacred Valley",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Moray",
            lat: -13.33,
            lng: -72.195,
            tags: ["Ruins", "Terraces"],
            notes: [
              "Temperature between the top and bottom rings differs by up to 15°C — it was almost certainly an agricultural laboratory.",
            ],
            about:
              "Concentric circular terraces sunk into a natural depression on the Maras plateau, unlike any other Inca site.",
            address: "Moray, Maras",
            priceLevel: 1,
          },
          {
            name: "Maras salt ponds",
            lat: -13.2967,
            lng: -72.155,
            tags: ["Salt pans", "Viewpoint"],
            notes: [
              "Around 5,000 pools, worked by the same families since before the Inca. You can't walk in them any more, only along the top.",
            ],
            about:
              "A hillside of terraced evaporation pools fed by a warm salt spring, above the Urubamba valley.",
            address: "Maras, Sacred Valley",
            priceLevel: 1,
            transfer: { mode: "car", duration: "20 min", distance: "9 km" },
          },
          {
            name: "Ollantaytambo",
            lat: -13.2586,
            lng: -72.265,
            tags: ["Ruins", "Living Inca town", "Train station"],
            notes: [
              "Stay the night here — it's the only Inca town still lived in on its original street plan, and it's where the Machu Picchu train leaves from.",
              "Climb the terraces at 7am before the Cusco day-trip buses arrive at 9.",
            ],
            about:
              "A fortress-temple complex above a town of Inca walls and water channels still in daily use, at 2,792m.",
            address: "Ollantaytambo, Urubamba",
            priceLevel: 2,
            highlight: true,
            transfer: { mode: "car", duration: "35 min", distance: "22 km" },
          },
        ],
      },
      {
        title: "Days 3–4",
        summary: "Machu Picchu",
        stops: [
          {
            name: "Aguas Calientes",
            lat: -13.1547,
            lng: -72.525,
            tags: ["Town", "Base"],
            notes: [
              "Train from Ollantaytambo, 90 minutes, and the only way in that isn't a four-day walk.",
              "Buy your bus ticket for the morning the afternoon before — the queue at 5am is otherwise an hour long.",
            ],
            about:
              "A town of hotels and restaurants wedged in a gorge below the site, at the end of the railway line.",
            address: "Aguas Calientes, Urubamba",
            priceLevel: 2,
          },
          {
            name: "Machu Picchu",
            lat: -13.1631,
            lng: -72.545,
            tags: ["UNESCO", "Book ahead", "Timed circuit"],
            notes: [
              "First bus is 5:30am. Take it — the site is often in cloud until 8 and then clears, and being there for that is the memory.",
              "Circuits are one-way with no backtracking. Circuit 2 is the classic route; pick it unless you've been before.",
              "No large bags, no tripods, no drones, and toilets are outside the gate only.",
            ],
            about:
              "A 15th-century royal estate on a ridge at 2,430m, abandoned within a century and never found by the Spanish, which is why it is intact.",
            address: "Machu Picchu, Cusco Region",
            priceLevel: 4,
            highlight: true,
            transfer: { mode: "bus", duration: "25 min", distance: "8 km" },
          },
          {
            name: "Huayna Picchu",
            lat: -13.1587,
            lng: -72.546,
            tags: ["Hike", "Book ahead", "Exposed"],
            notes: [
              "The peak in every photograph of the site. 200 permits a day in two time slots, gone months ahead.",
              "Steep, wet stone, cables in places, and about 45 minutes up. Not for anyone uneasy with heights.",
            ],
            about:
              "The sugarloaf mountain behind the ruins, with Inca terracing and a small temple right at the summit.",
            address: "Huayna Picchu, Machu Picchu",
            priceLevel: 4,
          },
        ],
      },
      {
        title: "Days 5–7",
        summary: "Cusco",
        stops: [
          {
            name: "Plaza de Armas",
            lat: -13.5164,
            lng: -71.9785,
            tags: ["Square", "Cathedral"],
            notes: [
              "The cathedral's Last Supper painting has a guinea pig on the table. Look for it.",
              "The balconies around the square are the best place to sit at dusk.",
            ],
            about:
              "The Inca Huacaypata, rebuilt as a colonial square with a cathedral raised on the foundations of the Viracocha palace.",
            address: "Plaza de Armas, Cusco",
            priceLevel: 1,
          },
          {
            name: "Qorikancha",
            lat: -13.5202,
            lng: -71.9754,
            tags: ["Temple", "Colonial church"],
            notes: [
              "The best-cut Inca stonework anywhere, and the clearest illustration of the conquest there is.",
            ],
            about:
              "The Inca sun temple, once sheathed in gold, with a Dominican convent built directly on top of walls that have outlasted three earthquakes the convent did not.",
            address: "Plazoleta Santo Domingo, Cusco",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "walk", duration: "8 min", distance: "0.6 km" },
          },
          {
            name: "Sacsayhuamán",
            lat: -13.5095,
            lng: -71.9817,
            tags: ["Ruins", "Megalithic"],
            notes: [
              "Walk up from San Blas — 30 minutes, steep, and it's a good acclimatisation test.",
              "Included in the boleto turístico, which you'll want anyway for the valley sites.",
            ],
            about:
              "Zigzag ramparts of stones weighing up to 200 tonnes, fitted without mortar so precisely that a blade won't go between them.",
            address: "Sacsayhuamán, Cusco",
            priceLevel: 2,
          },
          {
            name: "San Pedro Market",
            lat: -13.5197,
            lng: -71.9836,
            tags: ["Market", "Cheap lunch"],
            notes: [
              "Juice row at the front, then a menú del día at a counter for S/10–15.",
              "Mornings. It thins out badly after 3pm.",
            ],
            about:
              "Cusco's central market, in a 1925 iron hall designed by Eiffel's practice.",
            address: "Calle Túpac Amaru, Cusco",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "10 min", distance: "0.8 km" },
          },
        ],
      },
      {
        title: "Days 8–9",
        summary: "One high day, then Lima",
        stops: [
          {
            name: "Humantay Lake",
            lat: -13.3592,
            lng: -72.5936,
            tags: ["Hike", "High altitude", "Day trip"],
            notes: [
              "4,200m. Only attempt this after a week acclimatised, and take it slowly — it's a 90-minute climb that feels like three hours.",
              "Better than Rainbow Mountain: lower, shorter, and far less crowded.",
            ],
            about:
              "A turquoise glacial lake below the Salkantay massif, reached on a steep trail from Soraypampa.",
            address: "Humantay, Mollepata",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Miraflores & the Malecón",
            lat: -12.1211,
            lng: -77.03,
            tags: ["Clifftop", "Free entry"],
            notes: [
              "Ten kilometres of clifftop park above the Pacific. Paragliders launch off it all afternoon.",
              "Lima is at sea level, which after nine days at altitude feels like breathing through a straw in reverse.",
            ],
            about:
              "The seafront district of Lima, and the obvious last night before a flight — the city is one of the best places to eat in the Americas.",
            address: "Malecón de Miraflores, Lima",
            priceLevel: 3,
            transfer: {
              mode: "flight",
              duration: "80 min",
              distance: "590 km",
            },
          },
        ],
      },
    ],
  },

  "thailand-travel-guide": {
    slug: "thailand-travel-guide",
    heroTitle: "Thailand Travel Guide",
    heroAccent: "a two-week loop",
    publishedAt: "January 12, 2026",
    tags: ["14-day itinerary", "Thailand", "฿ budget"],
    intro:
      "Two weeks, north to south, with one internal flight and no day that starts before 8am. Thailand punishes over-scheduling — this is deliberately three bases rather than seven, which is what makes it feel unhurried on a budget.",
    bestTime: "January",
    currency: "฿",
    generalTips: [
      "November to February is cool and dry and it is the right time to come. March–May is brutally hot; the north burns crop stubble in March and the air quality collapses.",
      "Book the Bangkok–Chiang Mai and Chiang Mai–Krabi legs as internal flights — they're often under ฿1,500 and save two full days on buses.",
      "Temples require covered shoulders and knees, for everyone. The Grand Palace enforces it hardest and rents cover-ups at the gate for a deposit.",
      "Never agree to a tuk-tuk 'tour' offered by a stranger outside a temple, and ignore anyone who tells you the Grand Palace is closed today. It isn't.",
      "Scooter rental: they will ask for your passport as deposit. Give a photocopy and pay a cash deposit instead, and photograph every scratch before you ride off.",
    ],
    days: [
      {
        title: "Days 1–3",
        summary: "Bangkok",
        stops: [
          {
            name: "Grand Palace & Wat Phra Kaew",
            lat: 13.75,
            lng: 100.4913,
            tags: ["Palace", "Temple", "Dress code"],
            notes: [
              "฿500, open 8:30–15:30, and busiest between 10 and noon. Go at opening.",
              "The Emerald Buddha is jade, about 66cm tall, and its robes are changed by the king three times a year.",
            ],
            about:
              "The royal compound since 1782 — a walled kilometre of gilded chedi, mirrored mosaic and the country's most sacred temple.",
            address: "Na Phra Lan Rd, Phra Nakhon, Bangkok",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Wat Pho",
            lat: 13.7465,
            lng: 100.4927,
            tags: ["Temple", "Reclining Buddha", "Massage"],
            notes: [
              "The reclining Buddha is 46m long and impossible to photograph whole. Just look at it.",
              "The traditional massage school inside is the original one, and an hour costs ฿480.",
            ],
            about:
              "Older than the city itself, and the birthplace of Thai massage — its walls carry the inscribed medical texts the practice was codified from.",
            address: "2 Sanamchai Rd, Phra Nakhon, Bangkok",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "9 min", distance: "0.7 km" },
          },
          {
            name: "Wat Arun",
            lat: 13.7437,
            lng: 100.4889,
            tags: ["Temple", "River", "Sunset"],
            notes: [
              "฿4 ferry across from Tha Tien pier. Climb the central prang — the steps are very steep.",
              "Photograph it from the east bank at dusk, when it's floodlit.",
            ],
            about:
              "The Temple of Dawn, its 70-metre spire encrusted with broken Chinese porcelain used as ballast in trading ships.",
            address: "158 Thanon Wang Doem, Bangkok Yai",
            priceLevel: 1,
            transfer: { mode: "ferry", duration: "5 min", distance: "0.4 km" },
          },
          {
            name: "Chatuchak Weekend Market",
            lat: 13.7999,
            lng: 100.5502,
            tags: ["Market", "Weekends only"],
            notes: [
              "15,000 stalls. Take a photo of the section sign where you enter or you will not find your way back.",
              "Saturday and Sunday only. Go at 9am before the heat.",
            ],
            about:
              "One of the largest markets in the world, on 35 acres by Mo Chit BTS.",
            address: "Kamphaeng Phet 2 Rd, Chatuchak, Bangkok",
            priceLevel: 1,
          },
        ],
      },
      {
        title: "Day 4",
        summary: "Ayutthaya day trip",
        stops: [
          {
            name: "Wat Mahathat",
            lat: 14.3569,
            lng: 100.5679,
            tags: ["Ruins", "UNESCO"],
            notes: [
              "The Buddha head grown into the fig roots is here. Crouch below its level for photographs — standing over it is genuinely offensive.",
              "Train from Bangkok Hua Lamphong is ฿20 and takes 90 minutes.",
            ],
            about:
              "One of the principal temples of the Ayutthaya kingdom, sacked and burned by the Burmese in 1767 and left as it fell.",
            address: "Naresuan Rd, Ayutthaya",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Wat Chaiwatthanaram",
            lat: 14.3419,
            lng: 100.5442,
            tags: ["Ruins", "Sunset"],
            notes: [
              "The best of the Ayutthaya sites and slightly out of the centre, so it's the quietest. Rent a bicycle for ฿50 a day.",
            ],
            about:
              "A 1630 royal temple on the river bank, built on a Khmer plan with a 35-metre central prang.",
            address: "Ban Pom, Ayutthaya",
            priceLevel: 1,
            transfer: { mode: "bike", duration: "18 min", distance: "3 km" },
          },
        ],
      },
      {
        title: "Days 5–8",
        summary: "Chiang Mai and the north",
        stops: [
          {
            name: "Wat Phra Singh",
            lat: 18.7889,
            lng: 98.9817,
            tags: ["Temple", "Old city"],
            notes: [
              "Monk chat sessions here most afternoons — students practising English, and you can ask anything.",
            ],
            about:
              "The principal temple inside the moated old city, with a Lanna-style wooden assembly hall and murals of 19th-century northern daily life.",
            address: "2 Samlarn Rd, Chiang Mai",
            priceLevel: 1,
          },
          {
            name: "Doi Suthep",
            lat: 18.8048,
            lng: 98.9217,
            tags: ["Temple", "Mountain", "Viewpoint"],
            notes: [
              "306 steps up the naga staircase, or a funicular for ฿20.",
              "Red songthaew from the old city, ฿150 each way. Go at 6am for the monks' chanting and an empty terrace.",
            ],
            about:
              "A gold chedi at 1,073m above the city, founded in 1383 on a site chosen, the story goes, by a white elephant carrying a relic.",
            address: "Doi Suthep, Chiang Mai",
            priceLevel: 1,
            highlight: true,
            transfer: { mode: "car", duration: "35 min", distance: "15 km" },
          },
          {
            name: "Elephant Nature Park",
            lat: 19.2131,
            lng: 98.8546,
            tags: ["Sanctuary", "Book ahead", "No riding"],
            notes: [
              "A genuine rescue sanctuary: no riding, no bathing shows, no bullhooks. If a place offers riding, it is not a sanctuary.",
              "Full day, ฿2,500, and books out weeks ahead.",
            ],
            about:
              "A 250-acre valley an hour north of Chiang Mai, home to elephants retired from logging and trekking camps.",
            address: "Kuet Chang, Mae Taeng, Chiang Mai",
            priceLevel: 3,
            highlight: true,
          },
          {
            name: "Sunday Walking Street",
            lat: 18.7876,
            lng: 98.9931,
            tags: ["Night market", "Sundays"],
            notes: [
              "Ratchadamnoen Road closes to traffic from 4pm. The food is in the temple courtyards off the main street, not on it.",
              "At 6pm everything stops for the national anthem. Stand still.",
            ],
            about:
              "The old city's main east–west street given over to craft stalls and food every Sunday evening.",
            address: "Ratchadamnoen Rd, Chiang Mai",
            priceLevel: 1,
          },
        ],
      },
      {
        title: "Days 9–11",
        summary: "Krabi and the limestone coast",
        stops: [
          {
            name: "Railay Beach",
            lat: 8.0119,
            lng: 98.8377,
            tags: ["Beach", "Climbing", "Boat only"],
            notes: [
              "Reachable only by longtail from Ao Nang, ฿100, and they leave when eight people have gathered.",
              "Phra Nang cave beach around the headland is the good one, and the viewpoint climb behind it is a rope scramble, not a path.",
            ],
            about:
              "A peninsula cut off by limestone cliffs, and one of the world's best sport-climbing sites — 700 bolted routes on the walls behind the sand.",
            address: "Railay, Krabi",
            priceLevel: 2,
            highlight: true,
          },
          {
            name: "Four Islands tour",
            lat: 8.0322,
            lng: 98.8213,
            tags: ["Island hopping", "Snorkelling"],
            notes: [
              "Take the longtail version, not the speedboat — half the price, a quarter of the people.",
              "At low tide a sandbar connects three of the islands and you can walk between them.",
            ],
            about:
              "Chicken Island, Tup, Poda and Phra Nang, in the bay off Ao Nang. A standard day trip and, unusually, a good one.",
            address: "Ao Nang, Krabi",
            priceLevel: 2,
          },
          {
            name: "Koh Phi Phi & Maya Bay",
            lat: 7.7407,
            lng: 98.7784,
            tags: ["Island", "Day trip"],
            notes: [
              "Maya Bay reopened in 2022 with strict limits: no boats in the bay, no swimming, and it closes entirely August–September.",
              "Phi Phi Don is a party island. Day trip from Krabi rather than staying, unless that's what you came for.",
            ],
            about:
              "Two limestone islands off Krabi — one inhabited, one a national park that was loved almost to death after the film.",
            address: "Koh Phi Phi, Krabi",
            priceLevel: 3,
            transfer: { mode: "ferry", duration: "120 min", distance: "42 km" },
          },
        ],
      },
      {
        title: "Days 12–14",
        summary: "Koh Lanta, then home",
        stops: [
          {
            name: "Long Beach (Phra Ae)",
            lat: 7.6167,
            lng: 99.0333,
            tags: ["Beach", "Sunset", "Quiet"],
            notes: [
              "Four kilometres of sand and far fewer people than Phi Phi. This is the wind-down.",
              "Rent a scooter — the island is one road, north to south.",
            ],
            about:
              "Koh Lanta's main west-coast beach, facing directly into the sunset, backed by low-key bungalows rather than resorts.",
            address: "Phra Ae, Koh Lanta",
            priceLevel: 1,
            highlight: true,
          },
          {
            name: "Mu Ko Lanta National Park",
            lat: 7.5136,
            lng: 99.0616,
            tags: ["National park", "Lighthouse", "Monkeys"],
            notes: [
              "The southern tip with a lighthouse and a 2.5km jungle loop. Macaques will take food out of your hand; don't carry any.",
            ],
            about:
              "The wilder end of the island, where the coast road ends at a headland between two beaches.",
            address: "Koh Lanta Yai, Krabi",
            priceLevel: 1,
            transfer: { mode: "car", duration: "35 min", distance: "22 km" },
          },
          {
            name: "Lanta Old Town",
            lat: 7.5528,
            lng: 99.0839,
            tags: ["Stilt village", "Seafood"],
            notes: [
              "Chinese-Thai shophouses on stilts over the water, and the seafood restaurants on the piers are the best meal on the island.",
            ],
            about:
              "The island's original port on the east coast, a trading stop for boats between Phuket and Penang long before tourism arrived.",
            address: "Koh Lanta Old Town, Krabi",
            priceLevel: 2,
            transfer: { mode: "car", duration: "25 min", distance: "16 km" },
          },
        ],
      },
    ],
  },

  "reno-parks-playgrounds": {
    slug: "reno-parks-playgrounds",
    heroTitle: "Reno Parks & Playgrounds",
    heroAccent: "family-tested",
    publishedAt: "June 15, 2025",
    tags: ["3-day itinerary", "Family", "$ cheap"],
    intro:
      "We have two under seven and we have been to all of these more times than I can count. Every entry says what actually matters with small kids: shade, parking, bathrooms, and whether there's a fence between the playground and the water.",
    bestTime: "June",
    currency: "$",
    generalTips: [
      "Reno is at 4,500 feet and the high-desert sun is much stronger than the temperature suggests. Hats and sunscreen even at 70°F, and double the water you think you need.",
      "Summer afternoons hit 95°F+ by 2pm. Plan playgrounds for mornings and something indoors or in water after lunch.",
      "Almost every park here is free with free parking. The only paid entries in this guide are the Wilbur May Center and Animal Ark.",
      "Nights drop 30 degrees. If you're staying out for an evening event, take a jacket — this catches out every visitor once.",
    ],
    days: [
      {
        title: "Day 1",
        summary: "The big two — Rancho San Rafael and Idlewild",
        stops: [
          {
            name: "Rancho San Rafael Regional Park",
            lat: 39.5497,
            lng: -119.8283,
            tags: ["Park", "Free entry", "Shade"],
            notes: [
              "Huge shaded playground with a fence and one gate — the easiest park here to watch two kids in at once.",
              "Bathrooms by the main lot, clean and open year-round. Big shade trees, which is rare in Reno.",
              "The Great Reno Balloon Race launches here in September, before dawn, and it is worth the alarm.",
            ],
            about:
              "600 acres on the north edge of town with an arboretum, a pond, wide lawns and the Wilbur D. May Center at its heart.",
            address: "1595 N Sierra St, Reno",
            highlight: true,
          },
          {
            name: "Wilbur D. May Center",
            lat: 39.5514,
            lng: -119.8261,
            tags: ["Museum", "Arboretum", "Paid"],
            notes: [
              "$10 family entry, and the Great Basin Adventure section next door has a log flume and a pony ride in summer.",
              "Good rainy-day or too-hot-day backup, inside the park you're already at.",
            ],
            about:
              "A ranch-house museum of a Nevada rancher's collections, plus a botanical arboretum and a children's discovery area.",
            address: "1595 N Sierra St, Reno",
            priceLevel: 1,
            transfer: { mode: "walk", duration: "6 min", distance: "0.3 mi" },
          },
          {
            name: "Idlewild Park",
            lat: 39.5232,
            lng: -119.828,
            tags: ["Park", "Free entry", "Water play"],
            notes: [
              "Two playgrounds: the newer one at the west end is fully fenced, the older one is not and it backs onto the river. Know which one you're at.",
              "Rose garden, duck pond and a wading pool that runs in summer. Bathrooms near the pool building.",
            ],
            about:
              "Reno's oldest park, along the Truckee on the west side of downtown, laid out for the 1927 Transcontinental Highways Exposition.",
            address: "1900 Idlewild Dr, Reno",
          },
        ],
      },
      {
        title: "Day 2",
        summary: "Water — the river and the marina",
        stops: [
          {
            name: "Truckee River Whitewater Park",
            lat: 39.525,
            lng: -119.814,
            tags: ["River", "Free entry", "Downtown"],
            notes: [
              "Kayakers run the drop structures and it's genuinely fun to watch from the bank for half an hour.",
              "Kids can paddle at the edges in low summer flow, but the current in the channels is strong — this is a watch-from-the-grass spot for small ones.",
            ],
            about:
              "Eleven drop pools engineered into a half-mile of the Truckee through Wingfield Park, right in the middle of downtown.",
            address: "2 S Arlington Ave, Reno",
            highlight: true,
          },
          {
            name: "Sparks Marina Park",
            lat: 39.5386,
            lng: -119.7266,
            tags: ["Lake", "Beach", "Free entry"],
            notes: [
              "Sandy swimming beach with a roped-off shallow area and lifeguards in summer. The best actual swimming near the city.",
              "Two-mile flat paved loop — good for scooters and strollers. Bathrooms at the north and south lots.",
            ],
            about:
              "A 77-acre lake in Sparks, created when a gravel pit flooded in the 1997 New Year's flood and was never drained.",
            address: "300 Howard Dr, Sparks",
            transfer: { mode: "car", duration: "16 min", distance: "8 mi" },
          },
          {
            name: "Golden Eagle Regional Park",
            lat: 39.5843,
            lng: -119.7136,
            tags: ["Playground", "Free entry", "Sports"],
            notes: [
              "Newest big playground in the area, with shade sails over the structures — which matters here more than anything else.",
              "Enormous parking lot, never full except on tournament Saturdays.",
            ],
            about:
              "A sports complex in north Sparks with a large modern playground alongside the fields.",
            address: "6400 Vista Blvd, Sparks",
            transfer: { mode: "car", duration: "12 min", distance: "6 mi" },
          },
        ],
      },
      {
        title: "Day 3",
        summary: "Out of town — the foothills and the lake",
        stops: [
          {
            name: "Galena Creek Regional Park",
            lat: 39.3556,
            lng: -119.8617,
            tags: ["Forest", "Free entry", "Trails"],
            notes: [
              "Actual pine shade and a creek — 15 degrees cooler than the valley floor, and the reason to drive out.",
              "The Jones-Whites Creek loop is 2.5 miles; the short nature trail from the visitor center is 20 minutes and fine for a three-year-old.",
            ],
            about:
              "Forested foothills park on the Mount Rose highway, with a visitor center running free naturalist programmes at weekends.",
            address: "18250 Mt Rose Hwy, Reno",
            highlight: true,
          },
          {
            name: "Bartley Ranch Regional Park",
            lat: 39.4756,
            lng: -119.8106,
            tags: ["Park", "Free entry", "Easy trails"],
            notes: [
              "Flat gravel paths, horses in the arena most weekends, and an amphitheatre with free summer concerts.",
              "Good half-hour stop on the way back into town.",
            ],
            about:
              "A working-ranch park in south Reno with a restored one-room schoolhouse and paths along Steamboat Ditch.",
            address: "6000 Bartley Ranch Rd, Reno",
            transfer: { mode: "car", duration: "18 min", distance: "10 mi" },
          },
          {
            name: "Sand Harbor, Lake Tahoe",
            lat: 39.198,
            lng: -119.9308,
            tags: ["Beach", "Paid parking", "Day trip"],
            notes: [
              "The parking lot fills by 9:30am in July and they close the gate — arrive early or take the East Shore Express shuttle from Incline Village.",
              "Shallow, clear, calm water between granite boulders, and the best kid beach on the lake. $10–15 per vehicle.",
            ],
            about:
              "A state park beach on Tahoe's north-east shore, 45 minutes from Reno, with picnic areas under the pines and a boardwalk nature trail.",
            address: "2005 NV-28, Incline Village",
            priceLevel: 1,
            transfer: { mode: "car", duration: "45 min", distance: "32 mi" },
          },
        ],
      },
    ],
  },
};
