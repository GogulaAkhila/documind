import { useRef, useState, useEffect } from "react";
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploadDocument } from "@/hooks/use-documents";
import { useDocumentStore } from "@/stores/document-store";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 20;

interface DocumentUploadProps {
  collectionId: string;
}

export function DocumentUpload({ collectionId }: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDocument = useUploadDocument(collectionId);
  const uploads = useDocumentStore((s) => s.uploads);
  const removeUpload = useDocumentStore((s) => s.removeUpload);

  const activeUploads = Array.from(uploads.values());

  useEffect(() => {
    const completed = activeUploads.filter((u) => u.status === "complete");
    if (completed.length === 0) return;
    const timer = setTimeout(() => {
      completed.forEach((u) => removeUpload(u.fileName));
    }, 2500);
    return () => clearTimeout(timer);
  }, [activeUploads, removeUpload]);

  function validateAndUpload(files: FileList | File[]) {
    const valid: File[] = [];
    setValidationError(null);

    const fileArray = Array.from(files);
    if (fileArray.length > MAX_FILES) {
      setValidationError(`Maximum ${MAX_FILES} files at once.`);
      return;
    }

    for (const file of fileArray) {
      if (file.type !== "application/pdf") {
        setValidationError(
          `"${file.name}" is not a PDF. Only PDF files are supported.`,
        );
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(
          `"${file.name}" exceeds the 50 MB limit.`,
        );
        continue;
      }
      valid.push(file);
    }

    if (valid.length > 0) {
      uploadDocument.mutate(valid);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    validateAndUpload(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      validateAndUpload(e.target.files);
    }
    e.target.value = "";
  }

  function handleZoneClick() {
    fileInputRef.current?.click();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      {/* Drop zone — fully clickable */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleZoneClick}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30",
        )}
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">
          Drop PDFs here or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF only &middot; max 50 MB &middot; up to {MAX_FILES} files
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
          <button
            onClick={() => setValidationError(null)}
            className="ml-auto shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Active uploads — only shown while uploading or on error */}
      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map((upload) => (
            <div
              key={upload.fileName}
              className={cn(
                "rounded-lg border p-3",
                upload.status === "error" && "border-danger-text/20 bg-danger-bg/30",
                upload.status === "complete" && "border-success-text/20 bg-success-bg/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-bg">
                  <FileText className="h-4 w-4 text-danger-text" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {upload.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {upload.status === "uploading" && (
                      <span className="text-info-text">
                        Uploading... {Math.round(upload.progress)}%
                      </span>
                    )}
                    {upload.status === "complete" && (
                      <span className="text-success-text">
                        Uploaded — processing will begin shortly
                      </span>
                    )}
                    {upload.status === "error" && (
                      <span className="text-danger-text">
                        Upload failed — check connection and try again
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {upload.status === "uploading" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeUpload(upload.fileName)}
                      title="Cancel upload"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {upload.status === "error" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        removeUpload(upload.fileName);
                        fileInputRef.current?.click();
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </Button>
                  )}
                  {upload.status === "error" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeUpload(upload.fileName)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Real upload progress bar */}
              {upload.status === "uploading" && (
                <div className="mt-2">
                  <Progress value={upload.progress} className="h-1.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
