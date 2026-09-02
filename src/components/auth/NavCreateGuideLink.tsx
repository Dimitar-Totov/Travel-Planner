import Link from "next/link";
import { auth } from "@/lib/auth";
import { canCreateGuides } from "@/lib/roles";

/**
 * The authoring entry point in SiteNav's link row, split out of the static
 * LINKS array for the same reason NavAccount exists: it needs the session, and
 * SiteNav must not become async over it. Wrapped in its own <Suspense> so the
 * four marketing links (and `plan/loading.tsx`, which renders SiteNav while the
 * model call is still in flight) paint without waiting on the session cookie.
 *
 * Rendering nothing — rather than a disabled or "upgrade" affordance — is
 * deliberate: a reader with the default `"user"` role has no path to authoring
 * yet, so advertising the route would only be a dead end. This is presentation,
 * not the permission boundary; `/create-guide` and `POST /api/guides` do their
 * own checks off the same `canCreateGuides` predicate, and `session.user.role`
 * is a ≤15-minute-stale snapshot (see CLAUDE.md's "Roles") which is fine to
 * render a link off but never to authorize a write with.
 */
export default async function NavCreateGuideLink({
  className,
}: {
  className: string;
}) {
  const session = await auth();
  const role = session?.user?.role;

  if (!role || !canCreateGuides(role)) return null;

  return (
    <Link href="/create-guide" className={className}>
      Create Guide
    </Link>
  );
}
