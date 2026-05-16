import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Citation } from "@/types";

interface CitationBadgeProps {
  citation: Citation;
  index: number;
}

export function CitationBadge({ citation, index }: CitationBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className="cursor-pointer gap-1 transition-colors hover:bg-primary/10 hover:border-primary/30"
        >
          <FileText className="h-3 w-3" />
          <span className="max-w-[140px] truncate">{citation.paper_title}</span>
          <span className="text-muted-foreground">p.{citation.page_number}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p className="font-medium">[{index + 1}] {citation.paper_title}</p>
          <p>Page {citation.page_number}</p>
          <p className="text-muted-foreground">
            Relevance: {(citation.relevance_score * 100).toFixed(0)}%
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
