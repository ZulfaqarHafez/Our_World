-- ╔══════════════════════════════════════════════════════════╗
-- ║  Our Little World — Supabase Database Schema            ║
-- ║  Run this in the Supabase SQL Editor (Dashboard)        ║
-- ╚══════════════════════════════════════════════════════════╝

-- 0. Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. Dates table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  date        date NOT NULL,
  location    text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  photos      text[] DEFAULT '{}',
  mood        text,
  journal_entry text,
  created_by  uuid REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all dates"
  ON dates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert dates"
  ON dates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can update their own dates"
  ON dates FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Authors can delete their own dates"
  ON dates FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ─── 2. Games table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS games (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id       uuid REFERENCES dates(id) ON DELETE SET NULL,
  game_name     text NOT NULL,
  game_category text NOT NULL CHECK (game_category IN ('Card Game','Board Game','Mobile Game','Video Game','Sport','Other')),
  winner        text NOT NULL CHECK (winner IN ('Zul','GF','Draw')),
  score_zul     int,
  score_gf      int,
  notes         text,
  played_at     date NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all games"
  ON games FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert games"
  ON games FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update games"
  ON games FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete games"
  ON games FOR DELETE TO authenticated USING (true);

-- ─── 3. Journal entries table ────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id    uuid REFERENCES dates(id) ON DELETE CASCADE NOT NULL,
  author_id  uuid REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  content    text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all journal entries"
  ON journal_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authors can insert journal entries"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own entries"
  ON journal_entries FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own entries"
  ON journal_entries FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- ─── 4. Documents table (RAG) ───────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    text NOT NULL,
  file_path   text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  module_name text NOT NULL DEFAULT 'General',
  uploaded_at timestamptz DEFAULT now(),
  status      text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','error')),
  chunk_count int NOT NULL DEFAULT 0
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read documents"
  ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update documents"
  ON documents FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete documents"
  ON documents FOR DELETE TO authenticated USING (true);

-- ─── 5. Document chunks table (RAG vectors) ─────────────────

CREATE TABLE IF NOT EXISTS document_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content      text NOT NULL,
  embedding    vector(1536),   -- text-embedding-3-small outputs 1536 dims
  chunk_index  int NOT NULL DEFAULT 0
);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chunks"
  ON document_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chunks"
  ON document_chunks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chunks"
  ON document_chunks FOR DELETE TO authenticated USING (true);

-- Index for fast cosine-similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── 6. API usage table (rate limiting) ─────────────────────

CREATE TABLE IF NOT EXISTS api_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) NOT NULL,
  query_count int NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
  window_date date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (user_id, window_date)
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own usage"
  ON api_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Server can upsert usage"
  ON api_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Server can update usage"
  ON api_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ─── 7. match_documents RPC (cosine similarity search) ──────

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_document_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    (filter_document_id IS NULL OR dc.document_id = filter_document_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── 8. Storage buckets ─────────────────────────────────────
-- NOTE: Create these buckets manually in Supabase Dashboard → Storage:
--   1. "couple-photos"   — set to PRIVATE
--   2. "lecture-materials" — set to PRIVATE
--
-- Then add these storage policies in Supabase Dashboard → Storage → Policies:
--
-- For BOTH buckets:
--   SELECT (download): auth.role() = 'authenticated'
--   INSERT (upload):   auth.role() = 'authenticated'
--   DELETE:            auth.role() = 'authenticated'

-- ─── Done! ────────────────────────────────────────────────────
