import { create } from "zustand";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "complete" | "error";
}

interface DocumentState {
  uploads: Map<string, UploadProgress>;
  selectedDocumentId: string | null;

  setSelectedDocument: (id: string | null) => void;
  startUpload: (fileName: string) => void;
  updateUploadProgress: (fileName: string, progress: number) => void;
  completeUpload: (fileName: string) => void;
  failUpload: (fileName: string) => void;
  removeUpload: (fileName: string) => void;
  clearUploads: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  uploads: new Map(),
  selectedDocumentId: null,

  setSelectedDocument: (id) => set({ selectedDocumentId: id }),

  startUpload: (fileName) =>
    set((state) => {
      const uploads = new Map(state.uploads);
      uploads.set(fileName, { fileName, progress: 0, status: "uploading" });
      return { uploads };
    }),

  updateUploadProgress: (fileName, progress) =>
    set((state) => {
      const uploads = new Map(state.uploads);
      const existing = uploads.get(fileName);
      if (existing) {
        uploads.set(fileName, { ...existing, progress });
      }
      return { uploads };
    }),

  completeUpload: (fileName) =>
    set((state) => {
      const uploads = new Map(state.uploads);
      const existing = uploads.get(fileName);
      if (existing) {
        uploads.set(fileName, { ...existing, progress: 100, status: "complete" });
      }
      return { uploads };
    }),

  failUpload: (fileName) =>
    set((state) => {
      const uploads = new Map(state.uploads);
      const existing = uploads.get(fileName);
      if (existing) {
        uploads.set(fileName, { ...existing, status: "error" });
      }
      return { uploads };
    }),

  removeUpload: (fileName) =>
    set((state) => {
      const uploads = new Map(state.uploads);
      uploads.delete(fileName);
      return { uploads };
    }),

  clearUploads: () => set({ uploads: new Map() }),
}));
