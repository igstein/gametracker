-- Remove the foreign key constraint on user_id
-- (We'll add it back when we implement proper authentication)
ALTER TABLE game_notes
DROP CONSTRAINT IF EXISTS game_notes_user_id_fkey;

-- Verify it's removed
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'game_notes'::regclass;
