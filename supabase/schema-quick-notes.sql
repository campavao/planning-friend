-- Quick Notes for Weekly Planner
-- Run this in your Supabase SQL Editor AFTER schema-planner.sql

-- Make content_id nullable to allow quick notes without linked content
ALTER TABLE plan_items ALTER COLUMN content_id DROP NOT NULL;

-- Add note_title column for quick notes
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS note_title TEXT;

-- Ensure either content_id OR note_title is set (item must have something)
ALTER TABLE plan_items ADD CONSTRAINT plan_item_has_content_or_note 
  CHECK (content_id IS NOT NULL OR note_title IS NOT NULL);

-- Drop the unique constraint that includes content_id since it can now be null
-- and we want to allow multiple notes on the same day
ALTER TABLE plan_items DROP CONSTRAINT IF EXISTS plan_items_plan_id_content_id_day_of_week_key;

-- Add a new unique constraint only for content items (when content_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS plan_items_unique_content_per_day 
  ON plan_items (plan_id, content_id, day_of_week) 
  WHERE content_id IS NOT NULL;

