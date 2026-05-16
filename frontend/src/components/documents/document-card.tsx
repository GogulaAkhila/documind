import { FileText, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProcessingStatus } from "./processing-status";
import type { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  return (
    <Card className="group transition-all hover:shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
          <FileText className="h-5 w-5 text-red-500" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{document.page_count} pages</span>
            <span>&middot;</span>
            <span>{new Date(document.uploaded_at).toLocaleDateString()}</span>
          </div>
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
      </CardContent>
    </Card>
  );
}
