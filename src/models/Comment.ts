import {
  Schema,
  model,
  models,
  Types,
  type Document,
  type Model,
} from "mongoose";

/**
 * The `comments` collection — one document per comment, referencing the
 * guide it was left on and the user who left it. Unlike `Like` (one document
 * per guide), a guide's comments are naturally many separate rows: they're
 * ordered by time, attributed individually, and have no "total count on one
 * document" shortcut worth taking — `Guide.ts` has no `commentCount` field to
 * keep in sync for the same reason it has no per-comment data embedded.
 */
export interface IComment extends Document {
  guide: Types.ObjectId;
  user: Types.ObjectId;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    // No `index: true` here — the compound `{ guide: 1, createdAt: -1 }`
    // index below already covers any query filtered on `guide` alone (it's
    // the index's leading key), so a standalone index on this field would
    // just be duplicate write/storage overhead.
    guide: {
      type: Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

// A guide's comment thread is read newest-first, filtered by guide — this is
// the index that query uses.
commentSchema.index({ guide: 1, createdAt: -1 });

const Comment: Model<IComment> =
  models.Comment || model<IComment>("Comment", commentSchema);

export default Comment;
