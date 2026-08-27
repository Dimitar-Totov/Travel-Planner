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
- `npm run seed:guides` — one-off: writes the nineteen guides in
  `src/lib/destinationGuides.ts`/`guideItineraries.ts` into MongoDB as published `Guide`
  documents (`scripts/seed-guides.ts`). Idempotent — safe to run more than once. See
  "Destinations" below.

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
— described under "Auth" below, the destinations routes — `/destinations`,
`/destinations/guide/[guideId]/details`, `POST /api/guides`, `POST /api/uploads` —
described under "Destinations" below and "Storage" below, and `/create-guide` — described
under "Create Guide" below.

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

### Storage (`src/lib/storage/r2.ts`, `POST /api/uploads`)

Cloudflare R2 client wiring, presigned-upload-URL generation, and public-URL building.
`POST /api/uploads` (`src/app/api/uploads/route.ts`) is the one route that calls this
module's upload-generation exports; guide images on `/create-guide` are, for now, still
wired up as in-memory data URLs client-side (`components/create-guide/imageUpload.ts`) — the
frontend hookup to this endpoint is separate work. `POST /api/guides` (see "Destinations"
below) reads the same `R2_PUBLIC_BASE_URL` env var directly, to host-check a submitted photo
URL rather than to build one — see that route's doc comment for why it doesn't go through
this module for that. R2
is S3-compatible, so it's reached through `@aws-sdk/client-s3`'s `S3Client` pointed at R2's
endpoint rather than a Cloudflare-specific SDK: `region: "auto"` (required by the SDK's
types, ignored by R2 — routing is by endpoint) and `endpoint:
https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. `getR2Client()`/`r2Bucket()` follow
`mongodb.ts`'s convention — env vars read at call time, not module evaluation, client cached
on `globalThis` — and `isR2Configured()` is a non-throwing probe mirroring `unsplash.ts`.
Server-only; never import it from a client component.

The intended flow — upload via a presigned **PUT**, serve via R2's managed public subdomain,
no custom domain (the user has none available):

- `createUploadUrl(options)` takes `{ key, contentType, expiresIn? }` and returns an object
  with an `uploadUrl`, a `publicUrl`, and the `key`. `uploadUrl` is a presigned
  `PutObjectCommand` URL (via `getSignedUrl` from `@aws-sdk/s3-request-presigner`) the
  browser PUTs the file to directly; it defaults to a 5-minute expiry (R2 allows 1s–7d, but
  the URL only needs to outlive one upload — the longer it's valid, the longer a
  leaked/logged copy lets someone overwrite that key). `ContentType` is signed into the
  command, so the browser's PUT must send that exact `Content-Type` header or the whole
  signature is rejected. `publicUrl` is `r2PublicUrl(key)` computed once here so a caller
  storing it in Mongo can't let the two drift. `guidePhotoKeyForContentType(contentType)`
  mints the key — a `guide-photos/` prefix plus `crypto.randomUUID()` plus the extension its
  content type maps to, so two authors uploading `cover.jpg` never collide. Keyed off the
  content type rather than a filename because `POST /api/uploads`' body is `{ contentType }`
  alone and no filename ever reaches this server (the upload is a direct browser-to-R2 PUT).
  `GUIDE_PHOTO_CONTENT_TYPES` (five concrete raster types — `image/jpeg`, `image/png`,
  `image/webp`, `image/avif`, `image/gif`; `image/svg+xml` deliberately excluded, since SVG
  can embed `<script>`/event handlers and would be served back from this app's own bucket
  domain) is `/api/uploads`' request-validation allowlist and this key derivation's
  extension map in one place, re-exported from the route as `ALLOWED_UPLOAD_CONTENT_TYPES`.
- `POST /api/uploads` — auth-gated the same way `POST /api/guides` is (`await auth()`, 401 if
  absent; it's the only check standing between an anonymous request and a presigned write
  handle into the bucket). Body `{ contentType }`, validated against
  `GUIDE_PHOTO_CONTENT_TYPES`; 201 `{ uploadUrl, publicUrl, key }`; 500 (with a named log) if
  `isR2Configured()` is false. The key is always server-derived — a client never supplies one,
  which is what stops one author's upload from overwriting another author's object. **No
  server-side file-size limit exists anywhere in this flow** — the PUT this presigns goes
  browser→R2 directly and never passes back through this server, so nothing here can inspect
  or cap the byte count; `MAX_PHOTO_BYTES` (`components/create-guide/imageUpload.ts`) is a
  client-side-only guard. Binding a cap into the presigned request itself would need
  switching this from a presigned **PUT** to a presigned **POST** (S3-compatible presigned
  POST supports a `content-length-range` policy condition; SigV4 PUT presigning has no
  equivalent field) or an out-of-band check (e.g. an R2 Event Notification deleting oversized
  objects after the fact) — neither is implemented.
- **CORS is required and is not code** — a browser PUT to a presigned URL is cross-origin,
  and R2 buckets have no CORS policy by default. Must be set on the bucket (R2 → bucket →
  Settings → CORS Policy): `AllowedOrigins` (the app's origin), `AllowedMethods: ["PUT"]`,
  `AllowedHeaders: ["Content-Type"]` at minimum, `ExposeHeaders: ["ETag"]` recommended. See
  https://developers.cloudflare.com/r2/buckets/cors/. This is the most likely reason a first
  real upload fails.
- `requestChecksumCalculation: "WHEN_REQUIRED"` (not the SDK's `WHEN_SUPPORTED` default) is
  what makes the presigned browser PUT above work at all: `WHEN_SUPPORTED` signs an
  `x-amz-checksum-crc32` header into the URL, and a browser doing a plain `fetch` PUT never
  sends that header, so the signature fails with a 403. Harmless for the server-side
  `PutObjectCommand` calls this module makes directly (R2 added CRC32 support Feb 2025).
- **Serving: R2's managed `https://pub-<hash>.r2.dev` public subdomain** (bucket → Settings →
  Public access → enable), not a custom domain — accepted here as a known trade-off (r2.dev
  is rate-limited and Cloudflare-documented as development-only) because no custom domain is
  available. `R2_PUBLIC_BASE_URL` holds that base and stays the swap-in seam if a custom
  domain becomes available later — only that one var would need to change.
  `r2PublicUrl(key)` builds the permanent URL from it; **this is the value that gets stored
  in Mongo, never a presigned URL.** A presigned _GET_ was considered and rejected as the
  stored value specifically: its signature expires within 7 days (R2's cap), so a stored
  link would silently rot, and a fresh signature on every render would defeat the image
  optimizer's cache. A proxy route was also rejected — no reason to push every image byte
  through the server when R2 already serves them directly. Per the user's call, guide
  documents store the resolved absolute URL, not the bare key — the accepted trade-off is
  that moving to a custom domain later means a data migration over stored photo URLs, not
  just a config change. `r2PublicUrl` deliberately isn't `NEXT_PUBLIC_`: every caller renders
  server-side and ships a plain string prop, so the domain can change without a client
  rebuild.
- `next.config.ts` derives `images.remotePatterns`' R2 entry from the same
  `R2_PUBLIC_BASE_URL` (`new URL(...).hostname`, unset → no entry, unparseable → throws at
  config load), with `search: ""` locked down since R2 objects carry no query string
  (contrast `images.unsplash.com`'s pattern, left permissive because `unsplash.ts` sizes
  photos with `?w=…&q=…`). `pub-<hash>.r2.dev` is a normal hostname and needs no special
  handling. Reading the var there works because Next loads `.env.local` before importing the
  config file (`loadEnvConfig` in `node_modules/next/dist/server/config.js:1182`, ahead of
  the `next.config.ts` import) — that ordering is what makes a config-file env read legal.

### Destinations (`src/app/destinations/`, `src/lib/destinationGuides.ts`, `src/lib/guideItineraries.ts`)

A community guide feed plus a per-guide detail page, both backed by MongoDB end to end —
writing (`POST /api/guides`) and reading (`src/services/guides.ts`) are both live. There is
still no _list/detail_ HTTP API for a non-page consumer (only the two server components read
`services/guides.ts` directly, the way `/plan` calls `buildTripPlan` directly instead of
hitting `/api/plan`), but nothing here is hardcoded/in-memory anymore.

- `lib/destinationGuides.ts` / `lib/guideItineraries.ts` — **seed source data, not what
  `/destinations` renders.** These are the pre-Mongo hardcoded modules (nineteen guides, not
  twelve, despite the older name/comment) that `scripts/seed-guides.ts` reads to populate a
  fresh database; nothing on the render path imports the arrays anymore. Both stay live for
  three other things, though: `destinationGuides.ts` defines `DestinationGuide` — the view
  shape `services/guides.ts` maps every Mongo document onto, so `GuideCard`/`GuideAuthorBar`/
  the stats strip are unchanged — and `guideItineraries.ts` defines `GuideItinerary` plus the
  still-called `heroImageFor`/`countStops` helpers. `getGuideDetail`/`getGuideItinerary` (the
  hardcoded-array lookups) are dead as render-path code — nothing outside the seed script
  calls them anymore — but kept rather than deleted unilaterally.
- `src/services/guides.ts` — the **only** module that talks to the `guides` collection.
  `listPublishedGuides()` → the feed's `DestinationGuide[]`; `getPublishedGuideDetail(slug)`
  → `{ guide, itinerary, stopImages } | null` for one published guide (a draft or an unknown
  slug is invisible to both — `.findOne({ slug, status: "published" })`). Everything returned
  is a plain, JSON-serializable object — string/number/array fields only, no `ObjectId`s, no
  `Date`s — because both cross into client components as props. Mapping decisions worth
  knowing:
  - `avatarGradient` is derived, not stored: a small string hash of the author's own
    `ObjectId` picks a hue, then reproduces the hand-picked "light diagonal to dark" gradient
    recipe every seeded gradient already follows. Same author → same gradient on every guide
    they write.
  - `meta` (`"7 days · ¥¥"`) is derived from `dayCount`/`currency`/`approxCostEUR` at read
    time, not stored — the hardcoded guides' doubled-vs-single currency symbol didn't follow
    one clean rule, so this is a documented approximation (`formatMeta`), not a byte-for-byte
    reproduction of the old copy.
  - **`place`/`approxCostEUR` are optional on `Guide` but required on the view types** —
    `useCreateGuideForm` never collects either, so anything published through `/create-guide`
    has neither, while the seeded guides do. `place` falls back to the guide's own `title`
    (still meaningful alt text). `approxCostEUR` falls back to `Number.POSITIVE_INFINITY` —
    deliberately not a fabricated finite guess, since that could misplace an unpriced guide in
    the "Budget under €1k" tab; `Infinity < 1000` is correctly `false`, and
    `Infinity.toLocaleString()` renders as `"∞"` on the stats strip rather than a wrong number
    or a crash. The authoring form growing these two fields is the real fix, tracked as a gap,
    not routed around here.
  - `heroImageFor`'s `w=800`→`w=1600` swap only does anything for an Unsplash-hosted cover
    (the seeded guides); an R2-hosted cover (`/create-guide`) has no query string at all
    (`next.config.ts` locks that `remotePattern` to `search: ""`), so the `.replace` is a
    confirmed, harmless no-op there — an R2 cover is the author's own upload, not a
    server-resizable Unsplash derivative.
  - `stopImages` is built from each stop's stored `photoUrl` (`IGuideStop.photoUrl`), keyed
    `"<dayIndex>-<stopIndex>"` — no Unsplash call, so the rate-limit concern below doesn't
    apply to it.
- `scripts/seed-guides.ts` (`npm run seed:guides`) — one-off script that inserts the
  hardcoded guides above into MongoDB as `status: "published"` documents, attributed to one
  placeholder `User` (`travel-planner-seed`) it creates if missing, with an unusable random
  password. **Idempotent** — `Guide.slug` is uniquely indexed, and the script checks for (and
  skips) an existing slug before writing, so re-running it never duplicates or overwrites
  anything. Writes through the `Guide` model (`Guide.create`), not a raw collection insert,
  so `pre("save")` computes `dayCount`/`stopCount` the normal way. Run via `tsx`
  (`@next/env`'s `loadEnvConfig` loads `.env.local` first, the same loader Next itself uses —
  `tsx` doesn't read dotenv files on its own).
- `/destinations` (`app/destinations/page.tsx`) — a server component that calls
  `listPublishedGuides()` once and passes the array to `DestinationsExplorer` as a prop.
  Filtering/search/pagination are unchanged and still entirely client-side:
  `useDestinationsExplorer` (`lib/hooks/useDestinationsExplorer.ts`) takes the guides array as
  an argument instead of importing the hardcoded one, and still owns tab selection
  (recent/loved/budget/weekends), the committed search query (typing alone doesn't filter —
  `search()` commits it), and pagination (`PAGE_SIZE = 8`, `loadMore`). An empty array (no
  guides published/seeded yet) is a real, expected state — `DestinationsResults` renders
  distinct copy for "nothing published yet" vs. "your search matched nothing"
  (`hasAnyGuides`). `ScrollToTopButton` is mounted at the route boundary (not inside the
  explorer) so it only ever exists on this page.
- `/destinations/guide/[guideId]/details` (`app/destinations/guide/[guideId]/details/page.tsx`)
  — a server component that calls `getPublishedGuideDetail(slug)`; a missing/unpublished slug
  calls `notFound()`. **No `generateStaticParams`** — slugs live in Mongo now and aren't
  knowable at build time, so the route renders dynamically per request. Resolves
  `heroImageFor`/`countStops` server-side (unchanged) and passes them, plus the `stopImages`
  map straight from the service, as primitives/plain objects so the client bundle never
  imports the guide data modules. Renders `GuideDetailView` (`components/destinations/detail/`)
  — a thin **server** adapter that spreads the guide onto `ItineraryDetailView`, the
  provenance-free template shared with `/plan` and the actual `"use client"` boundary.
  `GuideAuthorBar` is handed to it as a `byline` slot, the same trick the `footer` slot
  already used. `ItineraryDetailView` and its `useGuideDetail` hook
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
- **Stop photos are real now, but only for what a guide actually stored.** A guide seeded
  from `guideItineraries.ts` has no per-stop `photoUrl` (that data never had one), so it still
  renders `StopThumb`'s gradient placeholder for every stop — nothing regressed, seeded guides
  just don't have upload data to show. A guide published through `/create-guide` with per-stop
  uploads shows real photos via the `stopImages` map above. `/plan` is unaffected and still the
  only live-Unsplash path (`resolveStopImages`, `lib/unsplash.ts`) — see the rate-limit note
  under "AI layer" above for why the guide route still can't call it.
- `models/Guide.ts` — the Mongoose model for the `guides` collection, merging
  `DestinationGuide` + `GuideItinerary` into one document (days/stops embedded, author
  referenced by `ObjectId`, `dayCount`/`stopCount` maintained by a `pre("save")` hook so the
  "Weekends"/"recent"/"Loved" tab filters stay indexable). Written to by `POST /api/guides`
  (below) and read by `services/guides.ts` above — the only two things that touch the
  collection.
  - Content fields are `required` **only when `status === "published"`**
    (`requiredWhenPublished`), never unconditionally. A draft starts empty — the editor seeds
    `heroTitle`/`blurb`/`intro`/`bestTime` as `""`, and Mongoose counts `""` as missing — so
    blanket `required: true` would make the first save of a new draft throw and render the
    `status: "draft"` default unusable. Day/stop subdocuments can't use the same trick (`this`
    is the subdocument there, with no `status` to read), so nothing inside them is required
    and publish-time completeness is the API layer's job, not the schema's. `lat`/`lng` are
    the one exception inside a stop subdocument — `required: true` unconditionally, at every
    status, because a `DraftStop` is never actually coordinate-less client-side either (see
    `useCreateGuideForm.ts`'s `newStop` seeding below).
- `lib/validation/guide.ts` — Zod validation for `POST /api/guides`, following
  `lib/validation/auth.ts`'s convention (dependency-free apart from Zod, so it's safe for a
  future client pre-flight to import). Mirrors `Guide.ts`'s own draft/published split rather
  than hand-rolling a second one: `draftGuideSchema` is lenient (matches `requiredWhenPublished`
  being unset), `publishGuideSchema` is built from it with `.extend()` — only the fields
  publishing tightens (`heroTitle`/`heroAccent`/`blurb`/`intro`/`bestTime`/`coverImageUrl`
  non-empty, `days` non-empty) are redeclared, every bound (max lengths, array limits,
  coordinate ranges) is inherited from the draft schema so the two can't drift apart. `status`
  is deliberately not a field on either schema — a `guideStatusSchema` validates it on its own
  first so the route can pick which of the two to run. Every array and string is bounded (see
  the module's own comment for the numbers and what they're sized against —
  `guideItineraries.ts`'s largest hardcoded guide, ~30 stops/7 days). `author`, `slug`,
  `likes`, `views`, `verified`, `dayCount`, `stopCount` are not fields on either schema and so
  are stripped by Zod's default object behavior if a client sends them — see the module comment
  for why each is server-owned. `nestedFieldErrorsOf` lives here too: it's `fieldErrorsOf`
  (`lib/validation/auth.ts`) for a nested payload, joining a Zod issue's full `path` into a
  dotted key (`"days.2.stops.5.lat"`) instead of collapsing everything under one top-level key
  the way `fieldErrorsOf` does for a flat credentials form — `fieldErrorsOf` itself is
  unchanged, since `POST /api/users`/`SignUpForm`/`SignInForm` all still depend on its flat
  behavior.
- `POST /api/guides` (`src/app/api/guides/route.ts`) — creates a guide, draft or published.
  201 `{id,slug,status,createdAt}` (never the whole document), 400
  `{error,fields:{[path]:message}}` (nested paths from `nestedFieldErrorsOf`, or a plain
  `{error}` for unparseable/non-object JSON), 401 `{error}`, 409 `{error}` (slug collision),
  500 `{error}`. Three things are enforced here rather than in `lib/validation/guide.ts`,
  because the module has to stay client-importable and none of these can be:
  - **Auth is the only gate.** `src/proxy.ts`'s matcher excludes all of `/api/*` and
    `PROTECTED_PATHS` (`lib/auth.ts`) is empty, so `const session = await auth()` + a 401 on
    no session is the sole thing standing between an anonymous request and a written document.
  - **`author` is `session.user.id`, never a request-body value** — the load-bearing line in
    the route; a client-supplied author would let anyone forge authorship.
  - **`slug` is derived server-side from `title`** (lowercased, hyphenated, diacritics
    stripped, length-capped) — never accepted from the client, since it's the unique-index URL
    identity. Relies on the unique index + an `E11000` catch (409, "try a different title")
    rather than a racy pre-check, exactly like `/api/users` does for username/email; a
    silently-appended discriminator was considered and rejected so a guide's URL always matches
    what the author actually typed.
  - **Every photo URL (`coverImageUrl`, each stop's `photoUrl`) is host-checked against
    `R2_PUBLIC_BASE_URL`** (see "Storage" above) before the write — a URL on some other host
    would validate fine as a URL, persist, and only fail later at render time against
    `next/image`'s `remotePatterns`, far from its cause. Reads the env var directly rather than
    through `storage/r2.ts` (which has no exported getter for the bare base URL, only
    `r2PublicUrl(key)`, built for the opposite direction); an unset var is a 500, a mismatched
    host is a 400 naming the exact field.

### Create Guide (`src/app/create-guide/`, `src/components/create-guide/`, `src/lib/hooks/useCreateGuideForm.ts`)

The authoring counterpart to the destinations detail page — write a guide, preview it
through the exact same template a reader would see. The draft itself is still **in-memory
only** (lost on reload, like every other piece of unpersisted state in this app), but
**Publish is wired**: it uploads every photo to R2 and `POST`s the guide to `/api/guides`.
**Not gated** — no `PROTECTED_PATHS` entry and no auth modal; gating it behind sign-in and a
future `tourist-guide` role is a TODO in `README.md`, not implemented. That is why an
anonymous author can write a whole guide and only meet the API's 401 at the end, which
`usePublishGuide` handles as its own failure kind rather than a generic error.

- **On success the author is navigated to their new guide** —
  `/destinations/guide/<slug>/details`, which resolves because both destinations routes now
  read from Mongo (see "Destinations"). `router.refresh()` fires first: the feed is a
  per-request server component and this session's router cache still holds the version from
  before the guide existed, so without it a later trip back to `/destinations` can show a
  list the new guide is missing from. Navigation is skipped when the 201 body yields no
  slug — the guide is saved either way, but there is no URL to send anyone to, and
  `PublishStatus` says exactly that rather than inventing one.
  - Navigating away **discards the in-memory draft**, which is acceptable only because the
    guide is persisted by that point. It does mean an author who spots a typo has no way
    back in: there is no edit-an-existing-guide flow and no `PATCH /api/guides/:id`.
- `lib/hooks/usePublishGuide.ts` — the whole flow, kept out of `CreateGuidePageShell` for
  the same reason `useCreateGuideForm` is. Order is load-bearing: pre-flight (a
  `publishGuideSchema.omit({ coverImageUrl: true })` parse — the cover is still a `data:` URL
  at that point, so the real one is the route's to check), _then_ uploads, _then_ the POST.
  Validating first means a half-written guide isn't made to sit through twenty megabytes of
  PUTs before being told the intro is empty. Uploaded URLs are cached by data URL across
  attempts, so the likeliest failure (a 409 telling the author to retitle) doesn't re-upload
  the same bytes.
  - **Unplaced stops are the one rule only the client can enforce.** `DraftStop.placed` is
    editor-only and never reaches the wire, and an unplaced stop carries a _seeded_
    coordinate borrowed from its neighbour — a perfectly valid lat/lng to both
    `publishGuideSchema` and `Guide.ts`. So the hook blocks publishing and explains why,
    rather than letting readers be sent to a plausible-looking wrong place.
- `lib/uploadGuidePhotos.ts` — plain async plumbing, no React. Per photo: parse the MIME type
  out of the data URL, `POST /api/uploads` for a presigned PUT, then PUT the blob with that
  **exact** content type (it's signed into the URL — `blob.type` is deliberately not used,
  since the browser derives it separately and may normalise it differently). Runs
  `UPLOAD_CONCURRENCY` (3) at a time: firing 20 multi-megabyte PUTs at once makes them all
  slow down together and pins every blob in memory, and the progress counter would sit at
  0/20 until the end.
- `components/create-guide/PublishStatus.tsx` — progress, failure and success panels. Lives
  _inside_ the sticky header block because the button producing it is in that bar and can be
  pressed at any scroll position; a panel in normal document flow would render off-screen.
  Maps the API's dotted paths (`"days.2.stops.5.lat"`, see `nestedFieldErrorsOf`) back to
  author-facing locations ("Day 3, stop 6").

- `useCreateGuideForm.ts` — every piece of draft state in one hook, following
  `useGuideDetail`'s flat state-plus-actions convention. Holds the guide-level fields
  (title/accent/tags/blurb/intro/currency/bestTime/coverImage), general tips, and
  `DraftDay[]` (`DraftDay`/`DraftStop` extend `GuideDay`/`GuideStop` with a stable `id` —
  indices shift on reorder/remove and would re-key the subtree mid-edit). `DraftStop` also
  carries `placed: boolean`, since `GuideStop.lat`/`lng` are non-optional numbers and "no
  location chosen yet" needs its own flag; a freshly added stop is seeded with the nearest
  already-placed stop's coordinates purely so the preview map has somewhere sane to draw it
  instead of zooming out to fit a pin at `0,0`. `asGuideDays` strips the editor-only fields
  down to a real `GuideDay[]` for the preview.
- `CreateGuidePageShell.tsx` — the `"use client"` boundary `page.tsx` hands `nav`/`footer`
  slots into. Owns the Edit/Preview mode switch and the Publish button. The
  `lg:h-screen lg:overflow-hidden` wrapper the real guide-detail page applies unconditionally
  is applied here **only while previewing** — it would trap the form's own scroll otherwise.
- `CreateGuidePreview.tsx` — the **third** adapter onto `ItineraryDetailView`, alongside
  `GuideDetailView` (a published guide) and `PlanDetailView` (an AI plan): it spreads the
  live draft onto the identical shared template, so what an author sees is the real render,
  not an approximation of it. `byline` is a small local "Draft preview" strip rather than a
  repurposed `GuideAuthorBar` (which hard-requires a real `DestinationGuide`); `notice` is a
  gold `PlanFallbackNotice`-style note that also counts any unplaced stops.
- `LocationPickerModal.tsx` — click-to-place coordinates for one stop, because a transposed
  lat/lng digit is invisible in a text field and catastrophic on the map. Renders its own
  lean MapLibre `<Map>` rather than reusing `GuideMap` (whose whole job is selecting
  _existing_ pins via `fitBounds`+route line+stop card — bolting a placement mode onto it
  would compromise the two routes that already depend on it as-is). Shares `MAP_STYLE` with
  `GuideMap.tsx` via `components/destinations/detail/mapStyle.ts` so the CARTO tile config
  has exactly one source of truth. Click or drag the marker to set a point; every
  already-placed stop in the draft renders as dimmed context so an author can see what they've
  placed so far. **Only ever mounted while Edit mode is active and a stop is targeted** —
  see the "Map" section below for why that matters.

### Component layout (`src/components/`)

Six groups, each consumed by a specific layer above:

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
- `create-guide/` — `CreateGuidePageShell`, `CreateGuideForm`, `ItineraryEditor`,
  `StopEditor`, `ListInput`, `FormControls`, `LocationPickerModal`, `CreateGuidePreview` for
  the `/create-guide` editor + preview. See "Create Guide" above.

### Map

Two MapLibre surfaces, both via `@vis.gl/react-maplibre` — never `react-map-gl`, the
meta-package `package.json` depends on but the code never imports directly:

- `destinations/detail/GuideMap.tsx` — read-only: numbered pins for an itinerary's existing
  stops, `fitBounds` framing, click-to-select. Reached by both `/plan` and
  `/destinations/guide/[guideId]/details` through the shared detail template, and by
  `create-guide/CreateGuidePreview.tsx` the same way.
- `create-guide/LocationPickerModal.tsx` — the one click-to-**place** surface in the app,
  used to set a draft stop's `lat`/`lng`. A deliberately separate, leaner map rather than a
  mode bolted onto `GuideMap` (see "Create Guide" above); it shares `GuideMap`'s tile config
  via `destinations/detail/mapStyle.ts` so the two never drift.

Both surfaces hold the same standing rule — **exactly one MapLibre instance mounted at a
time** — because a second WebGL context alongside the first is wasted GPU memory for no
visible gain. `ItineraryDetailView` enforces it by construction (desktop pane vs. mobile
overlay, never both); `create-guide/CreateGuidePageShell.tsx` enforces it by gating the
picker on Edit mode, since Preview mode already mounts `GuideMap` through
`ItineraryDetailView`.

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
