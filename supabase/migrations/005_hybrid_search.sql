-- ╔══════════════════════════════════════════════════════════╗
-- ║  Hybrid Search + Metadata Migration                     ║
-- ║  Run AFTER 004_rename_gf_to_wendy.sql                   ║
-- ║  Compatible with Supabase free-tier memory limits       ║
-- ╚══════════════════════════════════════════════════════════╝

-- ─── 1. Add metadata columns to document_chunks ─────────────

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS module_name text,
  ADD COLUMN IF NOT EXISTS document_filename text;

-- ─── 2. Backfill metadata from documents table ──────────────

UPDATE document_chunks dc
SET
  module_name = d.module_name,
  document_filename = d.filename
FROM documents d
WHERE dc.document_id = d.id
  AND (dc.module_name IS NULL OR dc.document_filename IS NULL);

-- ─── 3. Hybrid search function ──────────────────────────────
-- NOTE: Full-text search is computed inline (no stored tsvector column)
-- to avoid exceeding Supabase free-tier maintenance_work_mem limits.

CREATE OR REPLACE FUNCTION match_documents_hybrid(
  query_embedding vector(1536),
  query_text text DEFAULT '',
  match_count int DEFAULT 8,
  similarity_threshold float DEFAULT 0.0,
  filter_document_id uuid DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_module text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  similarity float,
  fts_rank float,
  combined_score float,
  module_name text,
  document_filename text
)
LANGUAGE plpgsql
AS $$
DECLARE
  has_fts_query boolean := (query_text IS NOT NULL AND length(trim(query_text)) > 0);
  ts_query tsquery;
BEGIN
  -- Build full-text query if provided
  IF has_fts_query THEN
    ts_query := plainto_tsquery('english', query_text);
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity,
    CASE
      WHEN has_fts_query AND to_tsvector('english', dc.content) @@ ts_query
      THEN ts_rank_cd(to_tsvector('english', dc.content), ts_query)::float
      ELSE 0.0
    END AS fts_rank,
    (
      0.7 * (1 - (dc.embedding <=> query_embedding))::float +
      0.3 * CASE
        WHEN has_fts_query AND to_tsvector('english', dc.content) @@ ts_query
        THEN LEAST(ts_rank_cd(to_tsvector('english', dc.content), ts_query)::float * 10, 1.0)
        ELSE 0.0
      END
    )::float AS combined_score,
    dc.module_name,
    dc.document_filename
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE
    (filter_document_id IS NULL OR dc.document_id = filter_document_id)
    AND (filter_user_id IS NULL OR d.uploaded_by = filter_user_id)
    AND (filter_module IS NULL OR dc.module_name = filter_module)
    AND (1 - (dc.embedding <=> query_embedding))::float >= similarity_threshold
  ORDER BY
    (
      0.7 * (1 - (dc.embedding <=> query_embedding))::float +
      0.3 * CASE
        WHEN has_fts_query AND to_tsvector('english', dc.content) @@ ts_query
        THEN LEAST(ts_rank_cd(to_tsvector('english', dc.content), ts_query)::float * 10, 1.0)
        ELSE 0.0
      END
    ) DESC
  LIMIT match_count;
END;
$$;

-- Keep the old match_documents function for backwards compatibility
