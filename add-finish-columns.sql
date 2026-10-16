-- Finish celebration: personal rating (1–10), one-line verdict and finish date per game
ALTER TABLE games ADD COLUMN IF NOT EXISTS rating SMALLINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS verdict TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- (Re)create the rating range check, so this also works if an earlier 1–5 version was run
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_rating_check;
ALTER TABLE games ADD CONSTRAINT games_rating_check CHECK (rating BETWEEN 1 AND 10);
