from rest_framework import serializers

from .models import EvalQuestion, EvalRun


class EvalQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvalQuestion
        fields = [
            "id", "eval_run", "question", "ground_truth",
            "generated_answer", "retrieved_contexts", "scores",
        ]
        read_only_fields = ["id", "generated_answer", "retrieved_contexts", "scores"]


class EvalRunSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    average_scores = serializers.SerializerMethodField()

    class Meta:
        model = EvalRun
        fields = [
            "id", "collection", "status", "started_at", "completed_at",
            "metrics", "error_message", "question_count", "average_scores",
        ]
        read_only_fields = [
            "id", "status", "started_at", "completed_at",
            "metrics", "error_message",
        ]

    def get_question_count(self, obj: EvalRun) -> int:
        return obj.questions.count()

    def get_average_scores(self, obj: EvalRun) -> dict:
        return obj.metrics.get("average_scores", {})


class EvalRunCreateSerializer(serializers.Serializer):
    collection = serializers.UUIDField()
    questions = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=100,
    )

    def validate_questions(self, value: list[dict]) -> list[dict]:
        for i, q in enumerate(value):
            if "question" not in q or not q["question"].strip():
                raise serializers.ValidationError(
                    f"Question at index {i} must have a non-empty 'question' field."
                )
        return value
