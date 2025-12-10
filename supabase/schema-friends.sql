-- Friends List Database Schema
-- Run this in your Supabase SQL Editor after the main schema

-- Add name column to users table (for displaying friend names when sharing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Friends table (contacts/friends list for sharing plans)
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_phone_number ON friends(phone_number);
CREATE INDEX IF NOT EXISTS idx_friends_linked_user_id ON friends(linked_user_id);

-- Prevent duplicate friends (same user_id and phone_number combination)
-- Only applies when phone_number is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_friends_unique_phone 
  ON friends(user_id, phone_number) 
  WHERE phone_number IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friends table
DROP POLICY IF EXISTS "Users can view own friends" ON friends;
CREATE POLICY "Users can view own friends" ON friends
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage friends" ON friends;
CREATE POLICY "Service role can manage friends" ON friends
  FOR ALL USING (auth.role() = 'service_role');
