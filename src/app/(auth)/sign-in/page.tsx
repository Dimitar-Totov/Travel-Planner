import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import ComingSoon from "@/components/auth/ComingSoon";
import OAuthButtons from "@/components/auth/OAuthButtons";
import SignInForm from "@/components/auth/SignInForm";
import { sameOriginPath, withCallbackUrl } from "@/lib/callbackUrl";

export const metadata: Metadata = {
  title: "Sign in · Travel Planner",
  description: "Sign in to pick up the trips you've already started planning.",
};

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const { callbackUrl } = await props.searchParams;
  const target = sameOriginPath(callbackUrl);
  const signUpHref = withCallbackUrl("/sign-up", target);

  return (
    <AuthShell>
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-2">
        Welcome back
      </p>

      <h1 className="mt-2.5 text-[26px] font-extrabold leading-[1.1] tracking-[-.03em] text-ink sm:text-[27px]">
        Pick up where you{" "}
        <span className="font-serif font-medium italic">left off.</span>
      </h1>

      <p className="mt-2.5 text-[14px] leading-[1.55] text-muted">
        New here?{" "}
        <Link
          href={signUpHref}
          className="font-semibold text-brand-600 underline-offset-4 hover:underline"
        >
          Create an account
        </Link>{" "}
        — it takes a minute.
      </p>

      <OAuthButtons />

      <SignInForm callbackUrl={target} />

      <p className="mt-5 text-[12px] leading-[1.5] text-muted">
        By signing in you agree to our <ComingSoon>Terms</ComingSoon> and{" "}
        <ComingSoon>Privacy Policy</ComingSoon>.
      </p>
    </AuthShell>
  );
}
