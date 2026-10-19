import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import { getToken } from "next-auth/jwt";

import { auth } from "@/lib/auth";
import { forgetSessionCookieOnClose } from "@/lib/authCookies";

/**
 * Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (the
 * exported function/file behavior is otherwise unchanged - see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * This must be exported as a real function named `proxy`, not `default`:
 * Next's static analyzer that checks this file's exports only recognizes a
 * real `export default ...` node or a named export literally called
 * `middleware`/`proxy` (get-page-static-info.js's
 * `validateMiddlewareProxyExports`).
 *
 * All the actual "is this request allowed through" logic lives in the
 * `authorized` callback in `src/lib/auth.ts` (see `PROTECTED_PATHS` there).
 * This function wraps `auth` for exactly one extra reason: "keep me signed
 * in" (see `src/app/(auth)/actions.ts`, `src/lib/authCookies.ts`). Every
 * request `auth()` touches re-stamps the session cookie's Max-Age to a
 * fresh 30 days via `@auth/core`'s own per-request session refresh - that's
 * the architecture's intended "sliding" session, but it also means a
 * sign-in with the checkbox unchecked would get silently re-persisted on
 * the very next navigation unless something undoes it on every pass. This
 * is that something, and it has to live here: this is the only place a
 * rotated/refreshed session cookie's `Set-Cookie` actually reaches the
 * browser (an `auth()` call from inside a React Server Component can't set
 * cookies during render - see `src/services/refreshTokens.ts`'s
 * `ROTATION_GRACE_MS` comment).
 */
// `NextAuthResult["auth"]`'s declared overloads don't include this one -
// `(req: NextRequest, event: NextFetchEvent) => Promise<Response>` - even
// though it's exactly what `export { auth as proxy }`/`export { auth as
// default }` relies on at runtime (next-auth's `initAuth`, `args[0]
// instanceof Request` branch). Without this cast TypeScript resolves the
// call against the `(req: NextApiRequest, res: NextApiResponse) =>
// Promise<Session | null>` overload instead - a real `NextRequest` isn't a
// `NextApiRequest`, and the return value isn't a `Session`.
const runAuthMiddleware = auth as unknown as (
  req: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await runAuthMiddleware(request, event);

  // Ground truth for which cookie name Auth.js is using on *this* request -
  // cheaper and more reliable than re-deriving `useSecureCookies` from the
  // request's protocol, which can be wrong behind a proxy that doesn't set
  // `x-forwarded-proto`.
  const secureCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("__Secure-authjs.session-token"));

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });

  // `undefined` (a session minted before this field existed) is treated as
  // remembered - see `JWT.rememberMe`'s doc comment.
  if (!token || token.rememberMe !== false) {
    return response;
  }

  // Wrapping in `NextResponse` (rather than editing `response` directly)
  // is what gives us the `.cookies` convenience API Next's `ResponseCookies`
  // provides - `new Response(body, init)` elsewhere in this app's auth
  // stack (`@auth/core`'s own `handleAuth`) uses the identical trick to
  // carry an existing status/headers/body onto a new instance.
  const downgraded = new NextResponse(response.body, response);
  forgetSessionCookieOnClose(downgraded.cookies);
  return downgraded;
}

/**
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
    "/((?!api|_next/static|_next/image|favicon.png|sitemap.xml|robots.txt).*)",
  ],
};
