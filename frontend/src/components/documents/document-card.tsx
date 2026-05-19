import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingStatus } from "./processing-status";
import type { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-bg">
        <FileText className="h-4 w-4 text-danger-text" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{document.title}</p>
        <p className="text-xs text-muted-foreground">
          {document.page_count} pages &middot;{" "}
          {document.status === "ready" ? "indexed" : document.status}
        </p>
      </div>

      <ProcessingStatus status={document.status} />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onDelete(document.id)}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
