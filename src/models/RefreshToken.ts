import {
  Schema,
  model,
  models,
  Types,
  type Document,
  type Model,
} from "mongoose";

/** Why a token stopped being usable. Recorded for auditing, never shown to users. */
export type RevokedReason = "signout" | "reuse" | "superseded";

export interface IRefreshToken extends Document {
  /**
   * SHA-256 (hex) of the opaque refresh token. The token itself is never
   * stored, so a leaked dump of this collection can't be replayed.
   *
   * SHA-256 rather than bcrypt on purpose - the opposite of the choice made
   * for passwords. Refresh tokens are 256 bits of CSPRNG output, so there is
   * no dictionary to attack and no need for a slow KDF; what we do need is a
   * deterministic value we can put a unique index on and look up in one
   * query, which a salted bcrypt hash cannot give us.
   */
  tokenHash: string;
  user: Types.ObjectId;
  /**
   * Shared by every token in one rotation chain, back to the original
   * sign-in. Lets a detected replay revoke the whole lineage in one write.
   */
  family: string;
  expiresAt: Date;
  /** Set the moment this token is exchanged for its successor. */
  rotatedAt?: Date | null;
  /**
   * The successor's *plaintext* token, kept only for the brief grace window
   * after rotation (see `ROTATION_GRACE_MS` in
   * `src/services/refreshTokens.ts`) so that concurrent requests holding the
   * same parent cookie all converge on the same successor instead of
   * tripping replay detection. Cleared as soon as the window closes.
   */
  successorToken?: string | null;
  successorExpiresAt?: Date | null;
  revokedAt?: Date | null;
  revokedReason?: RevokedReason | null;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    rotatedAt: { type: Date, default: null },
    successorToken: { type: String, default: null },
    successorExpiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true },
);

// Mongo reaps each document once `expiresAt` passes, so expired chains clean
// themselves up. The window is deliberately the token's full lifetime rather
// than something shorter: a revoked-but-unexpired row is what lets replay of a
// stolen token still be *recognised* as replay instead of read as an unknown
// token.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken: Model<IRefreshToken> =
  models.RefreshToken ||
  model<IRefreshToken>("RefreshToken", refreshTokenSchema);

export default RefreshToken;
