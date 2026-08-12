import { z } from "zod";

/**
 * The single source of truth for what counts as a valid credential.
 *
 * Every entry point parses through these schemas rather than hand-rolling its
 * own checks, so the rules can't drift apart between them:
 * - `POST /api/users` (registration)                — `registerSchema`
 * - `signInAction` in `src/app/(auth)/actions.ts`   — `signInSchema`
 * - `authorize()` in `src/lib/auth.ts`              — `credentialsSchema`
 * - `SignUpForm` / `SignInForm` (pre-flight, client) — the same two schemas
 *
 * This module is deliberately dependency-free apart from Zod: it is imported
 * by client components, so it must never pull in mongoose, bcrypt or anything
 * else that only resolves on the server.
 */

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt only reads the first 72 *bytes* of a password and silently ignores
 * the rest, which would make two different long passwords interchangeable at
 * sign-in. Reject anything longer instead of quietly truncating it.
 */
export const PASSWORD_MAX_BYTES = 72;

/** `TextEncoder` (not `Buffer`) so this works unchanged in the browser bundle. */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const usernameSchema = z
  .string({ error: "Username is required." })
  .trim()
  .min(USERNAME_MIN_LENGTH, {
    error: `Username must be at least ${USERNAME_MIN_LENGTH} characters long.`,
  })
  .max(USERNAME_MAX_LENGTH, {
    error: `Username must be at most ${USERNAME_MAX_LENGTH} characters long.`,
  });

/**
 * Trim and lowercase *before* the format check, so " Me@Example.COM " is
 * accepted and stored as "me@example.com". Emails are looked up by exact
 * match, so normalising here is what stops the same person registering twice.
 */
export const emailSchema = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Please provide a valid email address." }));

export const passwordSchema = z
  .string({ error: "Password is required." })
  .min(PASSWORD_MIN_LENGTH, {
    error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
  })
  .refine((value) => byteLength(value) <= PASSWORD_MAX_BYTES, {
    error: `Password must be at most ${PASSWORD_MAX_BYTES} characters long.`,
  });

/** `POST /api/users` request body. */
export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Sign-in input. Deliberately *not* `passwordSchema`: the strength rules are a
 * registration-time policy, and re-applying them here would (a) lock out any
 * account whose password predates a rule change and (b) turn "your password is
 * too short" into a hint that the rest of the guess was on the right track.
 * A sign-in either matches or it doesn't.
 */
export const signInSchema = z.object({
  email: z
    .string({ error: "Enter your email address." })
    .trim()
    .toLowerCase()
    .min(1, { error: "Enter your email address." }),
  password: z
    .string({ error: "Enter your password." })
    .min(1, { error: "Enter your password." }),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * What `authorize()` receives from Auth.js. Same shape as `signInSchema`, but
 * over `Partial<Record<string, unknown>>` credentials rather than form values,
 * so it has to tolerate genuinely arbitrary input.
 */
export const credentialsSchema = signInSchema;

/**
 * Collapses a `ZodError` into the flat `{ field: message }` map the API routes
 * and forms render. Only the first issue per field survives — showing a user
 * three complaints about one input at once is noise, and the second one
 * usually disappears the moment they fix the first.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    // Issues with an empty path are about the object as a whole, not any
    // one input, and there is nowhere in the form to render them.
    if (typeof field !== "string" || field in result) {
      continue;
    }

    result[field] = issue.message;
  }

  return result;
}
