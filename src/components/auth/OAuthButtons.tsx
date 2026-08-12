/**
 * The "Continue with…" row plus the divider that hands off to the email form.
 *
 * Both buttons are inert. `lib/auth.ts` registers exactly one provider —
 * Credentials — so there is no Google or Apple flow to start; wiring these up
 * means adding the providers (and their client ids/secrets) server-side first.
 * They're rendered rather than dropped because the design signs off on them as
 * the primary path once that lands.
 */

const BUTTON_CLASS =
  "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-line bg-white text-[14.5px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70";

export default function OAuthButtons({
  dividerLabel = "Or with email",
}: {
  dividerLabel?: string;
}) {
  return (
    <>
      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          disabled
          title="Google sign-in is coming soon"
          className={BUTTON_CLASS}
        >
          <GoogleMark />
          Continue with Google
          <span className="sr-only"> (coming soon)</span>
        </button>
        <button
          type="button"
          disabled
          title="Apple sign-in is coming soon"
          className={BUTTON_CLASS}
        >
          <AppleMark />
          Continue with Apple
          <span className="sr-only"> (coming soon)</span>
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-2">
          {dividerLabel}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#ea4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285f4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#fbbc05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34a853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.37 1.43c0 1.14-.42 2.2-1.25 3.02-.99.99-2.1 1.56-3.29 1.47-.03-1.13.44-2.24 1.22-3.04.86-.9 2.24-1.55 3.32-1.45zM20.5 17.1c-.55 1.27-.82 1.84-1.53 2.96-1 1.56-2.39 3.5-4.11 3.51-1.53.02-1.92-.99-4-.98-2.08.01-2.51 1-4.04.98-1.72-.01-3.04-1.76-4.03-3.32C-.02 16.09-.31 10.9 1.4 8.15c1.21-1.95 3.12-3.09 4.92-3.09 1.83 0 2.98 1 4.5 1 1.47 0 2.36-1 4.48-1 1.6 0 3.3.87 4.51 2.38-3.96 2.17-3.32 7.83.69 9.66z" />
    </svg>
  );
}
