import { useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { useChatMessages, useSendMessageREST, updateSessionTitle } from "@/hooks/use-chat";
import { useChatStore } from "@/stores/chat-store";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message } from "@/types";

interface ChatInterfaceProps {
  sessionId: string;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const { id: collectionId } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setCurrentSession = useChatStore((s) => s.setCurrentSession);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const startStreaming = useChatStore((s) => s.startStreaming);
  const finishStreaming = useChatStore((s) => s.finishStreaming);
  const { isLoading } = useChatMessages(sessionId);
  const sendMessageMutation = useSendMessageREST(sessionId);
  const initialSent = useRef(false);
  const titleUpdated = useRef(false);

  useEffect(() => {
    setCurrentSession(sessionId);
    initialSent.current = false;
    titleUpdated.current = false;
    return () => {
      setCurrentSession(null);
      clearMessages();
    };
  }, [sessionId, setCurrentSession, clearMessages]);

  const handleSend = useCallback(
    (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        sources: [],
        created_at: new Date().toISOString(),
      };
      addMessage(userMessage);
      startStreaming();

      const isFirstMessage =
        !titleUpdated.current &&
        useChatStore.getState().messages.filter((m) => m.role === "user").length <= 1;

      if (isFirstMessage) {
        titleUpdated.current = true;
        const title = content.length > 80 ? content.slice(0, 80) + "..." : content;
        updateSessionTitle(sessionId, title)
          .then(() => {
            if (collectionId) {
              queryClient.invalidateQueries({
                queryKey: ["chat-sessions", collectionId],
              });
            }
          })
          .catch(() => {});
      }

      sendMessageMutation.mutate(content, {
        onSuccess: (assistantMessage) => {
          addMessage(assistantMessage);
          finishStreaming();
        },
        onError: () => {
          finishStreaming();
        },
      });
    },
    [addMessage, startStreaming, finishStreaming, sendMessageMutation, sessionId, collectionId, queryClient],
  );

  useEffect(() => {
    const initial = (location.state as any)?.initialMessage;
    if (initial && !isLoading && !initialSent.current) {
      initialSent.current = true;
      window.history.replaceState({}, "");
      handleSend(initial);
    }
  }, [isLoading, location.state, handleSend]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-16 w-2/3 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList />
      <ChatInput onSend={handleSend} disabled={sendMessageMutation.isPending} />
    </div>
  );
}
