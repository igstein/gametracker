-- Focus weeks: one row per focus week a user sets (kept as history).
-- The active focus week is the newest row with cleared_at IS NULL and set_at within the last 7 days.

CREATE TABLE IF NOT EXISTS focus_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    game_ids UUID[] NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Set when the user resets the focus week early
    cleared_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS focus_weeks_user_set_at_idx ON focus_weeks (user_id, set_at DESC);

ALTER TABLE focus_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own focus weeks" ON focus_weeks;
CREATE POLICY "Users manage own focus weeks" ON focus_weeks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime so a focus week set on one device shows up on the others
ALTER PUBLICATION supabase_realtime ADD TABLE focus_weeks;
