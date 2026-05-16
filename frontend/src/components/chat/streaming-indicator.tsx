import { cn } from "@/lib/utils";

interface StreamingIndicatorProps {
  className?: string;
}

export function StreamingIndicator({ className }: StreamingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-xs text-muted-foreground">Thinking</span>
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
