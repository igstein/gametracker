-- Add guide columns to the games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS guide_url TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS guide_text TEXT;
