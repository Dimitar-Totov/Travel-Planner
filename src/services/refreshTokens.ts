import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Types } from "mongoose";

import { connectDB } from "@/lib/mongodb";
import RefreshToken, {
  type IRefreshToken,
  type RevokedReason,
} from "@/models/RefreshToken";

/**
 * Server-side half of the refresh-token scheme.
 *
 * The session cookie Auth.js writes is an encrypted JWE - HttpOnly, SameSite
 * lax, Secure in production - and it carries a short-lived access window plus
 * one opaque refresh token. Only the refresh token's SHA-256 hash lives here;
 * the browser holds the only copy of the token itself, inside a cookie its own
 * JavaScript cannot read.
 *
 * Rotation is single-use: exchanging a token mints a successor and marks the
 * parent spent. Presenting a spent or revoked token after the grace window
 * below is treated as a replay and revokes the entire family, which is the
 * response RFC 9700 (OAuth 2.0 Security BCP, §4.14.2) prescribes - a thief and
 * the real user cannot both keep rotating, and whichever one refreshes second
 * ends the session for both.
 */

/**
 * How long the JWT is trusted without consulting the database. Sessions cost
 * zero queries inside this window; a rotation is one indexed lookup and two
 * writes, so this is the main lever on auth's database load.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Lifetime of each issued refresh token. Rotation mints a full-length
 * successor, making the session sliding: 30 days of inactivity ends it, but
 * regular use extends it indefinitely. Matches the cookie's `maxAge` in
 * `src/lib/auth.ts` - the two should be changed together.
 */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * How long a just-rotated parent keeps handing out its successor instead of
 * being treated as a replay.
 *
 * This is not a nicety, it is what makes rotation survive normal traffic.
 * Three things routinely present the same parent cookie more than once:
 *
 *  1. `auth()` inside a React Server Component. next-auth's RSC branch throws
 *     away the `Set-Cookie` headers it gets back (it cannot set cookies during
 *     render), so a rotation that happens there never reaches the browser.
 *     Proxy runs first and does persist the new cookie, but the RSC call that
 *     follows still carries the old one.
 *  2. `<Link>` prefetching and parallel tabs, which fire concurrent requests
 *     that all still hold the pre-rotation cookie.
 *  3. Ordinary retries on a dropped response.
 *
 * Without the window every one of those looks like a stolen token and would
 * sign the user out. With it they converge on the same successor. Keep it long
 * enough to cover a page load, short enough that a captured cookie is only
 * briefly reusable.
 */
export const ROTATION_GRACE_MS = 2 * 60 * 1000; // 2 minutes

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** 256 bits of CSPRNG output, URL-safe so it survives a round trip in a cookie. */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mints the first refresh token of a new family. Called once per successful
 * sign-in; every later token for that session descends from this one.
 */
export async function issueRefreshToken(
  userId: string,
): Promise<IssuedRefreshToken> {
  await connectDB();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({
    tokenHash: hashToken(token),
    user: new Types.ObjectId(userId),
    family: randomUUID(),
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Exchanges `presented` for its successor.
 *
 * Returns `null` when the session should end - unknown, expired, revoked, or
 * replayed token. Throws only on infrastructure failure, which the caller is
 * expected to treat as "try again next request" rather than "sign out", so a
 * blip in the database doesn't log everybody out.
 */
export async function rotateRefreshToken(
  presented: string,
): Promise<IssuedRefreshToken | null> {
  await connectDB();

  const tokenHash = hashToken(presented);
  const now = new Date();

  const parent = await RefreshToken.findOne({ tokenHash });

  if (!parent) {
    return null;
  }

  // A spent token is *not* marked revoked - `rotatedAt` alone records that.
  // Keeping the two distinct is what lets the replay check below run before
  // the grace check without swallowing it: `revokedAt` here can only mean a
  // deliberate sign-out or a family we already shut down.
  if (parent.revokedAt) {
    await revokeFamily(parent.family, "reuse");
    return null;
  }

  // Already exchanged. This is the common path for the concurrent readers
  // described above, so it must not write anything.
  //
  // Checked *before* plain expiry on purpose. A document's `expiresAt` is
  // fixed when it is minted and never advanced, so a token spent minutes
  // after sign-in still carries its original 30-day deadline while the
  // family it belongs to slides on indefinitely. Testing expiry first would
  // let a replay of that long-spent token fall out through the branch below
  // as an ordinary expired token, losing the one signal - "this was already
  // exchanged, and someone is presenting it again" - that replay detection
  // exists to catch.
  if (parent.rotatedAt) {
    return resolveRotated(parent, now);
  }

  if (parent.expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  // Mint the successor before claiming the parent. The other order leaves a
  // window where the parent points at a token that was never written, which
  // the next request would read as a replay.
  const successorToken = generateToken();
  const successorExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({
    tokenHash: hashToken(successorToken),
    user: parent.user,
    family: parent.family,
    expiresAt: successorExpiresAt,
  });

  // Claim the rotation atomically. `rotatedAt: null` also matches documents
  // where the field is absent. If another request beat us to it the filter
  // misses and we fall through, rather than minting a second successor.
  const claimed = await RefreshToken.findOneAndUpdate(
    {
      tokenHash,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { rotatedAt: now, successorToken, successorExpiresAt } },
    { new: true },
  );

  if (claimed) {
    return { token: successorToken, expiresAt: successorExpiresAt };
  }

  // Lost the race. Drop the successor we speculatively created so it can
  // never be exchanged, then defer to whichever token did win.
  await RefreshToken.deleteOne({ tokenHash: hashToken(successorToken) });

  const current = await RefreshToken.findOne({ tokenHash });

  if (!current) {
    return null;
  }

  return resolveRotated(current, now);
}

/**
 * Decides what an already-rotated token is worth: inside the grace window it
 * still yields the successor a concurrent request minted, outside it the token
 * is a replay and takes the whole family down with it.
 */
async function resolveRotated(
  record: IRefreshToken,
  now: Date,
): Promise<IssuedRefreshToken | null> {
  if (!record.rotatedAt) {
    // Revoked or expired between reads - no successor to hand back.
    return null;
  }

  // The family died between the caller's read and this one - a sign-out
  // racing an in-flight grace-window request is the realistic case. Stop
  // here rather than fall through: the successor has already been revoked
  // (and its plaintext wiped), and re-revoking would relabel a deliberate
  // sign-out as a replay in the audit trail.
  if (record.revokedAt) {
    return null;
  }

  const withinGrace =
    now.getTime() - record.rotatedAt.getTime() <= ROTATION_GRACE_MS;

  if (withinGrace && record.successorToken && record.successorExpiresAt) {
    return {
      token: record.successorToken,
      expiresAt: record.successorExpiresAt,
    };
  }

  await revokeFamily(record.family, "reuse");
  return null;
}

/**
 * Revokes every still-live token in a rotation chain and wipes the cached
 * successors, so nothing in the family can be exchanged again.
 *
 * The `revokedAt: null` filter makes this idempotent: a second call can't
 * relabel why the family died. Without it a replay arriving just after a
 * sign-out would rewrite every `revokedReason` from `"signout"` to `"reuse"`,
 * which is precisely backwards for anyone reading these rows to work out
 * whether an account was actually attacked.
 */
export async function revokeFamily(
  family: string,
  reason: RevokedReason,
): Promise<void> {
  await connectDB();

  await RefreshToken.updateMany(
    { family, revokedAt: null },
    {
      $set: { revokedAt: new Date(), revokedReason: reason },
      $unset: { successorToken: "", successorExpiresAt: "" },
    },
  );
}

/**
 * Sign-out path: ends the session the given token belongs to. A token we don't
 * recognise is a no-op - the session is over either way, and there is nothing
 * useful to tell the caller.
 */
export async function revokeFamilyByToken(
  presented: string,
  reason: RevokedReason = "signout",
): Promise<void> {
  await connectDB();

  const record = await RefreshToken.findOne({
    tokenHash: hashToken(presented),
  }).select("family");

  if (record) {
    await revokeFamily(record.family, reason);
  }
}
