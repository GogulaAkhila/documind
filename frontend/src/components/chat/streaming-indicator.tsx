import { Search, Layers, Sparkles } from "lucide-react";
import { useChatStore, type StreamingPhase } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

const phases: { key: StreamingPhase; label: string; icon: typeof Search }[] = [
  { key: "searching", label: "Searching documents", icon: Search },
  { key: "reranking", label: "Reranking results", icon: Layers },
  { key: "generating", label: "Generating answer", icon: Sparkles },
];

export function StreamingIndicator() {
  const phase = useChatStore((s) => s.streamingPhase);

  const activeIndex = phases.findIndex((p) => p.key === phase);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
      {phases.map((p, i) => {
        const isActive = p.key === phase;
        const isDone = i < activeIndex;
        const Icon = p.icon;

        return (
          <div
            key={p.key}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              isActive && "text-primary font-medium",
              isDone && "text-success-text",
              !isActive && !isDone && "text-muted-foreground/50",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", isActive && "animate-pulse")} />
            <span>{p.label}</span>
            {i < phases.length - 1 && (
              <span className="ml-2 text-muted-foreground/30">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
