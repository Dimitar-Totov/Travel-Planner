import { MongoServerError } from "mongodb";

import { connectDB } from "@/lib/mongodb";
import { fieldErrorsOf, registerSchema } from "@/lib/validation/auth";
import User from "@/models/User";

/**
 * POST /api/users — public registration endpoint.
 *
 * Body: `{ "username": string, "email": string, "password": string }`
 *
 * Responses:
 * - 201 `{ id, username, email, role, createdAt }` (password never returned)
 * - 400 `{ error, fields: { [field]: message } }` on invalid input
 * - 409 `{ error }` if the email or username is already taken
 * - 500 `{ error }` on unexpected failure
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      {
        error:
          'Request body must be a JSON object shaped like { "username": string, "email": string, "password": string }.',
      },
      { status: 400 },
    );
  }

  // Zod owns the rules; it also normalises (trims the username, trims and
  // lowercases the email) so what reaches Mongo is already canonical.
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsOf(result.error) },
      { status: 400 },
    );
  }

  const { username, email, password } = result.data;

  try {
    await connectDB();

    // Hashing happens in the model's pre("save") hook - pass the
    // plaintext through once, don't hash it here.
    //
    // `role` is deliberately absent from this call, not just from
    // `registerSchema`. It's server-owned end to end: `registerSchema` is a
    // plain `z.object` with no `role` key, so `result.data` would strip a
    // client-supplied `"role": "admin"` even if it slipped past this
    // destructure — but the destructure above is also explicit about only
    // pulling `username`/`email`/`password` off it, and this call only
    // forwards those three, so there are two independent reasons a body
    // can't hand itself a role. The schema `default` on `User.role`
    // (`models/User.ts`) is the single place that actually assigns one.
    // Both of those must stay true for this comment to keep being correct.
    const user = await User.create({ username, email, password });

    return Response.json(
      {
        id: user.id as string,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    // Rely on the unique index + this catch instead of a racy
    // find-then-create check.
    if (error instanceof MongoServerError && error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern ?? {})[0];
      return Response.json(
        {
          error:
            duplicateField === "username"
              ? "That username is already taken."
              : "An account with that email already exists.",
        },
        { status: 409 },
      );
    }

    console.error("[api/users] failed to create user", error);
    return Response.json(
      { error: "Unexpected error while creating the account." },
      { status: 500 },
    );
  }
}
