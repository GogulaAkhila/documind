export interface Collection {
  id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  collection: string;
  title: string;
  file: string;
  file_type: string;
  page_count: number;
  status: "pending" | "processing" | "ready" | "failed";
  error_message?: string;
  uploaded_at: string;
}

export interface Citation {
  title: string;
  page: number;
  chunk_id: string;
  relevance_score: number;
  section?: string;
  snippet?: string;
  document_title?: string;
  page_number?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: Citation[];
  created_at: string;
}

export interface ChatSession {
  id: string;
  collection: string;
  title: string;
  created_at: string;
  messages: Message[];
}

export interface EvalRun {
  id: string;
  collection: string;
  status: string;
  metrics: EvalMetrics;
  created_at: string;
}

export interface EvalMetrics {
  faithfulness: number;
  answer_relevance: number;
  context_precision: number;
}

export interface EvalQuestion {
  id: string;
  question: string;
  ground_truth: string;
  generated_answer: string;
  scores: EvalMetrics;
}

export type WebSocketMessageType = "token" | "sources" | "done" | "error";

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: string | Citation[] | null;
  error?: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}
