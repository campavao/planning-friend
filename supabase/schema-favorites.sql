-- Favorites (starring a saved item)
-- Run this in your Supabase SQL Editor

-- A star is single-user-per-row data and every read path already selects
-- content.*, so the flag lives on the row instead of in a join table.
ALTER TABLE content ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: the only query is "this user's starred items", and starred
-- rows are a small slice of the table, so indexing the FALSE rows is dead
-- weight.
CREATE INDEX IF NOT EXISTS idx_content_user_favorites
  ON content (user_id)
  WHERE is_favorite;
