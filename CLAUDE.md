# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Tests
 
DO NOT run any tests, developer will do that manually. If some tests are needed developer will write to you.

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

### Component layout (`src/components/`)

Three groups, each consumed by a specific layer above:

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
- `site/` — `SiteNav` (dark variant on the landing hero, light variant elsewhere) and
  `SiteFooter`, shared across both routes.

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
