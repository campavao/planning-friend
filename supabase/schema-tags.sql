-- Tags System Database Schema
-- Run this in your Supabase SQL Editor

-- Tags table (user-created and AI-suggested tags)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Each user can only have one tag with a given name
  UNIQUE(user_id, name)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Content-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS content_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate tag assignments
  UNIQUE(content_id, tag_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_content_tags_content_id ON content_tags(content_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag_id ON content_tags(tag_id);

-- Enable Row Level Security
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags table
DROP POLICY IF EXISTS "Users can view own tags" ON tags;
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage tags" ON tags;
CREATE POLICY "Service role can manage tags" ON tags
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for content_tags table
DROP POLICY IF EXISTS "Users can view content tags" ON content_tags;
CREATE POLICY "Users can view content tags" ON content_tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage content tags" ON content_tags;
CREATE POLICY "Service role can manage content tags" ON content_tags
  FOR ALL USING (auth.role() = 'service_role');

-- Default tags to seed for new users (optional helper function)
-- These are common tags that can be suggested
CREATE OR REPLACE FUNCTION get_default_tag_names()
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY[
    'quick', 'slow-cooker', 'breakfast', 'lunch', 'dinner', 
    'appetizer', 'dessert', 'snack', 'party', 'date-night',
    'budget', 'splurge', 'vegetarian', 'vegan', 'gluten-free',
    'healthy', 'comfort-food', 'seasonal', 'holiday', 'weeknight',
    'meal-prep', 'one-pot', 'grilling', 'baking', 'no-cook'
  ];
END;
$$ LANGUAGE plpgsql;

