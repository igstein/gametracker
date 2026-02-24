-- Update RLS policies to use real authentication

-- Games table
DROP POLICY IF EXISTS "Users manage own games" ON games;
CREATE POLICY "Users manage own games" ON games
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Game notes table
DROP POLICY IF EXISTS "Users manage own notes" ON game_notes;
DROP POLICY IF EXISTS "Users manage own notes temp" ON game_notes;
CREATE POLICY "Users manage own notes" ON game_notes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Re-add foreign key constraint on game_notes.user_id
ALTER TABLE game_notes
ADD CONSTRAINT game_notes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Verify policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('games', 'game_notes')
ORDER BY tablename, policyname;
