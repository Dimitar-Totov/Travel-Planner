"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import { signInAction, type SignInState } from "@/app/(auth)/actions";
import {
  PASSWORD_MIN_LENGTH,
  fieldErrorsOf,
  registerSchema,
} from "@/lib/validation/auth";
import Field, { PasswordField } from "./Field";
import FormError from "./FormError";
import SubmitButton from "./SubmitButton";

type SignUpErrors = {
  error?: string;
  fields?: { username?: string; email?: string; password?: string };
};

const INITIAL_SIGN_IN_STATE: SignInState = {};

/** Read off the schema rather than restated, so the hint can't drift from the
 *  rule the same schema enforces on the server. */
const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters.`;

const FIELD_KEYS = ["username", "email", "password"] as const;

/** Pulls whatever `POST /api/users` sent back into the shape this form renders.
 *  The body is untrusted at the type level, so every branch is checked. */
function readErrorBody(body: unknown): SignUpErrors {
  if (typeof body !== "object" || body === null) return {};

  const { error, fields } = body as { error?: unknown; fields?: unknown };
  const result: SignUpErrors = {};

  if (typeof fields === "object" && fields !== null) {
    const map = fields as Record<string, unknown>;
    const parsed: NonNullable<SignUpErrors["fields"]> = {};
    for (const key of FIELD_KEYS) {
      const message = map[key];
      if (typeof message === "string") parsed[key] = message;
    }
    if (Object.keys(parsed).length > 0) result.fields = parsed;
  }

  // A 400 pairs its per-field map with a generic "Validation failed." — showing
  // both just says the same thing twice, less usefully.
  if (!result.fields && typeof error === "string") result.error = error;

  return result;
}

/**
 * Registration. The only form in the app that calls HTTP directly: it posts to
 * `POST /api/users`, then hands the same credentials to the `signInAction`
 * server action so a new account lands signed in rather than back on /sign-in.
 *
 * That second leg goes through `useActionState`'s dispatch instead of calling
 * the action inline — dispatch is what lets React and the router handle the
 * action's `redirect()` for us.
 */
export default function SignUpForm({ callbackUrl }: { callbackUrl?: string }) {
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [registering, setRegistering] = useState(false);
  const [signInState, signIn, signingIn] = useActionState(
    signInAction,
    INITIAL_SIGN_IN_STATE,
  );

  const pending = registering || signingIn;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    // The same schema the API parses with, run here first purely to save a
    // round trip. `POST /api/users` re-validates regardless — this is a
    // convenience, never the enforcement point.
    const parsed = registerSchema.safeParse({
      username: formData.get("username") ?? "",
      email: formData.get("email") ?? "",
      password: formData.get("password") ?? "",
    });

    if (!parsed.success) {
      setErrors({ fields: fieldErrorsOf(parsed.error) });
      return;
    }

    const payload = parsed.data;

    setRegistering(true);
    setErrors({});

    let response: Response;
    try {
      response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setRegistering(false);
      setErrors({
        error:
          "We couldn't reach the server. Check your connection and try again.",
      });
      return;
    }

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const parsed = readErrorBody(body);
      setRegistering(false);
      setErrors(
        parsed.error || parsed.fields
          ? parsed
          : { error: "We couldn't create your account. Please try again." },
      );
      return;
    }

    // Account created. Sign in with the credentials we just registered; the
    // action redirects on success, so `registering` deliberately stays true —
    // this component is on its way off the screen either way.
    const credentials = new FormData();
    credentials.set("email", payload.email);
    credentials.set("password", payload.password);
    if (callbackUrl) credentials.set("callbackUrl", callbackUrl);

    startTransition(() => signIn(credentials));
    setRegistering(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-5 flex flex-col gap-4"
    >
      <FormError>{errors.error ?? signInState.error}</FormError>

      <Field
        id="signup-username"
        name="username"
        type="text"
        label="Username"
        placeholder="John"
        autoComplete="username"
        required
        error={errors.fields?.username}
      />

      <Field
        id="signup-email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        error={errors.fields?.email}
      />

      <PasswordField
        id="signup-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        required
        hint={PASSWORD_HINT}
        error={errors.fields?.password}
      />

      <SubmitButton
        label="Create account"
        pendingLabel="Creating account…"
        pending={pending}
      />
    </form>
  );
}
