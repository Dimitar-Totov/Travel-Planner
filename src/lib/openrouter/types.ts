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
