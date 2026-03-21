-- Add given_at column to gift_assignments table
-- Allows tracking when a gift has been given
ALTER TABLE gift_assignments ADD COLUMN IF NOT EXISTS given_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
