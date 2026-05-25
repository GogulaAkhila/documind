import { create } from "zustand";
import type { Message, Citation } from "@/types";

export type StreamingPhase = "idle" | "searching" | "reranking" | "generating";

interface SessionStreamState {
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  streamingContent: string;
  streamingSources: Citation[];
}

interface ChatState {
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingPhase: StreamingPhase;
  streamingContent: string;
  streamingSources: Citation[];
  activeSources: Citation[];
  highlightedCitationIndex: number | null;
  sessionStreamStates: Record<string, SessionStreamState>;

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
  suspendSession: () => void;
  restoreSession: (sessionId: string) => void;
}

const IDLE_STREAM_STATE: SessionStreamState = {
  isStreaming: false,
  streamingPhase: "idle",
  streamingContent: "",
  streamingSources: [],
};

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  streamingPhase: "idle",
  streamingContent: "",
  streamingSources: [],
  activeSources: [],
  highlightedCitationIndex: null,
  sessionStreamStates: {},

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
    const { streamingSources, currentSessionId, sessionStreamStates } = get();
    const cleanedStates = { ...sessionStreamStates };
    if (currentSessionId) {
      delete cleanedStates[currentSessionId];
    }

    set({
      isStreaming: false,
      streamingPhase: "idle",
      streamingContent: "",
      streamingSources: [],
      activeSources:
        streamingSources.length > 0 ? streamingSources : get().activeSources,
      sessionStreamStates: cleanedStates,
    });
  },

  setActiveSources: (sources) => set({ activeSources: sources }),
  setHighlightedCitation: (index) => set({ highlightedCitationIndex: index }),
  setStreamingPhase: (phase) => set({ streamingPhase: phase }),

  suspendSession: () => {
    const { currentSessionId, isStreaming, streamingPhase, streamingContent, streamingSources } = get();
    if (!currentSessionId || !isStreaming) return;
    set((state) => ({
      sessionStreamStates: {
        ...state.sessionStreamStates,
        [currentSessionId]: {
          isStreaming,
          streamingPhase,
          streamingContent,
          streamingSources,
        },
      },
      isStreaming: false,
      streamingPhase: "idle",
      streamingContent: "",
      streamingSources: [],
    }));
  },

  restoreSession: (sessionId) => {
    const saved = get().sessionStreamStates[sessionId];
    if (!saved) return;
    set({
      isStreaming: saved.isStreaming,
      streamingPhase: saved.streamingPhase,
      streamingContent: saved.streamingContent,
      streamingSources: saved.streamingSources,
    });
  },
}));
