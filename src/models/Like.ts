import {
  Schema,
  model,
  models,
  Types,
  type Document,
  type Model,
} from "mongoose";

/**
 * The `likes` collection — one document per guide, not one per like. A guide
 * that has never been liked simply has no document here; the first like
 * upserts one. `users.length` is the guide's like count, and membership in
 * `users` is what a "did I already like this" check tests, so there's no
 * separate counter to keep in sync with the array (the way `Guide.likes`
 * does, kept as a denormalized copy for the "Loved" tab's sort — see the
 * note on `Guide.likes` below).
 *
 * One document per guide rather than one per (guide, user) pair: a guide's
 * like count/list is always read as a whole (render the count, or check
 * membership for the current viewer), never paginated or queried per-user
 * across guides, and cardinality is small enough that a raw `ObjectId[]`
 * comfortably stays well under Mongo's 16MB document cap for any real
 * guide's audience.
 *
 * `Guide.likes` (`src/models/Guide.ts`) still exists and is what
 * `useDestinationsExplorer`'s "Loved" tab and `guideSchema`'s `{ status: 1,
 * likes: -1 }` index actually sort on — this collection doesn't replace it.
 * Keeping the two in sync (incrementing `Guide.likes` whenever a user is
 * added to `users` here, in the same transaction/update) is the write-path
 * layer's job once one exists; nothing here does that automatically.
 */
export interface ILike extends Document {
  guide: Types.ObjectId;
  users: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    // Unique: exactly one like document per guide. A second write for the
    // same guide should find-and-update this document, never insert another.
    guide: {
      type: Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
      unique: true,
    },
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true },
);

// `guide`'s index comes from `unique: true` above.

const Like: Model<ILike> = models.Like || model<ILike>("Like", likeSchema);

export default Like;
