-- Smart Suggestions Schema
-- Cache table for AI-curated weekly plan recommendations on empty days.
-- Run this in your Supabase SQL Editor AFTER the planner schema.

CREATE TABLE IF NOT EXISTS weekly_plan_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  payload JSONB NOT NULL,                              -- { "0": [{ contentId, why }], ... }
  candidate_pool JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "0": [contentId, ...], ... } pre-curator top-N for fast manual refresh
  dismissed JSONB NOT NULL DEFAULT '{}'::jsonb,        -- { "0": [contentId, ...], ... }
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_user_week_suggestions UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_suggestions_user_week
  ON weekly_plan_suggestions(user_id, week_start);

ALTER TABLE weekly_plan_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions" ON weekly_plan_suggestions
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage suggestions" ON weekly_plan_suggestions
  FOR ALL USING (auth.role() = 'service_role');

-- Track the source of plan items for analytics (manual vs AI-suggested vs quick note).
ALTER TABLE plan_items
  ADD COLUMN IF NOT EXISTS source TEXT;

UPDATE plan_items SET source = 'manual' WHERE source IS NULL;
