-- Add devices column to track physical hardware (e.g. Odin2, Steam Deck)
-- separate from platform (the game's native platform)
ALTER TABLE games ADD COLUMN IF NOT EXISTS devices TEXT[];
