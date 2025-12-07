-- Gift Planner Database Schema
-- Run this in your Supabase SQL Editor after the main schema

-- Add gift_idea to the content_category enum
-- Note: If you get an error, the type may already be updated
DO $$
BEGIN
  ALTER TYPE content_category ADD VALUE IF NOT EXISTS 'gift_idea';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Gift Recipients table (people you want to give gifts to)
CREATE TABLE IF NOT EXISTS gift_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_gift_recipients_user_id ON gift_recipients(user_id);

-- Gift Assignments table (which gifts are assigned to which recipients)
-- Same gift can be assigned to multiple people
CREATE TABLE IF NOT EXISTS gift_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES gift_recipients(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate assignments
  UNIQUE(recipient_id, content_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_gift_assignments_recipient_id ON gift_assignments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gift_assignments_content_id ON gift_assignments(content_id);

-- Enable Row Level Security
ALTER TABLE gift_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gift_recipients table
DROP POLICY IF EXISTS "Users can view own recipients" ON gift_recipients;
CREATE POLICY "Users can view own recipients" ON gift_recipients
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage recipients" ON gift_recipients;
CREATE POLICY "Service role can manage recipients" ON gift_recipients
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for gift_assignments table
DROP POLICY IF EXISTS "Users can view assignments" ON gift_assignments;
CREATE POLICY "Users can view assignments" ON gift_assignments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage assignments" ON gift_assignments;
CREATE POLICY "Service role can manage assignments" ON gift_assignments
  FOR ALL USING (auth.role() = 'service_role');

