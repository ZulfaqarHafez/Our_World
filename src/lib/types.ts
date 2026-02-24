// ─── Database row types ───────────────────────────────────

export interface DateRow {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  photos: string[];
  mood: string | null;
  journal_entry: string | null;
  created_by: string;
  created_at: string;
}

export interface GameRow {
  id: string;
  date_id: string | null;
  game_name: string;
  game_category: GameCategory;
  winner: "Zul" | "Wendy" | "Draw";
  score_zul: number | null;
  score_gf: number | null;
  notes: string | null;
  played_at: string;
}

export type GameCategory =
  | "Card Game"
  | "Board Game"
  | "Mobile Game"
  | "Video Game"
  | "Sport"
  | "Other";

export interface JournalEntryRow {
  id: string;
  date_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ─── RAG types ────────────────────────────────────────────

export interface DocumentRow {
  id: string;
  filename: string;
  file_path: string;
  uploaded_by: string;
  module_name: string;
  uploaded_at: string;
  status: "processing" | "ready" | "error";
  chunk_count: number;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  chunk_index: number;
}

export interface ApiUsageRow {
  id: string;
  user_id: string;
  query_count: number;
  tokens_used: number;
  cost_usd: number;
  window_date: string;
}

// ─── Chat types ───────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: {
    chunkIndex: number;
    content: string;
    documentName: string;
    similarity?: number;
    combinedScore?: number;
  }[];
  low_confidence?: boolean;
}

// ─── Storage types ────────────────────────────────────────

export interface SignedUrlRequest {
  paths: string[];
}

export interface SignedUrlResponse {
  urls: { path: string; signedUrl: string }[];
}
