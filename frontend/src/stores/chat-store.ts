import { create } from "zustand";
import type { Message, Citation } from "@/types";

interface ChatState {
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingSources: Citation[];

  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  addToken: (token: string) => void;
  setStreamingSources: (sources: Citation[]) => void;
  startStreaming: () => void;
  finishStreaming: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  streamingSources: [],

  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  clearMessages: () => set({ messages: [], streamingContent: "", streamingSources: [] }),

  addToken: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  setStreamingSources: (sources) => set({ streamingSources: sources }),

  startStreaming: () => set({ isStreaming: true, streamingContent: "", streamingSources: [] }),

  finishStreaming: () => {
    const { streamingContent, streamingSources, messages } = get();
    if (streamingContent) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: streamingContent,
        sources: streamingSources,
        created_at: new Date().toISOString(),
      };
      set({
        messages: [...messages, assistantMessage],
        isStreaming: false,
        streamingContent: "",
        streamingSources: [],
      });
    } else {
      set({ isStreaming: false });
    }
  },
}));
