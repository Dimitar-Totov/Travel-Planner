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
 * - 201 `{ id, username, email, createdAt }` (password never returned)
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
    const user = await User.create({ username, email, password });

    return Response.json(
      {
        id: user.id as string,
        username: user.username,
        email: user.email,
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
