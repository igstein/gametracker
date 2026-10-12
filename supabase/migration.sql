-- GameTracker database schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard > SQL Editor)

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    hltb_id INTEGER,
    cover_image_url TEXT,

    -- HLTB data
    main_story_hours DECIMAL,
    main_plus_extras_hours DECIMAL,
    completionist_hours DECIMAL,

    -- Custom target override (if set, used instead of the HLTB-based target)
    custom_target_hours DECIMAL,

    played_hours DECIMAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'backlog'
        CHECK (status IN ('playing', 'backlog', 'finished', 'abandoned', 'wishlist')),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('must_play', 'high', 'medium', 'low')),

    date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_played TIMESTAMPTZ,

    -- Tags (used for filtering and Next Up mood scoring)
    genre TEXT[],
    platform TEXT[],
    devices TEXT[],
    setting TEXT[],

    -- Game guide
    guide_url TEXT,
    guide_text TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Game notes (journal entries)
CREATE TABLE game_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Focus weeks: one row per focus week (history); active = newest, not cleared, set within 7 days
CREATE TABLE focus_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    game_ids UUID[] NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cleared_at TIMESTAMPTZ
);

CREATE INDEX focus_weeks_user_set_at_idx ON focus_weeks (user_id, set_at DESC);

-- Row Level Security: users can only access their own data
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own games" ON games
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE game_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON game_notes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE focus_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own focus weeks" ON focus_weeks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload covers to their own folder
CREATE POLICY "Users upload own covers" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to view covers (public bucket)
CREATE POLICY "Public cover access" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'covers');

-- Allow users to delete their own covers
CREATE POLICY "Users delete own covers" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Enable Realtime for cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE focus_weeks;
