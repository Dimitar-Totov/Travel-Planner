import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { connectDB } from "@/lib/mongodb";
import { credentialsSchema } from "@/lib/validation/auth";
import User from "@/models/User";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  issueRefreshToken,
  revokeFamilyByToken,
  rotateRefreshToken,
} from "@/services/refreshTokens";

/**
 * Path prefixes that require an authenticated session.
 *
 * Empty today on purpose: every current route (`/`, `/plan`, `/api/plan`,
 * `/api/ai/*`) is intentionally anonymous-friendly, and nothing should be
 * locked down as a side effect of adding auth.
 *
 * To protect a page later, add its path prefix here, e.g. `"/account"`. The
 * `authorized` callback below - wired into the request pipeline via
 * `src/proxy.ts` - will then redirect unauthenticated requests to
 * `pages.signIn`, with `?callbackUrl=` pointing back at the original page.
 *
 * This does **not** work for API routes: `proxy.ts`'s matcher excludes all of
 * `/api/*`, so `authorized` never runs for them and listing one here would
 * look protected while being wide open. Guard those inside the route handler
 * instead - `const session = await auth()`, then 401 when it's null.
 */
const PROTECTED_PATHS: readonly string[] = [];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// A precomputed bcrypt hash of a value nobody will ever type as a real
// password. Comparing against this (instead of short-circuiting) when no
// user is found keeps the authorize() timing indistinguishable between
// "unknown email" and "wrong password", so neither case is a distinguishable
// timing/behavioral oracle for account enumeration.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "no-such-user-placeholder-password",
  10,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    // The cookie's own lifetime. Kept equal to the refresh token's TTL so
    // the two expire together - a cookie that outlived its refresh token
    // would just be an unusable session, and vice versa.
    maxAge: REFRESH_TOKEN_TTL_MS / 1000, // 30 days
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        await connectDB();

        const user = await User.findOne({ email }).select("+password");

        const passwordMatches = await bcrypt.compare(
          password,
          user?.password ?? DUMMY_PASSWORD_HASH,
        );

        // Same generic failure whether the email doesn't exist or the
        // password is wrong - never leak which one it was.
        if (!user || !passwordMatches) {
          return null;
        }

        return {
          id: user.id as string,
          email: user.email,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Runs on every request that reads the session, and owns the whole
     * access/refresh lifecycle.
     *
     * The token itself is the access credential: it rides in the encrypted
     * HttpOnly session cookie and is trusted, with no database round trip,
     * until `accessTokenExpires` passes. After that the refresh token it
     * carries is exchanged for a successor (see
     * `src/services/refreshTokens.ts`), which both re-checks that the
     * session is still allowed to live and re-arms the access window.
     *
     * Returning `null` here invalidates the session and clears the cookie
     * (`@auth/core`'s session action). That is the intended outcome when a
     * refresh legitimately fails - unlike an OAuth provider there is no
     * silent re-auth available for credentials, so the user signs in again.
     */
    async jwt({ token, user }) {
      // `user` is only defined right after a successful `authorize()`
      // call (i.e. at sign-in). Open a new refresh-token family for the
      // session and persist what we need for every later request.
      if (user) {
        // `User.id` is optional in Auth.js's types, and passing
        // `undefined` to `new Types.ObjectId()` mints a brand-new id
        // rather than throwing - which would silently bind a refresh
        // token to a user that doesn't exist. `authorize()` always
        // sets it; refuse the session outright if that ever changes.
        if (!user.id) {
          return null;
        }

        const issued = await issueRefreshToken(user.id);

        token.id = user.id;
        token.username = user.username;
        token.refreshToken = issued.token;
        token.refreshTokenExpires = issued.expiresAt.getTime();
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS;

        return token;
      }

      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Sessions minted before refresh tokens existed have no token to
      // exchange. There is nothing to validate them against, so they end
      // here and the user signs in again once.
      if (!token.refreshToken) {
        return null;
      }

      try {
        const rotated = await rotateRefreshToken(token.refreshToken);

        if (!rotated) {
          return null;
        }

        token.refreshToken = rotated.token;
        token.refreshTokenExpires = rotated.expiresAt.getTime();
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS;

        return token;
      } catch (error) {
        // Infrastructure failure, not a rejected token. Hand back the
        // token with its access window still expired so the next
        // request retries - a database blip shouldn't sign out every
        // user at once.
        console.error("[auth] refresh token rotation failed", error);
        return token;
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    },
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      if (!isProtectedPath(pathname)) {
        return true;
      }

      return Boolean(auth?.user);
    },
  },
  events: {
    /**
     * Signing out has to reach the database, or the refresh token in the
     * discarded cookie would stay valid for its full 30 days. Revoking the
     * whole family also ends any session that rotated off the same
     * sign-in. This is the only hook with access to the decoded JWT during
     * sign-out.
     */
    async signOut(message) {
      const refreshToken =
        "token" in message ? message.token?.refreshToken : undefined;

      if (!refreshToken) {
        return;
      }

      try {
        await revokeFamilyByToken(refreshToken, "signout");
      } catch (error) {
        // The cookie is cleared regardless; log and move on rather
        // than failing the sign-out the user asked for.
        console.error(
          "[auth] failed to revoke refresh token on sign-out",
          error,
        );
      }
    },
  },
});
