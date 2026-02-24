-- Clean up old data created with the temp user ID
-- Run this BEFORE running update-rls-for-auth.sql

-- Delete all game notes created with temp user ID
DELETE FROM game_notes
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Delete all games created with temp user ID
DELETE FROM games
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Verify cleanup
SELECT COUNT(*) as remaining_temp_games FROM games WHERE user_id = '00000000-0000-0000-0000-000000000000';
SELECT COUNT(*) as remaining_temp_notes FROM game_notes WHERE user_id = '00000000-0000-0000-0000-000000000000';
