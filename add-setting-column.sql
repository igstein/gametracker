-- Add setting column to track thematic universe/franchise (e.g. Fantasy, Sci-Fi, Warhammer 40K)
ALTER TABLE games ADD COLUMN IF NOT EXISTS setting TEXT[];
