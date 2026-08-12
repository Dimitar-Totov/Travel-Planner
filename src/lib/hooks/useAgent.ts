"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentResponse, ChatMessage } from "@/lib/openrouter/types";

interface UseAgentResult {
  send: (messages: ChatMessage[]) => Promise<void>;
  response: AgentResponse | null;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

/** Posts to `/api/ai/[agentId]`. Cancels any in-flight request on unmount or re-send. */
export function useAgent(agentId: string): UseAgentResult {
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (messages: ChatMessage[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/ai/${agentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(
            typeof data?.error === "string" ? data.error : "Request failed.",
          );
          setResponse(null);
          return;
        }

        setResponse(data as AgentResponse);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Request failed.");
        setResponse(null);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [agentId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResponse(null);
    setError(null);
    setLoading(false);
  }, []);

  return { send, response, loading, error, reset };
}
