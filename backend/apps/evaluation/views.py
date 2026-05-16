import logging

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.documents.models import Collection

from .models import EvalQuestion, EvalRun
from .serializers import EvalQuestionSerializer, EvalRunCreateSerializer, EvalRunSerializer
from .tasks import run_evaluation_task

logger = logging.getLogger(__name__)


class EvalRunViewSet(viewsets.ModelViewSet):
    queryset = EvalRun.objects.all()
    serializer_class = EvalRunSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["collection", "status"]
    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        create_serializer = EvalRunCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        collection_id = create_serializer.validated_data["collection"]
        questions_data = create_serializer.validated_data["questions"]

        try:
            collection = Collection.objects.get(id=collection_id)
        except Collection.DoesNotExist:
            return Response(
                {"detail": "Collection not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        eval_run = EvalRun.objects.create(collection=collection)

        eval_questions = [
            EvalQuestion(
                eval_run=eval_run,
                question=q["question"],
                ground_truth=q.get("ground_truth", ""),
            )
            for q in questions_data
        ]
        EvalQuestion.objects.bulk_create(eval_questions)

        run_evaluation_task.delay(str(eval_run.id))

        serializer = self.get_serializer(eval_run)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def questions(self, request, pk=None):
        eval_run = self.get_object()
        questions = eval_run.questions.all()
        serializer = EvalQuestionSerializer(questions, many=True)
        return Response(serializer.data)


class EvalQuestionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EvalQuestion.objects.select_related("eval_run").all()
    serializer_class = EvalQuestionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["eval_run"]
