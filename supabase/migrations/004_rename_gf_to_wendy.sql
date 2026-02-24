-- ╔══════════════════════════════════════════════════════════╗
-- ║  Rename GF → Wendy in winner constraint                ║
-- ║  Run AFTER 001 + 002 + 003 migrations                   ║
-- ╚══════════════════════════════════════════════════════════╝

-- Update existing rows
UPDATE games SET winner = 'Wendy' WHERE winner = 'GF';

-- Drop old constraint and add new one
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_winner_check;
ALTER TABLE games ADD CONSTRAINT games_winner_check CHECK (winner IN ('Zul','Wendy','Draw'));
