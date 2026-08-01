import type { AgentResponse, ChatMessage } from "@/lib/openrouter/types";

export class OpenRouterError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Requests strict JSON output when the underlying model supports it. */
  responseFormat?: "json_object";
}

interface OpenRouterChatCompletionResponse {
  model: string;
  choices: { message: { content: string } }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Calls OpenRouter's `/chat/completions` endpoint. Stateless — reads env at call time. */
export async function createChatCompletion(
  params: ChatCompletionParams
): Promise<AgentResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL;

  if (!apiKey) {
    throw new OpenRouterError(500, "OPENROUTER_API_KEY is not set.");
  }
  if (!baseUrl) {
    throw new OpenRouterError(500, "OPENROUTER_BASE_URL is not set.");
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://travel-planner.local",
        "X-Title": "Travel Planner",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 1000,
        stream: params.stream ?? false,
        ...(params.responseFormat
          ? { response_format: { type: params.responseFormat } }
          : {}),
      }),
    });
  } catch (err) {
    throw new OpenRouterError(
      502,
      `Failed to reach OpenRouter: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OpenRouterError(
      res.status,
      `OpenRouter request failed (${res.status}): ${body || res.statusText}`
    );
  }

  const data = (await res.json()) as OpenRouterChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new OpenRouterError(502, "OpenRouter response did not contain a message.");
  }

  return {
    content,
    model: data.model,
    usage: data.usage,
  };
}
