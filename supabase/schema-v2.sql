-- Schema V2: Travel, Drinks, User Settings, Plan Sharing
-- Run this in your Supabase SQL Editor

-- Add new content categories to the enum
DO $$
BEGIN
  ALTER TYPE content_category ADD VALUE IF NOT EXISTS 'travel';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TYPE content_category ADD VALUE IF NOT EXISTS 'drink';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- User Settings table (stores home region for travel detection)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_region TEXT, -- e.g., "Chicago, IL" or "New York, USA"
  home_country TEXT, -- e.g., "United States"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage user settings" ON user_settings;
CREATE POLICY "Service role can manage user settings" ON user_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Plan Sharing table
CREATE TABLE IF NOT EXISTS plan_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE, -- Unique code for sharing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, shared_with_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plan_shares_plan_id ON plan_shares(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_shares_shared_with ON plan_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_shares_code ON plan_shares(share_code);

-- Enable Row Level Security
ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_shares
DROP POLICY IF EXISTS "Users can view plan shares" ON plan_shares;
CREATE POLICY "Users can view plan shares" ON plan_shares
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage plan shares" ON plan_shares;
CREATE POLICY "Service role can manage plan shares" ON plan_shares
  FOR ALL USING (auth.role() = 'service_role');

-- Share codes table for pending invitations
CREATE TABLE IF NOT EXISTS share_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_share_invites_code ON share_invites(share_code);
CREATE INDEX IF NOT EXISTS idx_share_invites_plan ON share_invites(plan_id);

-- Enable Row Level Security
ALTER TABLE share_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for share_invites
DROP POLICY IF EXISTS "Users can view share invites" ON share_invites;
CREATE POLICY "Users can view share invites" ON share_invites
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage share invites" ON share_invites;
CREATE POLICY "Service role can manage share invites" ON share_invites
  FOR ALL USING (auth.role() = 'service_role');

-- Function to generate random share codes
CREATE OR REPLACE FUNCTION generate_share_code(length INT DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

