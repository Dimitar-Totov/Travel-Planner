/**
 * Shared "keep me signed in" cookie downgrade.
 *
 * Two places each queue a persistent session cookie and need to undo it
 * when the sign-in checkbox was unchecked:
 *
 *  - `signInAction` (`src/app/(auth)/actions.ts`), right after `signIn()`
 *    writes the first cookie of a new session.
 *  - `src/proxy.ts` - because `@auth/core`'s own per-request session refresh
 *    (the `session` action backing every `auth()` call) unconditionally
 *    re-stamps the cookie's Max-Age/Expires to a fresh 30-day window on
 *    *every* proxied request, not only at sign-in or at the 15-minute
 *    rotation boundary. A one-time downgrade at sign-in alone would be
 *    silently undone by the very next page navigation.
 *
 * Both call sites hold a cookie jar shaped like Next's `ResponseCookies`
 * (`next/headers`'s `cookies()` inside a Server Action is one at runtime -
 * it just narrows `.getAll()`'s TS type to `{name,value}`). This file only
 * reads `name`/`value` and writes known-good attributes, so both typings
 * satisfy it without a cast.
 */

const SESSION_COOKIE_NAME = "authjs.session-token";

interface MinimalCookie {
  name: string;
  value: string;
}

interface CookieJar {
  getAll(): MinimalCookie[];
  set(cookie: {
    name: string;
    value: string;
    httpOnly: boolean;
    sameSite: "lax";
    path: string;
    secure: boolean;
  }): unknown;
}

/**
 * Rewrites every already-queued session-token cookie on `jar` - handling
 * `@auth/core`'s own `.0`/`.1`/… chunk suffixes for an oversized token, and
 * matching whichever of the plain/`__Secure-`-prefixed names is actually
 * present - to a browser-session cookie: same name, value and other
 * attributes Auth.js itself would write, just without `Max-Age`/`Expires`,
 * so it's gone the moment the browser closes instead of surviving up to the
 * 30-day `REFRESH_TOKEN_TTL_MS` window.
 *
 * A no-op for anything not already queued, and for a cookie queued with an
 * empty value - that's Auth.js's own *delete* signal (`SessionStore.clean`,
 * used on sign-out or an unverifiable token), and re-queuing it without
 * `Max-Age: 0` would turn a deletion into a cookie that never gets deleted.
 */
export function forgetSessionCookieOnClose(jar: CookieJar): void {
  for (const cookie of jar.getAll()) {
    const bareName = cookie.name.replace(/^__Secure-/, "");
    const isSessionCookie =
      bareName === SESSION_COOKIE_NAME ||
      bareName.startsWith(`${SESSION_COOKIE_NAME}.`);

    if (!isSessionCookie || cookie.value === "") {
      continue;
    }

    jar.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookie.name.startsWith("__Secure-"),
    });
  }
}
