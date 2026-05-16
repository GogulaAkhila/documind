import { useParams } from "react-router-dom";
import { EvalDashboard } from "@/components/evaluation/eval-dashboard";

export function EvaluationPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No collection selected</p>
      </div>
    );
  }

  return <EvalDashboard collectionId={id} />;
}
