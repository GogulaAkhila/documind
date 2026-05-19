import React, { useCallback, useState } from "react";
import {
  Upload,
  FileUp,
  FileText,
  X,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  HelpCircle,
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

function PipelineStage({
  label,
  status,
}: {
  label: string;
  status: "done" | "active" | "pending";
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
          status === "done" && "border-success-text bg-success-bg",
          status === "active" &&
            "border-warning-text bg-warning-bg",
          status === "pending" && "border-border bg-muted",
        )}
      >
        {status === "done" && (
          <CheckCircle2 className="h-4 w-4 text-success-text" />
        )}
        {status === "active" && (
          <Loader2 className="h-4 w-4 animate-spin text-warning-text" />
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium",
          status === "done" && "text-success-text",
          status === "active" && "text-warning-text",
          status === "pending" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function PipelineConnector({ filled }: { filled: boolean }) {
  return (
    <div className="mt-[-14px] h-0.5 flex-1">
      <div
        className={cn(
          "h-full rounded-full transition-colors",
          filled ? "bg-success-text/60" : "bg-border",
        )}
      />
    </div>
  );
}

export function DocumentUpload({ collectionId }: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const uploadDocument = useUploadDocument(collectionId);
  const uploads = useDocumentStore((s) => s.uploads);
  const removeUpload = useDocumentStore((s) => s.removeUpload);

  function handleFiles(files: FileList | File[]) {
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
          `${file.name} is not a PDF. Only PDF files are supported.`,
        );
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(`${file.name} exceeds the 50 MB limit.`);
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
    handleFiles(e.dataTransfer.files);
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
      handleFiles(e.target.files);
    }
    e.target.value = "";
  }

  const activeUploads = Array.from(uploads.values());
  const uploading = activeUploads.filter((u) => u.status === "uploading").length;
  const complete = activeUploads.filter((u) => u.status === "complete").length;
  const errored = activeUploads.filter((u) => u.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/20 hover:border-primary/40",
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mb-1 text-sm font-medium">
          Drag PDFs here, or click to browse
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          Supports PDF &middot; max 50MB per file &middot; up to {MAX_FILES}{" "}
          files at once
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
          <FileUp className="h-3.5 w-3.5" />
          Browse Files
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}

      {/* Batch summary */}
      {activeUploads.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-xs">
          <span className="font-medium">
            {activeUploads.length} file{activeUploads.length !== 1 ? "s" : ""}:
          </span>
          {uploading > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warning-text" />
              {uploading} uploading
            </span>
          )}
          {complete > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success-text" />
              {complete} complete
            </span>
          )}
          {errored > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-danger-text" />
              {errored} failed
            </span>
          )}
        </div>
      )}

      {/* Upload items */}
      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map((upload) => (
            <div
              key={upload.fileName}
              className={cn(
                "rounded-xl border bg-card p-4",
                upload.status === "error" && "border-danger-text/20",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-bg">
                    <FileText className="h-4 w-4 text-danger-text" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {upload.fileName}
                    </p>
                    {upload.status === "uploading" && (
                      <p className="text-xs text-warning-text">
                        Uploading... {Math.round(upload.progress)}%
                      </p>
                    )}
                    {upload.status === "complete" && (
                      <p className="text-xs text-success-text">
                        Ready to process
                      </p>
                    )}
                    {upload.status === "error" && (
                      <p className="text-xs text-danger-text">Upload failed</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {upload.status === "error" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-danger-text border-danger-text/20 hover:bg-danger-bg">
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  )}
                  {upload.status !== "uploading" && (
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

              {/* Progress bar for uploading state */}
              {upload.status === "uploading" && (
                <div className="mt-3">
                  <Progress value={upload.progress} className="h-1.5" />
                  <div className="mt-2 flex items-center justify-between">
                    {["Parsed", "Chunked", "Embedding", "Indexed"].map(
                      (stage, i) => {
                        const progress = upload.progress;
                        let status: "done" | "active" | "pending" = "pending";
                        if (progress > (i + 1) * 25) status = "done";
                        else if (progress > i * 25) status = "active";
                        return (
                          <React.Fragment key={stage}>
                            {i > 0 && (
                              <PipelineConnector
                                filled={status === "done" || (i > 0 && progress > i * 25)}
                              />
                            )}
                            <PipelineStage label={stage} status={status} />
                          </React.Fragment>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {/* Error help text */}
              {upload.status === "error" && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Check that the file is a valid, text-based PDF (not scanned).
                    Scanned PDFs require OCR to be enabled.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
