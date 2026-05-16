import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Collection, PaginatedResponse } from "@/types";

const COLLECTIONS_KEY = ["collections"] as const;

export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Collection>>("/documents/collections/");
      return data.results;
    },
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: [...COLLECTIONS_KEY, id],
    queryFn: async () => {
      const { data } = await api.get<Collection>(`/documents/collections/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      const { data } = await api.post<Collection>("/documents/collections/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/collections/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    },
  });
}
