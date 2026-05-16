import logging
from dataclasses import dataclass

from datasets import Dataset
from ragas import evaluate
from ragas.metrics import answer_relevancy, context_precision, faithfulness

from core.rag.pipeline import RAGPipeline

logger = logging.getLogger(__name__)


@dataclass
class EvalResult:
    question: str
    generated_answer: str
    retrieved_contexts: list[str]
    scores: dict[str, float]


class RagasEvalService:
    def __init__(self) -> None:
        self.pipeline = RAGPipeline()
        self.metrics = [faithfulness, answer_relevancy, context_precision]

    def run_evaluation(
        self,
        questions: list[dict],
        collection_id: str,
    ) -> tuple[list[EvalResult], dict[str, float]]:
        results: list[EvalResult] = []
        dataset_rows: list[dict] = []

        for q_data in questions:
            question = q_data["question"]
            ground_truth = q_data.get("ground_truth", "")

            try:
                rag_result = self.pipeline.query(
                    user_query=question,
                    collection_id=collection_id,
                )
                contexts = [ctx.content for ctx in rag_result.retrieved_chunks]
                answer = rag_result.answer
            except Exception as e:
                logger.error(
                    "RAG pipeline failed during eval",
                    extra={"question": question[:100], "error": str(e)},
                )
                contexts = []
                answer = f"Error: {e}"

            row = {
                "question": question,
                "answer": answer,
                "contexts": contexts,
                "ground_truth": ground_truth,
            }
            dataset_rows.append(row)

            results.append(EvalResult(
                question=question,
                generated_answer=answer,
                retrieved_contexts=contexts,
                scores={},
            ))

        if not dataset_rows:
            return results, {}

        dataset = Dataset.from_list(dataset_rows)

        try:
            eval_results = evaluate(dataset=dataset, metrics=self.metrics)
            scores_df = eval_results.to_pandas()

            for i, result in enumerate(results):
                if i < len(scores_df):
                    row_scores = scores_df.iloc[i]
                    result.scores = {
                        "faithfulness": float(row_scores.get("faithfulness", 0)),
                        "answer_relevancy": float(row_scores.get("answer_relevancy", 0)),
                        "context_precision": float(row_scores.get("context_precision", 0)),
                    }

            average_scores = {
                "faithfulness": float(scores_df["faithfulness"].mean()),
                "answer_relevancy": float(scores_df["answer_relevancy"].mean()),
                "context_precision": float(scores_df["context_precision"].mean()),
            }
        except Exception as e:
            logger.exception("RAGAS evaluation failed", extra={"error": str(e)})
            average_scores = {"error": str(e)}

        return results, average_scores
