import { useState } from "react";
import {
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  Copy,
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
import type { Message, Citation } from "@/types";

interface MessageBubbleProps {
  message: Message;
}

function getTitle(source: Citation): string {
  return source.title || source.document_title || "Unknown";
}

function getPage(source: Citation): number {
  return source.page || source.page_number || 0;
}

function CitationChip({ num, source, index }: { num: number; source?: Citation; index: number }) {
  const highlightedIndex = useChatStore((s) => s.highlightedCitationIndex);
  const setHighlighted = useChatStore((s) => s.setHighlightedCitation);
  const isHighlighted = highlightedIndex === index;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <sup
          onMouseEnter={() => setHighlighted(index)}
          onMouseLeave={() => setHighlighted(null)}
          className={cn(
            "mx-0.5 inline-flex h-4 min-w-4 cursor-pointer items-center justify-center rounded-full px-1 text-[10px] font-bold transition-all",
            isHighlighted
              ? "bg-primary text-primary-foreground scale-125"
              : "bg-primary/15 text-primary hover:bg-primary/25",
          )}
        >
          {num}
        </sup>
      </TooltipTrigger>
      {source && (
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-medium">{getTitle(source)}</p>
            <p className="text-muted-foreground">
              Page {getPage(source)}
              {source.section && ` · ${source.section}`}
            </p>
            {source.snippet && (
              <p className="italic text-muted-foreground line-clamp-2">
                "{source.snippet}"
              </p>
            )}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^(\s*)\*\s+/gm, "$1• ")
    .replace(/^(\s*)-\s+/gm, "$1• ");
}

function FormattedContent({ content, sources }: { content: string; sources: Citation[] }) {
  if (sources.length === 0) {
    const html = formatMarkdown(content);
    return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const citationPattern = /(\[[^\]]+,\s*Page\s*\d+\]|\[\d+\])/g;

  const titleToIndex = new Map<string, number>();
  sources.forEach((s, i) => {
    const key = `${getTitle(s)}-${getPage(s)}`;
    if (!titleToIndex.has(key)) {
      titleToIndex.set(key, i);
    }
  });

  const parts = content.split(citationPattern);

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const numMatch = part.match(/^\[(\d+)\]$/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          const idx = num - 1;
          return <CitationChip key={i} num={num} source={sources[idx]} index={idx} />;
        }

        const titleMatch = part.match(/^\[([^,]+),\s*Page\s*(\d+)\]$/);
        if (titleMatch) {
          const title = titleMatch[1];
          const page = parseInt(titleMatch[2], 10);
          const key = `${title}-${page}`;
          const idx = titleToIndex.get(key) ?? 0;
          const source = sources[idx];
          return <CitationChip key={i} num={idx + 1} source={source} index={idx} />;
        }

        const html = formatMarkdown(part);
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const setActiveSources = useChatStore((s) => s.setActiveSources);
  const activeSources = useChatStore((s) => s.activeSources);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[70%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-2">
        {/* Full-width response (no max-width bubble) */}
        <div className="text-sm leading-relaxed">
          <FormattedContent content={message.content} sources={message.sources} />
        </div>

        {/* Footer: sources + actions */}
        {message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/30 pt-2">
            <button
              onClick={() => setActiveSources(message.sources)}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
                activeSources === message.sources
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <FileText className="h-3 w-3" />
              {message.sources.length} sources
            </button>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text">
              <ShieldCheck className="h-3 w-3" />
              grounded
            </span>

            <div className="ml-auto flex items-center gap-0.5">
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
      </div>
    </div>
  );
}
