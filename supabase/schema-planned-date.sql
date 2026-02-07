-- Backfill planned_date for plan_items (store as timestamptz)
-- Run this in your Supabase SQL Editor AFTER schema-planner.sql (and schema-quick-notes.sql if used)

-- Add planned_date column if it doesn't exist (timestamptz)
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS planned_date TIMESTAMPTZ;

-- If planned_date is currently a DATE, convert to timestamptz at 7:00 PM local time
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'plan_items'
      AND column_name = 'planned_date'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE plan_items
      ALTER COLUMN planned_date TYPE TIMESTAMPTZ
      USING (planned_date::timestamp + interval '19 hours');
  END IF;
END $$;

-- Backfill planned_date using week_start + day_of_week at 7:00 PM local time
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'plan_items'
      AND column_name = 'day_of_week'
  ) THEN
    UPDATE plan_items AS pi
    SET planned_date = (wp.week_start::timestamp + (pi.day_of_week || ' days')::interval + interval '19 hours')::timestamptz
    FROM weekly_plans AS wp
    WHERE wp.id = pi.plan_id
      AND pi.planned_date IS NULL;
  END IF;
END $$;

-- Ensure planned_date is required now that it's backfilled
ALTER TABLE plan_items ALTER COLUMN planned_date SET NOT NULL;

-- Drop day_of_week now that planned_date is the source of truth
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'plan_items'
      AND column_name = 'day_of_week'
  ) THEN
    ALTER TABLE plan_items DROP COLUMN day_of_week;
  END IF;
END $$;

-- Update unique constraints/indexes to use planned_date
ALTER TABLE plan_items DROP CONSTRAINT IF EXISTS plan_items_plan_id_content_id_day_of_week_key;
ALTER TABLE plan_items DROP CONSTRAINT IF EXISTS plan_items_plan_id_content_id_planned_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS plan_items_unique_content_per_day
  ON plan_items (plan_id, content_id, planned_date)
  WHERE content_id IS NOT NULL;
