-- ╔══════════════════════════════════════════════════════════╗
-- ║  Conversation Persistence Migration                     ║
-- ║  Run AFTER 001 + 002 migrations                         ║
-- ╚══════════════════════════════════════════════════════════╝

-- One conversation per (user, subject). Messages stored as compact JSONB.
-- This avoids per-message rows and keeps reads/writes to O(1).

CREATE TABLE IF NOT EXISTS study_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) NOT NULL,
  module_name text NOT NULL,
  title       text NOT NULL DEFAULT 'New conversation',
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, module_name)
);

ALTER TABLE study_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own conversations"
  ON study_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON study_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON study_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON study_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookup by user + module
CREATE INDEX IF NOT EXISTS idx_study_conversations_user_module
  ON study_conversations (user_id, module_name);
