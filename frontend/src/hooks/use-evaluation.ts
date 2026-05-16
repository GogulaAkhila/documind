import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { EvalRun, EvalQuestion, PaginatedResponse } from "@/types";

function evalRunsKey(collectionId: string) {
  return ["eval-runs", collectionId] as const;
}

function evalQuestionsKey(runId: string) {
  return ["eval-questions", runId] as const;
}

export function useEvalRuns(collectionId: string) {
  return useQuery({
    queryKey: evalRunsKey(collectionId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<EvalRun>>(
        `/evaluation/runs/`,
        { params: { collection: collectionId } },
      );
      return data.results;
    },
    enabled: !!collectionId,
  });
}

export function useLatestEvalRun(collectionId: string) {
  return useQuery({
    queryKey: [...evalRunsKey(collectionId), "latest"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<EvalRun>>(
        `/evaluation/runs/`,
        { params: { collection: collectionId, ordering: "-started_at", page_size: 1 } },
      );
      return data.results[0] ?? null;
    },
    enabled: !!collectionId,
  });
}

export function useEvalQuestions(runId: string) {
  return useQuery({
    queryKey: evalQuestionsKey(runId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<EvalQuestion>>(
        `/evaluation/questions/`,
        { params: { eval_run: runId } },
      );
      return data.results;
    },
    enabled: !!runId,
  });
}

export function useTriggerEvaluation(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<EvalRun>(
        `/evaluation/runs/`,
        { collection: collectionId },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evalRunsKey(collectionId) });
    },
  });
}
