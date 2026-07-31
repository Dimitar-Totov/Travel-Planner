import { agentRegistry } from "@/lib/openrouter/registry";
import { createChatCompletion, OpenRouterError } from "@/lib/openrouter/client";
import type { ChatMessage } from "@/lib/openrouter/types";

const VALID_ROLES = new Set(["system", "user", "assistant"]);

function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const messages = (body as Record<string, unknown>).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const parsed: ChatMessage[] = [];
  for (const raw of messages) {
    if (typeof raw !== "object" || raw === null) return null;
    const { role, content } = raw as Record<string, unknown>;
    if (typeof role !== "string" || !VALID_ROLES.has(role)) return null;
    if (typeof content !== "string" || content.trim() === "") return null;
    parsed.push({ role: role as ChatMessage["role"], content });
  }

  return parsed;
}

/** POST /api/ai/[agentId] with a `{ "messages": ChatMessage[] }` JSON body. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/ai/[agentId]">
): Promise<Response> {
  const { agentId } = await ctx.params;
  const agent = agentRegistry[agentId];
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const messages = parseMessages(body);
  if (!messages) {
    return Response.json(
      {
        error:
          'Request body must be shaped like { "messages": [{ "role": "system" | "user" | "assistant", "content": string }] }, with a non-empty messages array.',
      },
      { status: 400 }
    );
  }

  try {
    const response = await createChatCompletion({
      model: agent.model,
      messages: [{ role: "system", content: agent.systemPrompt }, ...messages],
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      stream: agent.stream,
    });
    return Response.json(response, { status: 200 });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      console.error(`[api/ai/${agentId}]`, err.message);
      return Response.json(
        { error: "The model provider request failed.", status: err.status },
        { status: err.status }
      );
    }
    console.error(`[api/ai/${agentId}]`, err);
    return Response.json(
      { error: "Unexpected error while contacting the model provider.", status: 500 },
      { status: 500 }
    );
  }
}
