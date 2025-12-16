-- Push Notification Subscriptions Schema
-- Run this in your Supabase SQL Editor

-- Push subscriptions table (stores browser push subscriptions)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL, -- Public key for encryption
  auth TEXT NOT NULL, -- Auth secret for encryption
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Each user can only have one subscription per endpoint
  UNIQUE(user_id, endpoint)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions table
DROP POLICY IF EXISTS "Users can view own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON push_subscriptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON push_subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

