-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users manage own notes" ON game_notes;

-- Create new policy that allows the temp user ID
-- (This will need to be updated when we implement proper authentication)
CREATE POLICY "Users manage own notes" ON game_notes
    FOR ALL
    USING (user_id = '00000000-0000-0000-0000-000000000000')
    WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000');
