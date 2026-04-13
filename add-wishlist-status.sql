-- Add 'wishlist' to the games status CHECK constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check
  CHECK (status IN ('playing', 'backlog', 'finished', 'abandoned', 'wishlist'));
