-- Plan Item Shares Database Schema
-- Run this in your Supabase SQL Editor after the planner schema
-- This enables sharing individual plan items with friends

-- Plan Item Shares - share individual items with friends
CREATE TABLE IF NOT EXISTS plan_item_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_item_id UUID NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_item_id, shared_with_user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_plan_item_shares_item ON plan_item_shares(plan_item_id);
CREATE INDEX IF NOT EXISTS idx_plan_item_shares_shared_with ON plan_item_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_item_shares_owner ON plan_item_shares(owner_user_id);

-- Enable Row Level Security
ALTER TABLE plan_item_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_item_shares
DROP POLICY IF EXISTS "Users can view plan item shares" ON plan_item_shares;
CREATE POLICY "Users can view plan item shares" ON plan_item_shares
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage plan item shares" ON plan_item_shares;
CREATE POLICY "Service role can manage plan item shares" ON plan_item_shares
  FOR ALL USING (auth.role() = 'service_role');
