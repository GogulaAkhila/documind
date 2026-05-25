export interface SSEEvent {
  type: "phase" | "confidence" | "sources" | "token" | "done" | "error" | "message_saved";
  data: unknown;
}

export interface StreamCallbacks {
  onPhase?: (phase: string) => void;
  onConfidence?: (data: { level: string; score: number }) => void;
  onSources?: (sources: unknown[]) => void;
  onToken?: (token: string) => void;
  onDone?: (meta: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  onMessageSaved?: (data: { id: string }) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export async function streamMessage(
  sessionId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/messages/stream/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: sessionId, content }),
    signal,
  });

  if (!response.ok || !response.body) {
    callbacks.onError?.(
      `Request failed with status ${response.status}`,
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const event: SSEEvent = JSON.parse(trimmed.slice(6));
          dispatchEvent(event, callbacks);
        } catch {
          // skip malformed lines
        }
      }
    }

    if (buffer.trim().startsWith("data: ")) {
      try {
        const event: SSEEvent = JSON.parse(buffer.trim().slice(6));
        dispatchEvent(event, callbacks);
      } catch {
        // skip
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    callbacks.onError?.((err as Error).message);
  }
}

function dispatchEvent(event: SSEEvent, callbacks: StreamCallbacks): void {
  switch (event.type) {
    case "phase":
      callbacks.onPhase?.(event.data as string);
      break;
    case "confidence":
      callbacks.onConfidence?.(event.data as { level: string; score: number });
      break;
    case "sources":
      callbacks.onSources?.(event.data as unknown[]);
      break;
    case "token":
      callbacks.onToken?.(event.data as string);
      break;
    case "done":
      callbacks.onDone?.(event.data as Record<string, unknown>);
      break;
    case "error":
      callbacks.onError?.(event.data as string);
      break;
    case "message_saved":
      callbacks.onMessageSaved?.(event.data as { id: string });
      break;
  }
}
