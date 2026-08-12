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
trip request ("5 days in Italy with a €1,000 budget") flows through one shared `Plan`
shape into three routes:

- `/` (`src/app/page.tsx`) — marketing landing page; statically renders the canonical
  Italy demo plan.
- `/plan?q=<sentence>` (`src/app/plan/page.tsx`) — results page. Server component that
  calls the planning layer directly (not via HTTP), overlays an AI-generated route via
  `withAiRoute`, and renders the same `PlanBoard`.
- `/api/plan` (`src/app/api/plan/route.ts`) — `GET ?q=` / `POST { query }` HTTP mirror of
  the same planning layer (mock plan + `withAiRoute`), for non-page consumers.
- `/api/ai/[agentId]` (`src/app/api/ai/[agentId]/route.ts`) — generic `POST` chat endpoint
  over any agent in the OpenRouter registry; body is `{ messages: ChatMessage[] }`, the
  agent's system prompt is injected server-side. Not currently used by any page — driven
  from the client via the `useAgent` hook (`src/lib/hooks/useAgent.ts`).

Plus the auth routes — `/sign-in`, `/sign-up`, `/api/auth/[...nextauth]`, `POST /api/users`
— described under "Auth" below.

### Data layer (`src/lib/`)

- `types.ts` — the `Plan` contract. Single source of truth; every UI component and the
  data layer below depend on this shape. Change here first when the plan shape changes.
- `demo.ts` — `italyPlan`, the canonical hand-tuned demo plan shown on the landing page
  and returned for Italy-shaped queries.
- `plans.ts` — `getPlanForQuery(query)`: a pure, deterministic mock "backend". Regex-parses
  days/budget from the sentence, routes Italy/Portugal/Japan to curated plans (via
  `withOverrides`, which reapplies the parsed days/budget onto a curated base), and falls
  back to `buildGenericPlan` (looks up a known city or defaults to Barcelona) for anything
  else. No network calls, no randomness — this is the seam a real planning/flights API will
  eventually replace.

### AI layer (`src/lib/openrouter/`, `src/lib/aiRoute.ts`)

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
  - `route-planner` — given the trip sentence + day count, returns strict JSON
    (`{"destination","cities":[{"name","lat","lng"}]}`) picking a real, logically-ordered
    city sequence. Runs on a free reasoning model (`openai/gpt-oss-20b:free`) that burns
    hidden reasoning tokens before the JSON, so `maxTokens` is set generously (2000) —
    tightening it truncates the JSON and silently triggers the mock-route fallback below.
- `aiRoute.ts` — `withAiRoute(plan)`: calls the `route-planner` agent, validates and parses
  its JSON (`extractJson`, `isValidCity`, `isValidDestination`), converts the city list into
  a `RoutePlan` (splitting the trip's days across stops, computing leg distances via
  haversine), and overlays it onto `plan.route` — also correcting `plan.destination`/`title`
  when the model's inferred destination disagrees with the mock backend's guess. Any
  failure (missing key, network error, bad JSON, failed validation) resolves to the
  original `plan` unchanged rather than throwing, so both `/plan` and `/api/plan` always
  render — with the deterministic mock route as silent fallback. This is the one place in
  the data layer that makes a network call; `plans.ts` stays pure on purpose.

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

### Component layout (`src/components/`)

Four groups, each consumed by a specific layer above:

- `landing/` — `Hero`, `HeroGlobe`, `PromptBox`, `Features`, `CtaBand`. `PromptBox` is the
  only client component on `/`; submitting or picking a chip does `router.push("/plan?q=…")`.
  `HeroGlobe` is a `"use client"` `<canvas>` — a from-scratch port of a design-file canvas
  routine that loops the hero backdrop between a flat dot lattice and a rotating dot-matrix
  globe (land mask, orbiting node mesh, great-circle flight arcs). Treat its numeric constants
  as tuned/signed-off; if the visual needs to change, prefer adjusting the constants over
  rewriting the projection math.
- `planboard/` — `PlanBoard` (layout shell) plus `RouteMap`, `FlightsCard`, `ChecklistCard`,
  `HotelsCard`. Pure presentation driven entirely by a `Plan` prop, so the same board renders
  identically on the landing preview and `/plan`. `RouteMap` accepts a `mapShape` prop
  (`Plan.mapShape`, e.g. `"italy"`) that is currently unused dead code left over from an
  earlier hand-drawn-SVG map — the live map is MapLibre-based and doesn't consume it yet
  (hence the standing `no-unused-vars` lint warning there).
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

### Map

`RouteMap.tsx` renders a live MapLibre map via `@vis.gl/react-maplibre`. `package.json`
depends on `react-map-gl` (a meta-package that re-exports either `@vis.gl/react-mapbox` or
`@vis.gl/react-maplibre`), but the code imports `@vis.gl/react-maplibre` directly — import
from that package, not `react-map-gl`, when touching the map.

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
