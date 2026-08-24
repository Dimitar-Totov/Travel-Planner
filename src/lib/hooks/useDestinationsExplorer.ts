"use client";

import { useMemo, useState } from "react";
import {
  destinationGuides,
  type DestinationGuide,
} from "@/lib/destinationGuides";

export type TabId = "recent" | "loved" | "budget" | "weekends";

/** `heading` swaps the section title so it always describes what's listed. */
export const TABS: { id: TabId; label: string; heading: string }[] = [
  { id: "recent", label: "Recent", heading: "Recent guides" },
  { id: "loved", label: "Most loved", heading: "Most loved guides" },
  { id: "budget", label: "Budget under €1k", heading: "Guides under €1k" },
  { id: "weekends", label: "Weekends", heading: "Weekend guides" },
];

const PAGE_SIZE = 8;

/** Applies the active tab's sort/filter. "recent" keeps the authored order. */
function guidesForTab(tab: TabId): DestinationGuide[] {
  switch (tab) {
    case "loved":
      return [...destinationGuides].sort((a, b) => b.likes - a.likes);
    case "budget":
      return destinationGuides.filter((g) => g.approxCostEUR < 1000);
    case "weekends":
      return destinationGuides.filter((g) => g.days <= 4);
    case "recent":
      return destinationGuides;
  }
}

function matchesQuery(guide: DestinationGuide, needle: string): boolean {
  return (
    guide.title.toLowerCase().includes(needle) ||
    guide.author.toLowerCase().includes(needle) ||
    guide.blurb.toLowerCase().includes(needle)
  );
}

export interface DestinationsExplorerState {
  /** The live input value. Typing this does NOT filter anything. */
  draft: string;
  /** The committed search term the feed is actually filtered against. */
  query: string;
  activeTab: TabId;
  heading: string;
  results: DestinationGuide[];
  visible: DestinationGuide[];
  hasMore: boolean;
  setDraft: (next: string) => void;
  search: (next: string) => void;
  selectTab: (next: TabId) => void;
  loadMore: () => void;
}

/**
 * All of /destinations' client state, in one place so the search band (inside
 * the photo backdrop) and the results feed (plain white, further down the page)
 * can be rendered as two separate components while still sharing one state.
 *
 * Everything filters client-side over the hardcoded `destinationGuides` list —
 * there is no guides API yet. Typing does NOT filter live: `draft` tracks the
 * input as the user types, and `query` only advances on an explicit search
 * action — the Search button/Enter, a popular-destination chip, or "See more…".
 */
export function useDestinationsExplorer(): DestinationsExplorerState {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const tabbed = guidesForTab(activeTab);
    return needle ? tabbed.filter((g) => matchesQuery(g, needle)) : tabbed;
  }, [query, activeTab]);

  return {
    draft,
    query,
    activeTab,
    heading: TABS.find((t) => t.id === activeTab)?.heading ?? TABS[0].heading,
    results,
    visible: results.slice(0, visibleCount),
    hasMore: results.length > visibleCount,
    setDraft,
    search(next: string) {
      setDraft(next);
      setQuery(next);
      setVisibleCount(PAGE_SIZE);
    },
    selectTab(next: TabId) {
      setActiveTab(next);
      setVisibleCount(PAGE_SIZE);
    },
    loadMore() {
      setVisibleCount((c) => c + PAGE_SIZE);
    },
  };
}
