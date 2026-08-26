import type { NextConfig } from "next";

// `process.env.R2_PUBLIC_BASE_URL` is readable here because Next loads
// `.env.local` (via `loadEnvConfig`) before it imports this file — see
// `node_modules/next/dist/server/config.js:1182`, which calls
// `loadEnvConfig(dir, ...)` inside `loadConfig()` ahead of requiring
// `next.config.ts`. Don't "simplify" this back to a hardcoded hostname:
// deriving it from the same var `src/lib/storage/r2.ts` reads keeps the
// domain defined in exactly one place.
const r2PublicHostname = ((): string | undefined => {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    // Unconfigured is a supported state — same as every other integration
    // in this app (Unsplash, Mongo, R2 itself) — so no remotePattern is
    // added rather than throwing here.
    return undefined;
  }
  try {
    return new URL(base).hostname;
  } catch {
    // A set-but-unparseable value is almost certainly a typo, and silently
    // dropping the remotePattern would surface as opaque 400s from the image
    // optimizer at request time instead of a clear failure at config load.
    throw new Error(
      `R2_PUBLIC_BASE_URL is set but not a valid URL: ${JSON.stringify(base)}`,
    );
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Unsplash URLs carry query params (`?w=…&q=…&auto=format&fit=crop` —
      // see `src/lib/unsplash.ts`), so this one must stay permissive on
      // `search`. Don't add a `search: ""` restriction here.
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(r2PublicHostname
        ? [
            {
              protocol: "https" as const,
              hostname: r2PublicHostname,
              // Objects on the R2 public base URL (today the managed
              // `pub-<hash>.r2.dev` subdomain, a custom domain later) are
              // served with no query string, so lock this down rather than
              // leaving it open to
              // arbitrary search params (Next's docs warn an omitted
              // `search` lets third parties push URLs through the
              // optimizer you didn't intend).
              search: "",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
