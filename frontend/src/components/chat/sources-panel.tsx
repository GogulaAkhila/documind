import { X, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Citation } from "@/types";

interface SourcesPanelProps {
  sources: Citation[];
  onClose: () => void;
}

export function SourcesPanel({ sources, onClose }: SourcesPanelProps) {
  return (
    <div className="flex w-72 shrink-0 flex-col border-l bg-muted/20">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">Sources</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {sources.map((source, i) => (
            <div
              key={source.chunk_id}
              className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug">
                      {source.document_title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      p. {source.page_number}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  {source.relevance_score.toFixed(2)}
                </span>
              </div>

              {source.snippet && (
                <p className="mb-2 text-[11px] italic leading-relaxed text-muted-foreground">
                  "{source.snippet}"
                </p>
              )}

              <button className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
                View in PDF
              </button>
            </div>
          ))}
        </div>

        {sources.length > 0 && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Sources ranked by relevance
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
