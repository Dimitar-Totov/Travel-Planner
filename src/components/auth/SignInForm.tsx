"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/(auth)/actions";
import ComingSoon from "./ComingSoon";
import Field, { PasswordField } from "./Field";
import FormError from "./FormError";
import SubmitButton from "./SubmitButton";

const INITIAL_STATE: SignInState = {};

/**
 * Credentials sign-in. `signInAction` redirects on success, so anything that
 * comes back is a failure: `state.error` is the form-level message and
 * `state.fields` the per-input ones. React resets an uncontrolled form after
 * its action settles, which is why the action echoes the email back — the
 * `defaultValue` below is what survives that reset.
 */
export default function SignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useActionState(signInAction, INITIAL_STATE);

  return (
    // `noValidate` hands validation entirely to the action: native constraint
    // bubbles would fire first and say something different, in a style we
    // don't control, for errors the server checks anyway.
    <form action={formAction} noValidate className="mt-5 flex flex-col gap-4">
      {callbackUrl && (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      )}

      <FormError>{state.error}</FormError>

      <Field
        id="signin-email"
        name="email"
        type="email"
        label="Email"
        placeholder="john.doe@gmail.com"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fields?.email}
      />

      <PasswordField
        id="signin-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        error={state.fields?.password}
        labelAside={<ComingSoon>Forgot?</ComingSoon>}
      />

      {/* Presentational for now: session lifetime is a fixed 30-day `maxAge` in
          lib/auth.ts and `signInAction` doesn't read this field. Kept because
          it's in the signed-off design, and because honouring it later is a
          server-side change, not a form one. */}
      <label className="flex items-center gap-2.5 text-[13.5px] text-ink">
        <input
          type="checkbox"
          name="keepSignedIn"
          defaultChecked
          className="h-4 w-4 accent-brand-500"
        />
        Keep me signed in
      </label>

      <SubmitButton label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
