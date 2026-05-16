import { ShieldCheck, Target, Crosshair } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { EvalMetrics } from "@/types";
import { cn } from "@/lib/utils";

interface MetricsCardsProps {
  metrics: EvalMetrics;
}

const metricConfig = [
  {
    key: "faithfulness" as const,
    label: "Faithfulness",
    description: "Answer grounded in context",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    key: "answer_relevance" as const,
    label: "Answer Relevance",
    description: "Answer addresses the question",
    icon: Target,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "context_precision" as const,
    label: "Context Precision",
    description: "Retrieved context is relevant",
    icon: Crosshair,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

function scoreToLabel(score: number): { text: string; className: string } {
  if (score >= 0.8) return { text: "Excellent", className: "text-emerald-500" };
  if (score >= 0.6) return { text: "Good", className: "text-blue-500" };
  if (score >= 0.4) return { text: "Fair", className: "text-yellow-500" };
  return { text: "Poor", className: "text-red-500" };
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {metricConfig.map(({ key, label, description, icon: Icon, color, bg }) => {
        const score = metrics[key];
        const quality = scoreToLabel(score);

        return (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", bg)}>
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {(score * 100).toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                <span className={cn("ml-auto text-xs font-medium", quality.className)}>
                  {quality.text}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
