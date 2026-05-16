import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=1,
    default_retry_delay=120,
    acks_late=True,
    time_limit=3600,
    soft_time_limit=3300,
)
def run_evaluation_task(self, eval_run_id: str) -> dict:
    from apps.evaluation.models import EvalRun
    from apps.evaluation.services.ragas_eval import RagasEvalService

    try:
        eval_run = EvalRun.objects.get(id=eval_run_id)
    except EvalRun.DoesNotExist:
        logger.error("EvalRun not found", extra={"eval_run_id": eval_run_id})
        return {"status": "error", "detail": "EvalRun not found"}

    eval_run.status = EvalRun.Status.RUNNING
    eval_run.started_at = timezone.now()
    eval_run.save(update_fields=["status", "started_at"])

    questions_data = [
        {"question": q.question, "ground_truth": q.ground_truth}
        for q in eval_run.questions.all()
    ]

    service = RagasEvalService()

    try:
        results, average_scores = service.run_evaluation(
            questions=questions_data,
            collection_id=str(eval_run.collection_id),
        )

        eval_questions = list(eval_run.questions.order_by("id"))
        for i, result in enumerate(results):
            if i < len(eval_questions):
                eq = eval_questions[i]
                eq.generated_answer = result.generated_answer
                eq.retrieved_contexts = result.retrieved_contexts
                eq.scores = result.scores
                eq.save(update_fields=["generated_answer", "retrieved_contexts", "scores"])

        eval_run.status = EvalRun.Status.COMPLETED
        eval_run.completed_at = timezone.now()
        eval_run.metrics = {"average_scores": average_scores}
        eval_run.save(update_fields=["status", "completed_at", "metrics"])

        logger.info(
            "Evaluation completed",
            extra={"eval_run_id": eval_run_id, "scores": average_scores},
        )
        return {"status": "completed", "eval_run_id": eval_run_id}

    except Exception as e:
        logger.exception("Evaluation failed", extra={"eval_run_id": eval_run_id})
        eval_run.status = EvalRun.Status.FAILED
        eval_run.error_message = str(e)[:1000]
        eval_run.completed_at = timezone.now()
        eval_run.save(update_fields=["status", "error_message", "completed_at"])
        return {"status": "failed", "eval_run_id": eval_run_id, "error": str(e)}
