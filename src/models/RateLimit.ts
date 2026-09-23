import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * The `ratelimits` collection — a fixed-window request counter, one document
 * per (bucket, window). `src/services/rateLimit.ts` is the only module that
 * reads or writes it; nothing else should import this model directly.
 *
 * Fixed window, not sliding. A sliding window needs either one document per
 * hit or a growing timestamp array on a single document — exactly the shape
 * an attacker would grow without bound. A fixed window costs one small
 * document per (key, window) no matter how much traffic hits it. The known
 * trade-off is that up to roughly 2x the configured limit can pass across a
 * window boundary (a burst just before `windowStart` and another just after
 * it), which is accepted here because every policy in
 * `src/services/rateLimit.ts` is set at 2-4x a plausible human ceiling — the
 * boundary artifact still leaves genuine abuse far short of unlimited.
 *
 * No `ref`s anywhere. `key` is an opaque string built by whichever caller
 * needs a bucket (`likeGlobalKey`, `commentBurstKey`, …), not a foreign key —
 * that's what lets one collection serve any future rate-limited endpoint
 * with no schema change, and it's why deleting a `User`/`Guide` needs no
 * cleanup pass here the way `RefreshToken`/`Like` would require.
 */
export interface IRateLimit extends Document {
  key: string;
  /**
   * The start of this document's fixed window, computed on the app server as
   * `new Date(Math.floor(Date.now() / windowMs) * windowMs)`. Part of this
   * document's identity (see the unique index below), never advanced in
   * place — a new window is a new document, not an update of an old one.
   *
   * Computed from the app server's clock rather than via Mongo's
   * `$currentDate`: the whole check needs to know which window a request
   * falls in *before* it can build the `findOneAndUpdate` filter, so the
   * clock read has to happen application-side regardless. Using
   * `$currentDate` for `expiresAt` instead would need a second round trip to
   * learn what value it picked; computing both from one `Date.now()` call
   * keeps the whole operation to a single round trip.
   */
  windowStart: Date;
  count: number;
  /**
   * `windowStart + windowMs`, written once via `$setOnInsert`. There is
   * deliberately no slack added on top of the window's real end — nothing
   * here depends on the document surviving past its window closing.
   * Mongo's TTL reaper runs on its own ~60s cadence, so a closed window's
   * document can briefly outlive `expiresAt`; that lag is invisible to every
   * caller (a new window is a new document either way) and must not be
   * "fixed" by padding this field, which would only mask a correctness bug
   * if one ever depended on prompt deletion.
   */
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

// The bucket's identity, and the only index the read/write path needs — one
// `findOneAndUpdate({ key, windowStart }, …, { upsert: true })` per check.
rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

// Mongo reaps a closed window's document on its own; correctness never
// depends on it still being there (see `expiresAt` above).
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> =
  models.RateLimit || model<IRateLimit>("RateLimit", rateLimitSchema);

export default RateLimit;
