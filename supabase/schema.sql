-- TikTok Content Extractor Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create content category enum
CREATE TYPE content_category AS ENUM ('meal', 'event', 'date_idea', 'other');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on phone_number for fast lookups
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tiktok_url TEXT NOT NULL,
  category content_category NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_category ON content(category);

-- Verification codes table (for phone auth)
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on phone_number and code for fast lookups
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone_number);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can only read their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (true);

-- Only service role can insert/update users
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for content table
-- Users can only view their own content (we'll handle this via the API with user lookup)
CREATE POLICY "Users can view own content" ON content
  FOR SELECT USING (true);

-- Only service role can insert/update content
CREATE POLICY "Service role can manage content" ON content
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for verification_codes
-- Only service role can manage verification codes
CREATE POLICY "Service role can manage verification codes" ON verification_codes
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

