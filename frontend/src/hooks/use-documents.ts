import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useDocumentStore } from "@/stores/document-store";
import type { Document, PaginatedResponse } from "@/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function documentsKey(collectionId: string) {
  return ["documents", collectionId] as const;
}

export function useDocuments(collectionId: string) {
  return useQuery({
    queryKey: documentsKey(collectionId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Document>>(
        `/documents/files/`,
        { params: { collection: collectionId } },
      );
      return data.results;
    },
    enabled: !!collectionId,
    refetchInterval: (query) => {
      const docs = query.state.data;
      const hasProcessing = docs?.some(
        (d) => d.status === "pending" || d.status === "processing",
      );
      return hasProcessing ? 5_000 : false;
    },
  });
}

export function useUploadDocument(collectionId: string) {
  const queryClient = useQueryClient();
  const { startUpload, updateUploadProgress, completeUpload, failUpload } =
    useDocumentStore.getState();

  return useMutation({
    mutationFn: async (files: File[]) => {
      const results: Document[] = [];

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} exceeds the 50 MB file size limit`);
        }
        if (file.type !== "application/pdf") {
          throw new Error(`${file.name} is not a PDF file`);
        }

        startUpload(file.name);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name.replace(/\.pdf$/i, ""));
        formData.append("collection", collectionId);

        const { data } = await api.post<Document>(
          `/documents/files/`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
              const progress = event.total
                ? Math.round((event.loaded / event.total) * 100)
                : 0;
              updateUploadProgress(file.name, progress);
            },
          },
        );

        completeUpload(file.name);
        results.push(data);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(collectionId) });
    },
    onError: (_error, files) => {
      for (const file of files) {
        failUpload(file.name);
      }
    },
  });
}

export function useDeleteDocument(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/documents/files/${documentId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(collectionId) });
    },
  });
}
