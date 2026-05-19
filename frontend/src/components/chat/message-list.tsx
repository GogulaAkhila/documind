import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { StreamingIndicator } from "./streaming-indicator";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChatStore } from "@/stores/chat-store";

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const streamingSources = useChatStore((s) => s.streamingSources);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">Ask anything about your documents</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          I can answer questions, summarize findings, compare documents, and cite
          specific passages from your uploaded documents.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%] space-y-2">
              {streamingContent ? (
                <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm leading-relaxed">
                  <p className="whitespace-pre-wrap">{streamingContent}</p>
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground" />
                </div>
              ) : (
                <StreamingIndicator />
              )}
              {streamingSources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {streamingSources.map((citation, i) => (
                    <span
                      key={citation.chunk_id}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      [{i + 1}] {citation.document_title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
