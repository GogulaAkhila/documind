import { Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MetricsCards } from "./metrics-cards";
import { EvalChart } from "./eval-chart";
import { EvalQuestionsTable } from "./eval-questions-table";
import { useLatestEvalRun, useTriggerEvaluation } from "@/hooks/use-evaluation";

interface EvalDashboardProps {
  collectionId: string;
}

export function EvalDashboard({ collectionId }: EvalDashboardProps) {
  const { data: latestRun, isLoading, refetch } = useLatestEvalRun(collectionId);
  const triggerEval = useTriggerEvaluation(collectionId);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[350px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Evaluation Dashboard</h2>
          {latestRun && (
            <p className="mt-1 text-sm text-muted-foreground">
              Last run: {new Date(latestRun.created_at).toLocaleString()}
              <Badge variant="outline" className="ml-2">
                {latestRun.status}
              </Badge>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => triggerEval.mutate()}
            disabled={triggerEval.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            {triggerEval.isPending ? "Running..." : "Run Evaluation"}
          </Button>
        </div>
      </div>

      {!latestRun ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No evaluations yet</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Run an evaluation to measure how well your RAG pipeline answers
            questions about the documents in this collection.
          </p>
          <Button onClick={() => triggerEval.mutate()} disabled={triggerEval.isPending}>
            <Play className="mr-2 h-4 w-4" />
            Run First Evaluation
          </Button>
        </div>
      ) : (
        <>
          <MetricsCards metrics={latestRun.metrics} />
          <EvalChart metrics={latestRun.metrics} />
          <EvalQuestionsTable runId={latestRun.id} />
        </>
      )}
    </div>
  );
}
