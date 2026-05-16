import { useCallback, useState } from "react";
import { Upload, FileUp, FileText, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploadDocument } from "@/hooks/use-documents";
import { useDocumentStore } from "@/stores/document-store";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface DocumentUploadProps {
  collectionId: string;
}

export function DocumentUpload({ collectionId }: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const uploadDocument = useUploadDocument(collectionId);
  const uploads = useDocumentStore((s) => s.uploads);
  const removeUpload = useDocumentStore((s) => s.removeUpload);

  const validateFiles = (files: FileList | File[]): File[] => {
    const valid: File[] = [];
    setValidationError(null);

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        setValidationError(`${file.name} is not a PDF. Only PDF files are supported.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(`${file.name} exceeds the 50 MB limit.`);
        continue;
      }
      valid.push(file);
    }

    return valid;
  };

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const valid = validateFiles(files);
      if (valid.length > 0) {
        uploadDocument.mutate(valid);
      }
    },
    [uploadDocument],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
      e.target.value = "";
    },
    [handleFiles],
  );

  const activeUploads = Array.from(uploads.values());

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <p className="mb-1 text-sm font-medium">
          Drag & drop PDF files here
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          PDF only, max 50 MB per file
        </p>
        <label className="cursor-pointer">
          <span className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-all hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50">
            <FileUp className="h-4 w-4" />
            Browse Files
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      </div>

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}

      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map((upload) => (
            <div
              key={upload.fileName}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{upload.fileName}</p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-1.5 h-1.5" />
                )}
                {upload.status === "error" && (
                  <p className="mt-0.5 text-xs text-destructive">Upload failed</p>
                )}
              </div>
              {upload.status !== "uploading" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeUpload(upload.fileName)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
