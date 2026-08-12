"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { fieldErrorsOf, signInSchema } from "@/lib/validation/auth";

export type SignInState = {
  error?: string;
  fields?: { email?: string; password?: string };
  /** Echoed back so a failed submit doesn't wipe what the user typed. */
  values?: { email?: string };
};

/** Where users land after signing in, unless a callbackUrl says otherwise. */
const DEFAULT_REDIRECT = "/";

/** Only same-origin relative paths are honoured, so `?callbackUrl=` can't be
 *  used as an open redirect to another site. */
function safeRedirect(target: string | undefined | null): string {
  if (!target) return DEFAULT_REDIRECT;
  if (!target.startsWith("/") || target.startsWith("//"))
    return DEFAULT_REDIRECT;
  return target;
}

/**
 * Credentials sign-in. Runs `signIn` with `redirect: false` so Auth.js sets the
 * session cookie but hands control back here — that keeps the failure path a
 * plain returned state instead of a thrown redirect we'd have to re-throw.
 */
export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const callbackUrl = safeRedirect(formData.get("callbackUrl")?.toString());

  const parsed = signInSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    return {
      fields: fieldErrorsOf(parsed.error),
      values: { email: String(formData.get("email") ?? "").trim() },
    };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    // CredentialsSignin is the "wrong email or password" case. It stays
    // deliberately vague: telling the user which half was wrong tells an
    // attacker which emails are registered.
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "That email and password don't match an account."
            : "We couldn't sign you in just now. Please try again.",
        values: { email },
      };
    }
    throw error;
  }

  redirect(callbackUrl);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
