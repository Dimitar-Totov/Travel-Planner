import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import CreateGuidePageShell from "@/components/create-guide/CreateGuidePageShell";

export const metadata: Metadata = {
  title: "Create Guide · Travel Planner",
  description:
    "Write a day-by-day travel guide — days, stops, notes and map pins — and preview it exactly as a reader would see it.",
};

/**
 * The authoring counterpart to `/destinations/guide/[guideId]/details`.
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
 * **Not gated.** `/create-guide` is deliberately reachable by anyone for now;
 * there are no roles in the auth layer yet and Publish is inert, so there is
 * nothing to protect. See the TODO in `README.md`.
 */
export default function CreateGuidePage() {
  return (
    <CreateGuidePageShell
      nav={<SiteNav variant="onLight" />}
      footer={<SiteFooter />}
    />
  );
}
