/** The `?callbackUrl=` query param, narrowed to something safe to put back into
 *  the page. Mirrors the check `(auth)/actions.ts` runs before redirecting —
 *  that one is the security boundary, this one just keeps an attacker-supplied
 *  absolute URL from ever reaching the markup (as a hidden input, or as the
 *  href of the sign-in ⇄ sign-up swap link).
 *
 *  `safeRedirect` in the action can't be reused directly: `actions.ts` is a
 *  `"use server"` module, so every one of its exports has to be an async
 *  server function.
 */
export function sameOriginPath(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  // `//evil.com` is protocol-relative — a path by shape, another origin in fact.
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

/** Appends the callback URL to an auth route, so bouncing between /sign-in and
 *  /sign-up doesn't lose where the user was originally headed. */
export function withCallbackUrl(
  path: string,
  callbackUrl: string | undefined,
): string {
  return callbackUrl
    ? `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : path;
}
