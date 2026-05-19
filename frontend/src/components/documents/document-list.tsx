import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCard } from "./document-card";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";

interface DocumentListProps {
  collectionId: string;
  filter?: string;
}

export function DocumentList({ collectionId, filter }: DocumentListProps) {
  const { data: documents, isLoading } = useDocuments(collectionId);
  const deleteDocument = useDeleteDocument(collectionId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!documents?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No documents uploaded yet. Upload some PDFs to get started.
        </p>
      </div>
    );
  }

  const filtered = filter
    ? documents.filter((d) =>
        d.title.toLowerCase().includes(filter.toLowerCase()),
      )
    : documents;

  if (filter && filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No documents matching "{filter}"
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {filtered.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDelete={(docId) => deleteDocument.mutate(docId)}
        />
      ))}
    </div>
  );
}
