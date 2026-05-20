import { X, ExternalLink } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import { useDocuments } from "@/hooks/use-documents";
import { cn } from "@/lib/utils";
import type { Citation } from "@/types";

interface SourcesPanelProps {
  sources: Citation[];
  onClose: () => void;
}

function getTitle(source: Citation): string {
  return source.title || source.document_title || "Unknown";
}

function getPage(source: Citation): number {
  return source.page || source.page_number || 0;
}

export function SourcesPanel({ sources, onClose }: SourcesPanelProps) {
  const { id: collectionId } = useParams<{ id: string }>();
  const highlightedIndex = useChatStore((s) => s.highlightedCitationIndex);
  const setHighlighted = useChatStore((s) => s.setHighlightedCitation);
  const { data: documents } = useDocuments(collectionId ?? "");

  function openPdf(source: Citation) {
    const title = getTitle(source);
    const page = getPage(source);
    const doc = documents?.find(
      (d) => d.title === title || title.includes(d.title) || d.title.includes(title),
    );
    if (doc?.file) {
      window.open(`${doc.file}#page=${page}`, "_blank");
    }
  }

  return (
    <div className="hidden w-80 shrink-0 flex-col border-l bg-muted/10 lg:flex">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">
          Sources ({sources.length})
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {sources.map((source, i) => (
            <div
              key={`${source.chunk_id}-${i}`}
              onMouseEnter={() => setHighlighted(i)}
              onMouseLeave={() => setHighlighted(null)}
              className={cn(
                "rounded-lg border p-3 transition-all",
                highlightedIndex === i
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "bg-card hover:border-primary/30",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                    highlightedIndex === i
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">
                    {getTitle(source)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Page {getPage(source)}
                    {source.section && ` · ${source.section}`}
                  </p>
                </div>
              </div>

              {/* Relevance bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${Math.min(source.relevance_score * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {(source.relevance_score * 100).toFixed(0)}%
                </span>
              </div>

              {source.snippet && (
                <p className="mt-2 text-[11px] italic leading-relaxed text-muted-foreground line-clamp-2">
                  "{source.snippet}"
                </p>
              )}

              <button
                onClick={() => openPdf(source)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View in PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
