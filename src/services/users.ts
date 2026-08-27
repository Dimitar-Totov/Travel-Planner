import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import type { UserRole } from "@/lib/roles";

/**
 * Server-side reads for `User` documents that don't already live somewhere
 * more specific (`authorize()`'s own lookup in `src/lib/auth.ts`,
 * `services/refreshTokens.ts`'s token-family reads). Currently just the one
 * function the `jwt` callback's rotation branch needs.
 */

/**
 * Re-reads a user's current role.
 *
 * The return contract mirrors `rotateRefreshToken`'s (`services/refreshTokens.ts`):
 *
 * - `null` means the user is genuinely gone - the account was deleted
 *   between sign-in and this rotation. The caller should end the session,
 *   the same way a rotated-away/replayed refresh token does.
 * - A *thrown* error means an infrastructure failure (the database is
 *   unreachable, a query timed out), not a fact about the user. The caller
 *   is expected to catch it and keep the session alive with whatever role
 *   it already has cached, rather than signing everyone out because Mongo
 *   hiccuped - see the `jwt` callback's rotation branch in `src/lib/auth.ts`
 *   for exactly that split.
 *
 * `userId` is expected to be `token.id`, which is only ever set from a real
 * `authorize()` result (see `src/lib/auth.ts`) - so a `CastError` from an
 * unparseable ObjectId string here would mean the token itself is corrupt,
 * not that the user is missing. That's a deeper problem than a stale
 * session, so it's deliberately left to throw and fall into the same
 * infrastructure-failure handling above (keep the session, log it, and let
 * whoever's watching the logs notice) rather than being coerced into the
 * `null` "sign this session out" path, which would suggest a routine
 * deletion instead of a bug worth investigating.
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  await connectDB();

  const user = await User.findById(userId).select("role");

  return user?.role ?? null;
}
