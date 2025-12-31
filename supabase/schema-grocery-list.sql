-- Grocery list cache table
-- Stores AI-generated grocery lists for weekly plans to avoid regenerating

CREATE TABLE IF NOT EXISTS grocery_list_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  recipe_ids TEXT[] NOT NULL, -- Array of content IDs used to generate this list
  items JSONB NOT NULL, -- The generated grocery items
  tips TEXT[], -- Shopping tips from AI
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one cached list per user per week
  CONSTRAINT unique_user_week_grocery UNIQUE (user_id, week_start)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grocery_cache_user_week
  ON grocery_list_cache(user_id, week_start);

-- RLS Policies
ALTER TABLE grocery_list_cache ENABLE ROW LEVEL SECURITY;

-- Users can only see their own grocery lists
CREATE POLICY "Users can view own grocery lists"
  ON grocery_list_cache FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own grocery lists
CREATE POLICY "Users can insert own grocery lists"
  ON grocery_list_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own grocery lists
CREATE POLICY "Users can update own grocery lists"
  ON grocery_list_cache FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own grocery lists
CREATE POLICY "Users can delete own grocery lists"
  ON grocery_list_cache FOR DELETE
  USING (user_id = auth.uid());

