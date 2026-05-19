import { create } from "zustand";
import type { Message, Citation } from "@/types";

interface ChatState {
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingSources: Citation[];
  activeSources: Citation[];

  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  addToken: (token: string) => void;
  setStreamingSources: (sources: Citation[]) => void;
  startStreaming: () => void;
  finishStreaming: () => void;
  setActiveSources: (sources: Citation[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  streamingSources: [],
  activeSources: [],

  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  setMessages: (messages) => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    set({
      messages,
      activeSources: lastAssistant?.sources ?? [],
    });
  },

  addMessage: (message) =>
    set((state) => {
      const newMessages = [...state.messages, message];
      return {
        messages: newMessages,
        activeSources:
          message.role === "assistant" && message.sources.length > 0
            ? message.sources
            : state.activeSources,
      };
    }),

  clearMessages: () =>
    set({
      messages: [],
      isStreaming: false,
      streamingContent: "",
      streamingSources: [],
      activeSources: [],
    }),

  addToken: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  setStreamingSources: (sources) => set({ streamingSources: sources }),

  startStreaming: () =>
    set({ isStreaming: true, streamingContent: "", streamingSources: [] }),

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
        activeSources:
          streamingSources.length > 0 ? streamingSources : get().activeSources,
      });
    } else {
      set({ isStreaming: false });
    }
  },

  setActiveSources: (sources) => set({ activeSources: sources }),
}));
