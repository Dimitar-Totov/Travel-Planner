import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withCallbackUrl } from "@/lib/callbackUrl";
import { getGuideForAuthor } from "@/services/guides";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import CreateGuidePageShell from "@/components/create-guide/CreateGuidePageShell";

/**
 * `PageProps<"/guides/guide/[guideId]/edit">` is a *generated* global
 * (`types/routes.d.ts`, rewritten by `next dev`/`next build`) and doesn't exist
 * for this segment until the next generation pass, so the shape Next documents
 * for a dynamic segment is written out inline here instead.
 */
interface EditGuideProps {
  params: Promise<{ guideId: string }>;
}

/**
 * Static, and deliberately not a `generateMetadata` that names the guide.
 *
 * Only one person can ever load this page, and the title would have to come
 * from a second authorized round trip that duplicates the page's own — for a
 * string that would also put an unpublished draft's headline into the browser
 * history and the window title of a page nobody else can see.
 */
export const metadata: Metadata = {
  title: "Edit guide · Travel Planner",
  description:
    "Edit one of your published guides — days, stops, notes and map pins — and preview it exactly as a reader would see it.",
  // Nothing here is reachable without a session, so there is nothing worth
  // crawling; saying so keeps it out of an index that would only ever serve
  // sign-in redirects.
  robots: { index: false, follow: false },
};

/**
 * The authoring editor, reopened over a guide that already exists.
 *
 * The same shell `/create-guide` renders, handed the saved guide as its initial
 * draft — so there is one editor, one preview and one save pipeline, not a
 * parallel "edit" copy of any of them. `nav`/`footer` are passed as slots for
 * exactly the reason `/create-guide` passes them: it keeps `SiteNav` (which
 * reads the session) and `SiteFooter` server components even though the shell
 * itself is the `"use client"` boundary.
 *
 * Authorization is the `getGuideForAuthor` call and nothing else. It filters on
 * the author id inside the query, so "no such guide" and "someone else's guide"
 * come back identically as `null` and both end here as a 404 — a non-author
 * can't even learn that a slug exists. `src/proxy.ts` doesn't protect this path
 * and `PROTECTED_PATHS` is empty, so this page's own two checks are the whole
 * gate; the mutating endpoints behind it re-check independently.
 */
export default async function EditGuidePage(props: EditGuideProps) {
  const { guideId } = await props.params;
  const session = await auth();

  if (!session?.user?.id) {
    // Built with the same helper the auth pages use, so the value that comes
    // back through `?callbackUrl=` is one `sameOriginPath`/`safeRedirect`
    // already accept: a relative path, encoded once, never an absolute URL.
    redirect(
      withCallbackUrl(
        "/sign-in",
        `/guides/guide/${encodeURIComponent(guideId)}/edit`,
      ),
    );
  }

  // Any status, not just published: an author edits their drafts too, and a
  // draft that couldn't be reloaded would be unfinishable.
  const guide = await getGuideForAuthor(guideId, session.user.id);

  if (!guide) {
    notFound();
  }

  return (
    <CreateGuidePageShell
      initialGuide={guide}
      nav={<SiteNav variant="onLight" />}
      footer={<SiteFooter />}
    />
  );
}
