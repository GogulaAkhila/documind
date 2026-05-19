import { useState } from "react";
import {
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  Clock,
  FileText,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
}

function InlineCitations({ content, sources }: { content: string; sources: Message["sources"] }) {
  if (sources.length === 0) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  const parts = content.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const num = parseInt(match[1], 10);
          const source = sources[num - 1];
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <sup className="mx-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary hover:bg-primary/25 transition-colors">
                  {num}
                </sup>
              </TooltipTrigger>
              {source && (
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    <p className="font-medium">{source.document_title}</p>
                    <p className="text-muted-foreground">Page {source.page_number}</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const setActiveSources = useChatStore((s) => s.setActiveSources);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "max-w-[80%] space-y-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted/60 border border-border/50",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <InlineCitations content={message.content} sources={message.sources} />
          )}
        </div>

        {/* Status footer + actions for assistant messages */}
        {!isUser && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {message.sources.length} sources
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text">
                <ShieldCheck className="h-3 w-3" />
                grounded
              </span>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                className={cn(
                  "rounded p-1 transition-colors hover:bg-accent",
                  feedback === "up" && "text-primary",
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                className={cn(
                  "rounded p-1 transition-colors hover:bg-accent",
                  feedback === "down" && "text-destructive",
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleCopy}
                className="rounded p-1 transition-colors hover:bg-accent"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success-text" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Clickable to show sources in sidebar */}
        {!isUser && message.sources.length > 0 && (
          <button
            onClick={() => setActiveSources(message.sources)}
            className="px-1 text-[11px] text-primary hover:underline"
          >
            View {message.sources.length} sources in panel
          </button>
        )}
      </div>
    </div>
  );
}
