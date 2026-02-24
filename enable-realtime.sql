-- Enable Realtime for games and game_notes tables

-- Enable Realtime replication for games table
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Enable Realtime replication for game_notes table
ALTER PUBLICATION supabase_realtime ADD TABLE game_notes;

-- Verify Realtime is enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
