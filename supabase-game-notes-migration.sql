-- Create game_notes table
CREATE TABLE game_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE game_notes ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only manage their own notes
CREATE POLICY "Users manage own notes" ON game_notes
    FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000000');

-- Create index for faster queries
CREATE INDEX idx_game_notes_game_id ON game_notes(game_id);
CREATE INDEX idx_game_notes_user_id ON game_notes(user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_notes_updated_at BEFORE UPDATE ON game_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
