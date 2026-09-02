import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withCallbackUrl } from "@/lib/callbackUrl";
import { canCreateGuides } from "@/lib/roles";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import CreateGuidePageShell from "@/components/create-guide/CreateGuidePageShell";

export const metadata: Metadata = {
  title: "Create Guide · Travel Planner",
  description:
    "Write a day-by-day travel guide — days, stops, notes and map pins — and preview it exactly as a reader would see it.",
};

/**
 * The authoring counterpart to `/guides/guide/[guideId]/details`.
 *
 * A server component with nothing to fetch: the whole draft lives in the
 * browser, so this file only supplies static metadata and hands the nav and the
 * footer down as slots, keeping both of them server components (`SiteNav` reads
 * the session) exactly as the guide detail route does.
 *
 * The `lg:h-screen lg:overflow-hidden` wrapper that route applies here belongs
 * to the shell instead — it must come and go with the Preview mode, and the
 * mode is client state.
 *
 * **Gated on sign-in plus role.** This route has no `PROTECTED_PATHS` entry
 * (that mechanism only knows "authenticated or not", not roles — see
 * `lib/auth.ts`), so the two checks live here instead: no session redirects
 * to `/sign-in` with a callback back to this page, exactly like
 * `/guides/guide/[guideId]/edit` does; a session whose `role` isn't
 * `"guide"`/`"admin"` (`canCreateGuides`, `lib/roles.ts`) redirects to
 * `/guides` rather than 404ing — unlike an author's draft slug, there's no
 * "existence" of `/create-guide` worth hiding from a signed-in `"user"`, so a
 * plain redirect is enough. This is only a UX nicety, though: the actual
 * boundary is `POST /api/guides`' own 403, since nothing stops a direct
 * request to that endpoint from bypassing a page-level check entirely.
 */
export default async function CreateGuidePage() {
  const session = await auth();

  if (!session?.user) {
    redirect(withCallbackUrl("/sign-in", "/create-guide"));
  }

  if (!canCreateGuides(session.user.role)) {
    redirect("/guides");
  }

  return (
    <CreateGuidePageShell
      nav={<SiteNav variant="onLight" />}
      footer={<SiteFooter />}
    />
  );
}
