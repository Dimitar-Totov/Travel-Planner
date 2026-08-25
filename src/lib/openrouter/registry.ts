import type { AgentConfig } from "@/lib/openrouter/types";
import { assistant } from "@/lib/openrouter/agents/assistant";
import { itineraryPlanner } from "@/lib/openrouter/agents/itinerary-planner";

/**
 * Single source of truth for all agents. Adding an agent = create
 * `lib/openrouter/agents/[id].ts` exporting an `AgentConfig`, then add it here.
 */
export const agentRegistry: Record<string, AgentConfig> = {
  [assistant.id]: assistant,
  [itineraryPlanner.id]: itineraryPlanner,
};
