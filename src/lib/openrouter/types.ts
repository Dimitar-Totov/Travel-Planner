/** Config for a single agent. One file per agent under `lib/openrouter/agents/`. */
export interface AgentConfig {
  /** Unique slug — matches the agent's filename and the `/api/ai/[agentId]` route segment. */
  id: string;
  /** OpenRouter model string, e.g. "openai/gpt-4o-mini". */
  model: string;
  systemPrompt: string;
  /** Default: 0.7 */
  temperature?: number;
  /** Default: 1000 */
  maxTokens?: number;
  /** Default: false */
  stream?: boolean;
  /**
   * Set `false` on a reasoning model to stop it burning hidden reasoning
   * tokens before the answer. Measured on `itinerary-planner`: leaving it on
   * cost 6076 of an 8000-token budget and truncated the JSON mid-object;
   * turning it off cut the call from 97s to 43s and completed cleanly.
   * Omitted = leave the model's default alone.
   */
  reasoning?: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentRequest {
  /** Conversation history from the caller; the agent's system prompt is injected server-side. */
  messages: ChatMessage[];
}

export interface AgentResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
