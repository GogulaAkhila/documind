import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

interface ProcessingStatusProps {
  status: Document["status"];
  compact?: boolean;
}

const config = {
  pending: {
    icon: Clock,
    label: "Queued",
    description: "Waiting to process",
    className: "bg-warning-bg text-warning-text",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    description: "Extracting text & generating embeddings...",
    className: "bg-info-bg text-info-text",
  },
  ready: {
    icon: CheckCircle2,
    label: "Ready",
    description: "Indexed and queryable",
    className: "bg-success-bg text-success-text",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    description: "Processing failed",
    className: "bg-danger-bg text-danger-text",
  },
} as const;

export function ProcessingStatus({ status, compact }: ProcessingStatusProps) {
  const { icon: Icon, label, className } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon
        className={cn("h-3 w-3", status === "processing" && "animate-spin")}
      />
      {!compact && label}
    </span>
  );
}

export function getStatusDescription(status: Document["status"]): string {
  return config[status].description;
}
