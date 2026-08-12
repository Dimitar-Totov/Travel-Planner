export { auth as proxy } from "@/lib/auth";

/**
 * Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (the
 * exported function/file behavior is otherwise unchanged - see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * This must be re-exported as named `proxy`, not `default`: Next's static
 * analyzer that checks this file's exports only recognizes a real
 * `export default ...` node or a named re-export literally called
 * `middleware`/`proxy` (get-page-static-info.js's
 * `validateMiddlewareProxyExports`) - `export { auth as default }` is a
 * named re-export whose exported name is `"default"`, which that check
 * doesn't special-case, so it fails with "must export a function" even
 * though the export works fine at runtime.
 *
 * All the actual "is this request allowed through" logic lives in the
 * `authorized` callback in `src/lib/auth.ts` (see `PROTECTED_PATHS` there) -
 * this file only decides which requests Proxy runs on at all, via `matcher`.
 *
 * The matcher below excludes:
 * - every `/api/*` route (this also covers `/api/auth/*`, so Auth.js's own
 *   sign-in/callback/session endpoints are never intercepted, in addition to
 *   `/api/plan` and `/api/ai/*` which must stay reachable anonymously)
 * - Next's static/image asset routes and common static files
 *
 * so Proxy is never in a position to swallow a static asset or an
 * `/api/auth/*` request, regardless of what `PROTECTED_PATHS` grows into.
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
