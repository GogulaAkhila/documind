import { cn } from "@/lib/utils";

interface StreamingIndicatorProps {
  className?: string;
}

export function StreamingIndicator({ className }: StreamingIndicatorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border/50 bg-muted/60 px-4 py-3",
        className,
      )}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">Thinking</span>
    </div>
  );
}
