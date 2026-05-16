import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CitationBadge } from "./citation-badge";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
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
              : "rounded-bl-md bg-muted",
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((citation, i) => (
              <CitationBadge key={citation.chunk_id} citation={citation} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
