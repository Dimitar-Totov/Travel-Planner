# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Testing

Do not run tests (npm test, npx playwright test, vitest, jest, etc.) automatically
after implementing a feature or fixing a bug. Only run tests when explicitly asked to.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000, or the next free port)
- `npm run build` — production build
- `npm run start` — serve the production build (run `build` first)
- `npm run lint` — ESLint (flat config: `eslint-config-next` core-web-vitals + typescript rules)

No test runner is set up yet.

**Concurrent `next dev` servers corrupt this repo's build.** `types/routes.d.ts` and
`types/validator.ts` are rewritten on every dev/build; two dev servers racing on the
same project leave them half-written, and `next build` then fails type-checking a
bogus generated path. Before a clean build, make sure only one `next dev` for this
project is running, then `rm -rf .next types/routes.d.ts types/validator.ts` and
rebuild.

## Architecture

Next.js 16 App Router — React 19, TypeScript (strict), Tailwind CSS v4. A single-sentence
trip request ("5 days in Italy with a €1,000 budget") is turned into a `TripPlan` by the
AI planning layer and rendered through the **same detail template as a community guide**:

- `/` (`src/app/page.tsx`) — marketing landing page. `Hero` + `SentenceBuilder` +
  `Features` + `CtaBand`; it does not render a plan, it routes to `/plan?q=…`.
- `/plan?q=<sentence>` (`src/app/plan/page.tsx`) — results page. Server component that
  calls `buildTripPlan(query)` directly (not via HTTP) and renders `PlanDetailView`, the
  `/destinations` guide-detail template driven by a `TripPlan`. **Expect a ~40–70s
  render** — it awaits a large model call — which is what `plan/loading.tsx` is for.
- `/api/plan` (`src/app/api/plan/route.ts`) — `GET ?q=` / `POST { query }` HTTP mirror of
  the same `buildTripPlan`, for non-page consumers.
- `/api/ai/[agentId]` (`src/app/api/ai/[agentId]/route.ts`) — generic `POST` chat endpoint
  over any agent in the OpenRouter registry; body is `{ messages: ChatMessage[] }`, the
  agent's system prompt is injected server-side. Not currently used by any page — driven
  from the client via the `useAgent` hook (`src/lib/hooks/useAgent.ts`).

Plus the auth routes — `/sign-in`, `/sign-up`, `/api/auth/[...nextauth]`, `POST /api/users`
— described under "Auth" below, and the destinations routes — `/destinations`,
`/destinations/guide/[guideId]/details` — described under "Destinations" below.

### Data layer (`src/lib/`)

- `itinerary.ts` — `GuideDay` / `GuideStop` / `StopTransfer` / `TransferMode`. **The pivot
  of the whole app**: both a hand-written community guide and an AI-generated plan produce
  this exact shape, which is why `/plan` can reuse the guide detail template instead of
  owning a second one. `guideItineraries.ts` re-exports all four names, so importing them
  from there still works.
- `tripPlan.ts` — the `TripPlan` + `DestinationImage` contract that `/plan` renders.
  Change here first when the plan shape changes.
- `types.ts` — the older `Plan` contract. Now only backs the deterministic mock in
  `plans.ts`/`demo.ts`, which survives as `tripPlanner.ts`'s offline fallback. New work
  should target `TripPlan`, not `Plan`.
- `demo.ts` — `italyPlan`, the canonical hand-tuned demo plan shown on the landing page
  and returned for Italy-shaped queries.
- `plans.ts` — `getPlanForQuery(query)`: a pure, deterministic mock "backend". Regex-parses
  days/budget from the sentence, routes Italy/Portugal/Japan to curated plans (via
  `withOverrides`, which reapplies the parsed days/budget onto a curated base), and falls
  back to `buildGenericPlan` (looks up a known city or defaults to Barcelona) for anything
  else. No network calls, no randomness — this is the seam a real planning/flights API will
  eventually replace.

### AI layer (`src/lib/openrouter/`, `src/lib/tripPlanner.ts`, `src/lib/unsplash.ts`)

All model calls go through [OpenRouter](https://openrouter.ai), configured via
`OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` (see `.env.example`; copy to `.env.local`).

- `openrouter/client.ts` — `createChatCompletion`, a thin stateless wrapper around
  OpenRouter's `/chat/completions`. Throws `OpenRouterError` (carries an HTTP `status`) on
  a missing key, network failure, non-2xx response, or a response with no message content.
- `openrouter/types.ts` — `AgentConfig` (an agent's id/model/systemPrompt/temperature/
  maxTokens/stream), `ChatMessage`, `AgentRequest`/`AgentResponse`.
- `openrouter/agents/*.ts` — one file per agent, each exporting an `AgentConfig`. Adding an
  agent = new file here + register it in `openrouter/registry.ts`'s `agentRegistry` map (the
  map key doubles as the `/api/ai/[agentId]` route segment).
  - `assistant` — general-purpose chat agent, no special parsing of its output.
  - `itinerary-planner` — given the trip sentence (+ parsed days/budget), returns one
    strict JSON object containing a whole `TripPlan`: hero copy, intro, tips, stats and the
    full `GuideDay[]`. Runs on `nvidia/nemotron-3-super-120b-a12b:free`.

**`reasoning: false` on that agent is load-bearing, not a tuning knob.** It is a reasoning
model, and with reasoning left on a real 10-day request spent 6076 of 8000 tokens thinking,
truncated the JSON mid-object (`finish_reason: "length"`), and took 97s — and its reasoning
prose leaks into `message.content`, so brace-scanning for the JSON picks up a `{` from the
thinking text and parses garbage. With it off: 3396 tokens, `finish_reason: "stop"`, valid
JSON, 43s. Note OpenRouter's `reasoning.exclude` does **not** do this — it only hides the
reasoning from the response while still generating and billing it; `{ enabled: false }` is
what actually stops it. `AgentConfig.reasoning` → `createChatCompletion({ reasoning })`.

- `tripPlanner.ts` — `buildTripPlan(query)`, the single entry point for `/plan` and
  `/api/plan`. Reuses `parseDays`/`parseBudget` from `plans.ts`, calls the agent, validates
  the response with **Zod** (invalid stops dropped, emptied days dropped, whole response
  rejected if nothing survives), then looks up the hero photo. Never throws: every failure
  path resolves to a deterministic offline `TripPlan` with `aiGenerated: false`, built from
  the curated mock in `plans.ts`/`demo.ts`, so the page always renders.
  - The model call and the Unsplash lookup are **deliberately sequential**. The only
    destination available before the model answers is `plans.ts`'s guess, which falls back
    to `DEFAULT_CITY` (Barcelona) for anything outside its small `KNOWN_CITIES` list —
    keying the photo off it puts a Barcelona hero over a Vietnam itinerary. The photo has
    to follow the itinerary. Unsplash costs a few hundred ms against a ~40s model call.
  - `MAX_DAY_SECTIONS` must agree with the grouping rule in the agent's prompt. It is a
    runaway guard, not a display cap — anything over it is silently dropped, and a
    traveller who asked for 10 days would be shown 8 with no explanation.
- `unsplash.ts` — `getDestinationImage(destination)`, the live hero-photo lookup. Requires
  `UNSPLASH_ACCESS_KEY`; **without it the app silently serves a single static fallback
  photo**, which is easy to mistake for a bug. Never throws, 5s timeout. Unsplash's API
  terms require the attribution it returns (`photographer`/`photographerUrl`/`unsplashUrl`,
  UTM-tagged) to be displayed, and require pinging the photo's `download_location` when we
  use it — both are handled here and rendered by `components/shared/PhotoCredit.tsx`.
  - `getStopImages(placeName, destination)` / `resolveStopImages(days, destination)` — the
    same idea per itinerary stop: `thumb` for the stop row, a genuinely different `about`
    photo for the stop detail card, one Unsplash call per stop (`per_page=2`) wrapped in
    `unstable_cache` for weeks. The caching has a subtle, load-bearing split: a genuine
    "Unsplash answered, found nothing" result is cached; a transient failure (network error,
    timeout, a 429/403 rate-limit response) **throws inside the cached function so
    `unstable_cache` never persists it**, and the next call retries for real. Getting this
    backwards would freeze a stop's photos to placeholders forever after one quota blip.
  - **Only `/plan` calls `resolveStopImages` today** (`components/plan/PlanDetailView.tsx`).
    `GuideDetailView.tsx` deliberately does not: Unsplash's free tier is 50 requests/hour, a
    single guide page can have 15–30 stops, and the guide route isn't static (`SiteNav`
    reads the session cookie, forcing per-request rendering) — one uncached view of the
    Paris guide alone exhausted the entire hourly quota. Guides currently pass an empty
    `stopImages` map (every stop renders its placeholder) until a MongoDB-backed store
    replaces the live call — see the Destinations section below.

### Auth (`src/lib/auth.ts`, `src/proxy.ts`, `src/app/(auth)/`)

Auth.js v5 (`next-auth@beta`) with a **Credentials** provider and the **JWT** session
strategy — no database adapter; MongoDB is consulted inside `authorize()` and by the
refresh-token layer below. Requires `AUTH_SECRET` (`npx auth secret`) on top of
`MONGODB_URI`.

- `lib/auth.ts` — the `NextAuth({...})` call, exporting `handlers`/`auth`/`signIn`/`signOut`.
  `authorize()` looks the user up with `.select("+password")` (the field is `select: false`
  by default) and bcrypt-compares against a dummy hash when no user matched, so an unknown
  email and a wrong password are indistinguishable in both result and timing. The `jwt`/
  `session` callbacks carry `id` + `username` onto `session.user`; there is **no** `name`
  field — use `session.user.username`. Types come from `types/next-auth.d.ts`, which
  augments `"next-auth"` and **`"@auth/core/jwt"`** (augmenting `"next-auth/jwt"` does not
  merge — it's a type-only re-export).
- Route protection is a single `PROTECTED_PATHS` array in `lib/auth.ts`, read by the
  `authorized` callback. **It is intentionally empty** — `/`, `/plan`, `/api/plan` and
  `/api/ai/*` are all anonymous-friendly. Add a path prefix there to protect a route.
- `src/proxy.ts` — Next 16 renamed the `middleware.ts` convention to `proxy.ts`; this file
  just re-exports `auth` as the default export. Its `matcher` excludes all of `/api/*`
  (so Auth.js's own endpoints are never intercepted) and static assets.
- `POST /api/users` — registration. 201 `{id,username,email,createdAt}`, 400
  `{error,fields:{…}}`, 409 `{error}` (duplicate, caught from Mongo's `E11000` rather than a
  racy pre-check), 500 `{error}`. Password hashing happens **only** in `User`'s `pre("save")`
  hook (guarded by `isModified`) — never hash before calling `User.create`.

#### Refresh tokens (`src/services/refreshTokens.ts`, `src/models/RefreshToken.ts`)

The session cookie is the access credential: an Auth.js-encrypted **JWE** in an **HttpOnly**
cookie carrying a 15-minute access window (`accessTokenExpires`) plus one opaque refresh
token. Inside that window a session costs **zero** database queries; when it lapses the
`jwt` callback exchanges the refresh token for a successor, which is also the point where a
revoked session is noticed.

- Refresh tokens are 256-bit CSPRNG values. Only their **SHA-256** hash is stored —
  deliberately not bcrypt: there's no dictionary to defend against, and a deterministic hash
  is what makes a unique-indexed single-query lookup possible.
- Rotation is **single-use**. Every token carries a `family` id shared by the whole chain
  back to the original sign-in; presenting a spent token after the grace window is treated as
  replay and revokes the entire family (RFC 9700 §4.14.2).
- `ROTATION_GRACE_MS` (2 min) is **load-bearing, not a nicety**. next-auth's RSC branch of
  `auth()` throws away the `Set-Cookie` headers it gets back (it can't set cookies during
  render — see `next-auth/src/lib/index.ts`), and `<Link>` prefetching fires concurrent
  requests all still holding the pre-rotation cookie. Without the window every one of those
  reads as replay and signs the user out. Rotation claims the parent atomically via
  `findOneAndUpdate`, and losers of that race are handed the same successor.
- Returning `null` from the `jwt` callback invalidates the session and clears the cookie —
  that's the deliberate outcome when a refresh fails. A _database_ failure instead returns
  the token unchanged so the next request retries, rather than signing out every user at once.
- Sign-out must reach the database or the discarded cookie's token stays valid for 30 days;
  `events.signOut` is the only hook with the decoded JWT, and it revokes the family.
- Sessions minted before this layer existed have no `refreshToken` and are invalidated once.

#### Validation (`src/lib/validation/auth.ts`)

**Zod** owns every credential rule; nothing hand-rolls its own checks. One module feeds
`POST /api/users` (`registerSchema`), `signInAction` and `authorize()` (`signInSchema` /
`credentialsSchema`), and `SignUpForm`'s pre-flight — so client and server can't drift.
It must stay free of server-only imports (mongoose, bcrypt, `node:crypto`) because client
components import it. Notes: email is trimmed+lowercased **before** the format check, so
normalisation is what prevents duplicate registrations; passwords are capped at 72 **bytes**
because bcrypt silently ignores anything beyond that; and `signInSchema` deliberately does
_not_ apply the strength rules — re-checking them at sign-in would lock out older passwords
and leak that a guess was the right shape. `fieldErrorsOf` walks `error.issues` rather than
`z.flattenError` (whose `fieldErrors` is untyped for a non-parameterized `ZodError`).

- `src/app/(auth)/` — the `/sign-in` and `/sign-up` pages plus `actions.ts`. Sign-in runs
  through the `signInAction` server action using `signIn(..., { redirect: false })`, which
  still _throws_ `AuthError`/`CredentialsSignin` on bad credentials (it does not return an
  error URL), so the failure path is a caught error, not a returned value. `?callbackUrl=`
  is filtered to same-origin relative paths.
- Session in the UI: read it server-side with `await auth()`. There is deliberately **no**
  `<SessionProvider>`/`useSession` anywhere — `SiteNav`'s account slot is the async server
  component `components/auth/NavAccount.tsx`, wrapped in `<Suspense>` so the rest of the nav
  (and `plan/loading.tsx`, which also renders `SiteNav`) never blocks on the session cookie.

### Destinations (`src/app/destinations/`, `src/lib/destinationGuides.ts`, `src/lib/guideItineraries.ts`)

A community guide feed plus a per-guide detail page. Entirely static/hardcoded — there is
no guides API yet, so every list, filter, and detail view is derived in-memory from two
data modules:

- `lib/destinationGuides.ts` — `destinationGuides`, the twelve-guide array backing the
  `/destinations` feed (title, blurb, author, cover photo, likes/views, `days`/
  `approxCostEUR` used by the tab filters). `slug` is the only link between this and
  `guideItineraries.ts`.
- `lib/guideItineraries.ts` — `GuideItinerary` per slug: hero copy, intro, tips, and the
  ordered `GuideDay[]`/`GuideStop[]` list that drives both the reading column and the map on
  the detail page. Stop `lat`/`lng` are real coordinates the map plots directly. There is no
  per-stop photo field on `GuideStop` itself — stop images are resolved separately (see
  `ItineraryDetailView`'s `stopImages` prop) and are currently placeholders for every guide
  on purpose, not because the feature doesn't exist: `/plan` resolves real per-stop photos
  live from Unsplash (`lib/unsplash.ts`'s `resolveStopImages`), but guides intentionally
  don't call it — see the rate-limit note under "AI layer" above. The only real photo a guide
  shows today is its cover image, reused as the hero.
- `/destinations` (`app/destinations/page.tsx`) — renders `DestinationsExplorer`, whose
  `useDestinationsExplorer` hook (`lib/hooks/useDestinationsExplorer.ts`) owns tab
  selection (recent/loved/budget/weekends), the committed search query (typing alone
  doesn't filter — `search()` commits it), and pagination (`PAGE_SIZE = 8`, `loadMore`).
  `ScrollToTopButton` is mounted at the route boundary (not inside the explorer) so it only
  ever exists on this page.
- `/destinations/guide/[guideId]/details` (`app/destinations/guide/[guideId]/details/page.tsx`)
  — a server component; `generateStaticParams` prerenders every known slug, an unknown one
  calls `notFound()`. It resolves `heroImageFor`/`countStops` server-side and passes them as
  primitives so the client bundle never imports the itinerary data module, then renders
  `GuideDetailView` (`components/destinations/detail/`) — now a thin **server** adapter that
  spreads the guide onto `ItineraryDetailView`, the provenance-free template shared with
  `/plan` and the actual `"use client"` boundary. `GuideAuthorBar` is handed to it as a
  `byline` slot, the same trick the `footer` slot already used. `ItineraryDetailView` and its
  `useGuideDetail` hook
  (`lib/hooks/useGuideDetail.ts`) own all client state in one place — open day accordions,
  the day-filter applied to the map, selected/saved stops — because the desktop split lets
  either pane drive the other (a day header filters the map, a pin selects a reading-column
  row). Desktop (`lg:`) is a two-pane viewport-filling split done entirely with flex
  (`h-screen overflow-hidden` on the page, `flex-1 min-h-0` on the row, `overflow-y-auto` on
  the reading column); below `lg` it unwinds to normal document flow with the map as a modal
  reached via `MapOverlaySheet`. `useMediaQuery` (`lib/utils/useMediaQuery.ts`) is what lets
  the hook itself answer "is the map on screen" inside event handlers, where the CSS `lg:`
  breakpoint isn't observable. None of the saved/like/follow toggles persist — no accounts
  API exists yet, so they reset on navigation.

### Component layout (`src/components/`)

Five groups, each consumed by a specific layer above:

- `landing/` — `Hero`, `HeroGlobe`, `PromptBox`, `Features`, `CtaBand`. `PromptBox` is the
  only client component on `/`; submitting or picking a chip does `router.push("/plan?q=…")`.
  `HeroGlobe` is a `"use client"` `<canvas>` — a from-scratch port of a design-file canvas
  routine that loops the hero backdrop between a flat dot lattice and a rotating dot-matrix
  globe (land mask, orbiting node mesh, great-circle flight arcs). Treat its numeric constants
  as tuned/signed-off; if the visual needs to change, prefer adjusting the constants over
  rewriting the projection math.
- `plan/` — `PlanDetailView` (maps a `TripPlan` onto the shared detail template), plus
  `PlanByline`, `HeroPhotoCredit` and `PlanFallbackNotice`. All server components, so none
  of them reach the client bundle. `PlanFallbackNotice` renders only when
  `aiGenerated === false` — it is what stops `PlanByline`'s "Generated from your prompt"
  being a lie when the offline fallback is showing.
  - The old `planboard/` group (`PlanBoard`, `RouteMap`, `FlightsCard`, `ChecklistCard`,
    `HotelsCard`) was **deleted** when `/plan` moved onto the detail template.
- `auth/` — `AuthShell` (the globe-backdrop sign-in/sign-up scaffold — it renders the
  shared `SiteNav`, not a nav of its own), the `Field` /
  `FormError` / `SubmitButton` form primitives, `SignInForm` / `SignUpForm`, and the nav's
  `NavAccount` + `SignOutButton`. `SignUpForm` is the only one that talks to HTTP directly
  (`POST /api/users`, after a client-side `registerSchema` pre-flight that only saves a round
  trip — the route re-validates regardless); everything else goes through the
  `(auth)/actions.ts` server actions.
- `site/` — `SiteNav` and `SiteFooter`. `SiteNav` is the **only** top bar in the app —
  every page renders it (landing hero and the auth pages with `variant="onDark"`, `/plan`
  and its `loading.tsx` with `variant="onLight"`); don't add a page-specific nav. Its
  marketing links are root-relative hashes (`/#how`) rendered with `next/link` so they
  resolve from off-landing pages while staying a same-route hash scroll on `/`.
- `destinations/` — `DestinationsExplorer`/`DestinationsSearchBand`/`DestinationsResults`/
  `GuideCard`/`ScrollToTopButton` for the `/destinations` feed, plus a `detail/` subfolder
  (`GuideHero`, `GuideAuthorBar`, `GuideStatsStrip`, `CollapsibleSection`, `DaySection`,
  `StopRow`, `StopThumb`, `StopPin`, `TransferConnector`, `StopDetailCard`, `GuideMap`,
  `MapOverlaySheet`, `GuideDetailView`) for the guide detail split view. See "Destinations"
  above.

### Map

`GuideMap.tsx` (destinations detail) renders a live MapLibre map via
`@vis.gl/react-maplibre`, and is now the app's **only** map — `/plan` reaches it through the
shared detail template. `package.json` depends on `react-map-gl` (a
meta-package that re-exports either `@vis.gl/react-mapbox` or `@vis.gl/react-maplibre`), but
the code imports `@vis.gl/react-maplibre` directly — import from that package, not
`react-map-gl`, when touching either map.

### Styling

Hanken Grotesk (sans) + Newsreader italic (serif accent, headings only) loaded via
`next/font/google` in `src/app/layout.tsx`. Tailwind v4 has no `tailwind.config.js`: it's
wired through the `@tailwindcss/postcss` plugin and pulled in via `@import "tailwindcss"`
plus the `@theme` / `@theme inline` blocks in `src/app/globals.css`, which is also where the
brand color tokens (`--color-brand-*`, `--color-gold*`, etc.) and the shared motion primitives
(`.tp-rise`, `.tp-btn`, `.tp-chip`, `prefers-reduced-motion` overrides) live. Reach for an
existing token/class before hand-rolling a new gradient or animation.

### Framework specifics

- Path alias `@/*` → `src/*` (`tsconfig.json`).
- `types/routes.d.ts` / `types/validator.ts` are regenerated by Next's typed-routes feature
  on every `dev`/`build` — never hand-edit them. They back the global `PageProps<Route>` /
  `LayoutProps<Route>` helpers; `params` and `searchParams` are `Promise`s on every route and
  must be `await`ed (see `plan/page.tsx`'s `PageProps<"/plan">` usage).
- `next/cache` (see `types/cache-life.d.ts`) exports `updateTag`, `revalidateTag`,
  `revalidatePath`, `refresh`, `unstable_cache`, `unstable_noStore`, plus the `"use cache"`
  profile helpers `cacheLife`/`cacheTag`. Built-in `cacheLife` profiles: `default`, `seconds`,
  `minutes`, `hours`, `days`, `weeks`, `max`, or a custom `{ stale, revalidate, expire }`
  object. Not yet used anywhere in this repo — everything is currently rendered fresh.
