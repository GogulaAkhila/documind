import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { streamMessage, type ChatHistoryMessage } from "@/lib/sse-stream";
import { WebSocketManager } from "@/lib/websocket";
import { useChatStore } from "@/stores/chat-store";
import type { StreamingPhase } from "@/stores/chat-store";
import type { ChatSession, Citation, Message, PaginatedResponse, WebSocketMessage } from "@/types";

function sessionsKey(collectionId: string) {
  return ["chat-sessions", collectionId] as const;
}

function sessionMessagesKey(sessionId: string) {
  return ["chat-messages", sessionId] as const;
}

export function useChatSessions(collectionId: string) {
  return useQuery({
    queryKey: sessionsKey(collectionId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ChatSession>>(
        `/chat/sessions/`,
        { params: { collection: collectionId } },
      );
      return data.results;
    },
    enabled: !!collectionId,
  });
}

export function useCreateChatSession(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const { data } = await api.post<ChatSession>(
        `/chat/sessions/`,
        { title: title ?? "New Chat", collection: collectionId },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey(collectionId) });
    },
  });
}

export function useChatMessages(sessionId: string) {
  const setMessages = useChatStore((s) => s.setMessages);

  const query = useQuery({
    queryKey: sessionMessagesKey(sessionId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Message>>(
        `/chat/messages/`,
        { params: { session: sessionId } },
      );
      return data.results;
    },
    enabled: !!sessionId,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.data) {
      setMessages(query.data);
    }
  }, [query.data, setMessages]);

  return query;
}

export function useChatWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocketManager | null>(null);
  const { addToken, setStreamingSources, startStreaming, finishStreaming, addMessage } =
    useChatStore();

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      switch (msg.type) {
        case "token":
          addToken(msg.data as string);
          break;
        case "sources":
          setStreamingSources(WebSocketManager.parseSourcesFromMessage(msg.data));
          break;
        case "done":
          finishStreaming();
          break;
        case "error":
          finishStreaming();
          break;
      }
    },
    [addToken, setStreamingSources, finishStreaming],
  );

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocketManager(
      `/ws/chat/${sessionId}/`,
      handleMessage,
      () => {},
    );
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [sessionId, handleMessage]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || !sessionId) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        sources: [],
        created_at: new Date().toISOString(),
      };
      addMessage(userMessage);
      startStreaming();
      wsRef.current.send({ type: "question", content });
    },
    [sessionId, addMessage, startStreaming],
  );

  return { sendMessage };
}

export function useSendMessageREST(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post<Message>(
        `/chat/messages/`,
        { content, session: sessionId },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionMessagesKey(sessionId) });
    },
  });
}

const PHASE_MAP: Record<string, StreamingPhase> = {
  searching: "searching",
  reranking: "reranking",
  generating: "generating",
};

export function useSendMessageStream(sessionId: string) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const {
    addToken,
    setStreamingSources,
    startStreaming,
    finishStreaming,
    setStreamingPhase,
    addMessage,
  } = useChatStore();

  const send = useCallback(
    async (content: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        sources: [],
        created_at: new Date().toISOString(),
      };
      addMessage(userMessage);
      startStreaming();

      // Build chat history from current messages for conversational context
      const currentMessages = useChatStore.getState().messages;
      const history: ChatHistoryMessage[] = currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      await streamMessage(sessionId, content, {
        onPhase: (phase) => {
          const mapped = PHASE_MAP[phase];
          if (mapped) setStreamingPhase(mapped);
        },
        onSources: (sources) => {
          setStreamingSources(sources as Citation[]);
        },
        onToken: (token) => {
          addToken(token);
        },
        onDone: (meta) => {
          const citations = (meta.citations ?? []) as Citation[];
          const streamContent = useChatStore.getState().streamingContent;

          if (streamContent) {
            const assistantMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: streamContent,
              sources: citations,
              created_at: new Date().toISOString(),
              confidence_level: meta.confidence_level as string,
              retrieval_score: meta.retrieval_score as number,
              flagged_claims: meta.flagged_claims as string[],
              query_type: meta.query_type as string,
            };
            addMessage(assistantMessage);
          }
          finishStreaming();
          queryClient.invalidateQueries({ queryKey: sessionMessagesKey(sessionId) });
        },
        onError: (msg) => {
          console.error("Stream error:", msg);
          finishStreaming();
        },
        onMessageSaved: () => {
          queryClient.invalidateQueries({ queryKey: sessionMessagesKey(sessionId) });
        },
      }, controller.signal, history);
    },
    [sessionId, addToken, setStreamingSources, startStreaming, finishStreaming, setStreamingPhase, addMessage, queryClient],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    finishStreaming();
  }, [finishStreaming]);

  return { send, stop };
}

export function updateSessionTitle(sessionId: string, title: string) {
  return api.patch<ChatSession>(`/chat/sessions/${sessionId}/`, { title });
}

export function useDeleteChatSession(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/chat/sessions/${sessionId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey(collectionId) });
    },
  });
}
