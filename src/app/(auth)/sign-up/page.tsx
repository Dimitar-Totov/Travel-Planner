import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import ComingSoon from "@/components/auth/ComingSoon";
import OAuthButtons from "@/components/auth/OAuthButtons";
import SignUpForm from "@/components/auth/SignUpForm";
import { sameOriginPath, withCallbackUrl } from "@/lib/callbackUrl";

export const metadata: Metadata = {
  title: "Create an account · Travel Planner",
  description: "Create a Travel Planner account to save the trips you plan.",
};

export default async function SignUpPage(props: PageProps<"/sign-up">) {
  const { callbackUrl } = await props.searchParams;
  const target = sameOriginPath(callbackUrl);
  const signInHref = withCallbackUrl("/sign-in", target);

  return (
    <AuthShell>
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-2">
        First trip
      </p>

      <h1 className="mt-2.5 text-[26px] font-extrabold leading-[1.1] tracking-[-.03em] text-ink sm:text-[27px]">
        Start planning in{" "}
        <span className="font-serif font-medium italic">one sentence.</span>
      </h1>

      <p className="mt-2.5 text-[14px] leading-[1.55] text-muted">
        Already have one?{" "}
        <Link
          href={signInHref}
          className="font-semibold text-brand-600 underline-offset-4 hover:underline"
        >
          Sign in instead
        </Link>{" "}
        — it takes a second.
      </p>

      <OAuthButtons />

      <SignUpForm callbackUrl={target} />

      <p className="mt-5 text-[12px] leading-[1.5] text-muted">
        By creating an account you agree to our <ComingSoon>Terms</ComingSoon>{" "}
        and <ComingSoon>Privacy Policy</ComingSoon>.
      </p>
    </AuthShell>
  );
}
