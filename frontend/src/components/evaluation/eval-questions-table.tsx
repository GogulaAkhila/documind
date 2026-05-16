import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvalQuestions } from "@/hooks/use-evaluation";
import type { EvalQuestion } from "@/types";
import { cn } from "@/lib/utils";

interface EvalQuestionsTableProps {
  runId: string;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = score * 100;
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums font-normal",
        pct >= 80 && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        pct >= 60 && pct < 80 && "border-blue-500/30 text-blue-600 dark:text-blue-400",
        pct >= 40 && pct < 60 && "border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
        pct < 40 && "border-red-500/30 text-red-600 dark:text-red-400",
      )}
    >
      {pct.toFixed(0)}%
    </Badge>
  );
}

function QuestionRow({ question }: { question: EvalQuestion }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 text-sm">{question.question}</span>
        <div className="flex gap-2">
          <ScoreBadge score={question.scores.faithfulness} />
          <ScoreBadge score={question.scores.answer_relevance} />
          <ScoreBadge score={question.scores.context_precision} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 bg-muted/30 px-4 py-3 pl-11">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Ground Truth</p>
            <p className="text-sm">{question.ground_truth}</p>
          </div>
          <Separator />
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Generated Answer</p>
            <p className="text-sm">{question.generated_answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function EvalQuestionsTable({ runId }: EvalQuestionsTableProps) {
  const { data: questions, isLoading } = useEvalQuestions(runId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Per-Question Scores</CardTitle>
          <div className="flex gap-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <span>Faith.</span>
            <span>Relev.</span>
            <span>Prec.</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !questions?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No evaluation questions found for this run.
          </p>
        ) : (
          <div>
            {questions.map((q) => (
              <QuestionRow key={q.id} question={q} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
