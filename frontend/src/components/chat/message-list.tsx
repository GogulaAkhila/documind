import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { StreamingIndicator } from "./streaming-indicator";
import { Bot, Sparkles, FileText, MessageSquare } from "lucide-react";
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
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">
          Ask anything about your documents
        </h3>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          Get answers with inline citations, compare findings across papers, and
          explore your research corpus.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Summarize the key findings",
            "Compare methodologies across papers",
            "What datasets are used?",
          ].map((q) => (
            <span
              key={q}
              className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground"
            >
              {q}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex gap-3">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                <Bot className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%] space-y-2">
              {streamingContent ? (
                <div className="rounded-2xl rounded-bl-md border border-border/50 bg-muted/60 px-4 py-2.5 text-sm leading-relaxed">
                  <p className="whitespace-pre-wrap">{streamingContent}</p>
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-primary ml-0.5" />
                </div>
              ) : (
                <StreamingIndicator />
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
