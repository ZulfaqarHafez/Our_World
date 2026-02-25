-- ╔══════════════════════════════════════════════════════════╗
-- ║  Document Summaries Migration                           ║
-- ║  Run AFTER 005_hybrid_search.sql                        ║
-- ╚══════════════════════════════════════════════════════════╝

-- Add summary column to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS summary text;
