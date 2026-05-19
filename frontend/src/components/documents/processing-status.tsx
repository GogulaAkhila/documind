import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

interface ProcessingStatusProps {
  status: Document["status"];
}

const config = {
  pending: {
    icon: Clock,
    label: "Pending",
    className: "bg-warning-bg text-warning-text",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    className: "bg-info-bg text-info-text",
  },
  ready: {
    icon: CheckCircle2,
    label: "Ready",
    className: "bg-success-bg text-success-text",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    className: "bg-danger-bg text-danger-text",
  },
} as const;

export function ProcessingStatus({ status }: ProcessingStatusProps) {
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
      {label}
    </span>
  );
}
