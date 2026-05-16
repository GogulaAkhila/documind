import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCard } from "./document-card";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";

interface DocumentListProps {
  collectionId: string;
}

export function DocumentList({ collectionId }: DocumentListProps) {
  const { data: documents, isLoading } = useDocuments(collectionId);
  const deleteDocument = useDeleteDocument(collectionId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-18 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!documents?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No documents uploaded yet. Drop some PDFs above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDelete={(id) => deleteDocument.mutate(id)}
        />
      ))}
    </div>
  );
}
