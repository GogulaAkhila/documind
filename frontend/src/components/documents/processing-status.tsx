import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

interface ProcessingStatusProps {
  status: Document["status"];
}

const config = {
  pending: {
    icon: Clock,
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  ready: {
    icon: CheckCircle2,
    label: "Ready",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
} as const;

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  const { icon: Icon, label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
      <Icon
        className={cn("h-3 w-3", status === "processing" && "animate-spin")}
      />
      {label}
    </Badge>
  );
}
