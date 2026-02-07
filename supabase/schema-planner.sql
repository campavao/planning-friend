-- Weekly Planner Schema
-- Run this in your Supabase SQL Editor AFTER the main schema

-- Weekly plans table
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Monday of the week
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_plans_user ON weekly_plans(user_id);
CREATE INDEX idx_weekly_plans_week ON weekly_plans(week_start);

-- Plan items - links content to specific days
CREATE TABLE plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  planned_date TIMESTAMP WITH TIME ZONE NOT NULL, -- Actual calendar date/time for this item
  slot_order INTEGER NOT NULL DEFAULT 0, -- For multiple items on same day
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, content_id, planned_date)
);

CREATE INDEX idx_plan_items_plan ON plan_items(plan_id);
CREATE INDEX idx_plan_items_content ON plan_items(content_id);

-- Enable RLS
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own plans" ON weekly_plans
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage plans" ON weekly_plans
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own plan items" ON plan_items
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage plan items" ON plan_items
  FOR ALL USING (auth.role() = 'service_role');

