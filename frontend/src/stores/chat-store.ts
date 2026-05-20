import { create } from "zustand";
import type { Message, Citation } from "@/types";

export type StreamingPhase = "idle" | "searching" | "reranking" | "generating";

interface ChatState {
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  streamingContent: string;
  streamingSources: Citation[];
  activeSources: Citation[];
  highlightedCitationIndex: number | null;

  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  addToken: (token: string) => void;
  setStreamingSources: (sources: Citation[]) => void;
  startStreaming: () => void;
  finishStreaming: () => void;
  setActiveSources: (sources: Citation[]) => void;
  setHighlightedCitation: (index: number | null) => void;
  setStreamingPhase: (phase: StreamingPhase) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  streamingPhase: "idle",
  streamingContent: "",
  streamingSources: [],
  activeSources: [],
  highlightedCitationIndex: null,

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
      streamingPhase: "idle",
      streamingContent: "",
      streamingSources: [],
      activeSources: [],
      highlightedCitationIndex: null,
    }),

  addToken: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  setStreamingSources: (sources) => set({ streamingSources: sources }),

  startStreaming: () =>
    set({
      isStreaming: true,
      streamingPhase: "searching",
      streamingContent: "",
      streamingSources: [],
    }),

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
        streamingPhase: "idle",
        streamingContent: "",
        streamingSources: [],
        activeSources:
          streamingSources.length > 0 ? streamingSources : get().activeSources,
      });
    } else {
      set({ isStreaming: false, streamingPhase: "idle" });
    }
  },

  setActiveSources: (sources) => set({ activeSources: sources }),
  setHighlightedCitation: (index) => set({ highlightedCitationIndex: index }),
  setStreamingPhase: (phase) => set({ streamingPhase: phase }),
}));
