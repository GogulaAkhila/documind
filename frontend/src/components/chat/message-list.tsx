import { useEffect, useRef, useState, useCallback } from "react";
import { MessageBubble } from "./message-bubble";
import { StreamingIndicator } from "./streaming-indicator";
import { Bot, Sparkles, ArrowDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChatStore } from "@/stores/chat-store";

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const userScrolled = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    userScrolled.current = false;
    setShowScrollBtn(false);
  }, []);

  useEffect(() => {
    if (!userScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 100) {
      userScrolled.current = true;
      setShowScrollBtn(true);
    } else {
      userScrolled.current = false;
      setShowScrollBtn(false);
    }
  }

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
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
      >
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
              <div className="min-w-0 flex-1 space-y-2">
                {streamingContent ? (
                  <div className="text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap">
                      {streamingContent}
                      <span className="inline-block h-4 w-0.5 animate-pulse bg-primary ml-0.5" />
                    </p>
                  </div>
                ) : (
                  <StreamingIndicator />
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm transition-all hover:bg-accent"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
