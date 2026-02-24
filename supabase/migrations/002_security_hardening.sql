-- ╔══════════════════════════════════════════════════════════╗
-- ║  Security Hardening Migration                           ║
-- ║  Run AFTER 001_initial_schema.sql                       ║
-- ╚══════════════════════════════════════════════════════════╝

-- ─── 1. Add created_by to games table ───────────────────────

ALTER TABLE games ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- Backfill existing rows (set to NULL if unknown, or a specific user)
-- UPDATE games SET created_by = auth.uid() WHERE created_by IS NULL;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert games" ON games;
DROP POLICY IF EXISTS "Authenticated users can update games" ON games;
DROP POLICY IF EXISTS "Authenticated users can delete games" ON games;

-- New scoped policies for games
CREATE POLICY "Authenticated users can insert games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can update their own games"
  ON games FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Authors can delete their own games"
  ON games FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ─── 2. Scope document policies to owner ────────────────────

DROP POLICY IF EXISTS "Authenticated users can read documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON documents;

CREATE POLICY "Users can read their own documents"
  ON documents FOR SELECT TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);

-- ─── 3. Scope document_chunks policies via document owner ───

DROP POLICY IF EXISTS "Authenticated users can read chunks" ON document_chunks;
DROP POLICY IF EXISTS "Authenticated users can delete chunks" ON document_chunks;

CREATE POLICY "Users can read chunks of their own documents"
  ON document_chunks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_chunks.document_id
      AND d.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete chunks of their own documents"
  ON document_chunks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_chunks.document_id
      AND d.uploaded_by = auth.uid()
    )
  );

-- ─── 4. Fix storage bucket policies ────────────────────────
-- NOTE: Run these in Supabase Dashboard → Storage → Policies
-- or via the Supabase storage API.
--
-- For couple-photos bucket:
--   SELECT (download): (storage.foldername(name))[1] = auth.uid()::text
--   INSERT (upload):   (storage.foldername(name))[1] = auth.uid()::text
--   DELETE:            (storage.foldername(name))[1] = auth.uid()::text
--
-- For lecture-materials bucket:
--   SELECT (download): (storage.foldername(name))[1] = auth.uid()::text
--   INSERT (upload):   (storage.foldername(name))[1] = auth.uid()::text
--   DELETE:            (storage.foldername(name))[1] = auth.uid()::text

-- ─── 5. Update match_documents to filter by user ────────────

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_document_id uuid DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL
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
  JOIN documents d ON d.id = dc.document_id
  WHERE
    (filter_document_id IS NULL OR dc.document_id = filter_document_id)
    AND (filter_user_id IS NULL OR d.uploaded_by = filter_user_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── Done! ────────────────────────────────────────────────────
