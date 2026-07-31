import type { AgentConfig } from "@/lib/openrouter/types";

export const assistant: AgentConfig = {
  id: "assistant",
  model: "openai/gpt-oss-20b:free",
  systemPrompt:
    "You are a helpful, friendly assistant. Answer questions clearly and concisely.",
};
