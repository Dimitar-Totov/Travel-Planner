import { z } from "zod";

/**
 * Validation for `POST /api/guides/[guideId]/comments`.
 *
 * Follows `lib/validation/auth.ts`'s convention: dependency-free apart from
 * Zod, so this stays safe to import from a client component even though
 * nothing does yet.
 */

export const createCommentSchema = z.object({
  comment: z
    .string({ error: "Comment is required." })
    .trim()
    .min(1, { error: "Comment can't be empty." })
    // 2000 matches `src/models/Comment.ts`'s `maxlength: 2000` — keep the two
    // in sync, the same relationship `lib/validation/guide.ts`'s bounds have
    // to `Guide.ts`'s.
    .max(2000, {
      error: "Comment must be at most 2000 characters long.",
    }),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
