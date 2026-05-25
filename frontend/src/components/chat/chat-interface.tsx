import { useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { useChatMessages, useSendMessageStream, updateSessionTitle } from "@/hooks/use-chat";
import { useChatStore } from "@/stores/chat-store";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatInterfaceProps {
  sessionId: string;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const { id: collectionId } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setCurrentSession = useChatStore((s) => s.setCurrentSession);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const suspendSession = useChatStore((s) => s.suspendSession);
  const restoreSession = useChatStore((s) => s.restoreSession);
  const { isLoading } = useChatMessages(sessionId);
  const { send: streamSend, stop: streamStop } = useSendMessageStream(sessionId);
  const initialSent = useRef(false);
  const titleUpdated = useRef(false);

  useEffect(() => {
    setCurrentSession(sessionId);
    restoreSession(sessionId);
    initialSent.current = false;
    titleUpdated.current = false;
    return () => {
      suspendSession();
      setCurrentSession(null);
      clearMessages();
    };
  }, [sessionId, setCurrentSession, clearMessages, suspendSession, restoreSession]);

  const handleSend = useCallback(
    (content: string) => {
      const isFirstMessage =
        !titleUpdated.current &&
        useChatStore.getState().messages.filter((m) => m.role === "user").length === 0;

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

      streamSend(content);
    },
    [streamSend, sessionId, collectionId, queryClient],
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
              <Skeleton className="h-16 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList />
      <ChatInput
        onSend={handleSend}
        onStop={streamStop}
        disabled={isStreaming}
      />
    </div>
  );
}
