import { useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { WebSocketManager } from "@/lib/websocket";
import { useChatStore } from "@/stores/chat-store";
import type { ChatSession, Message, PaginatedResponse, WebSocketMessage } from "@/types";

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
