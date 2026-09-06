-- Quick notes for the gift planner
-- Run this in your Supabase SQL Editor AFTER schema-gifts.sql
--
-- Mirrors schema-quick-notes.sql for plan_items: a gift can be a free-text
-- note ("socks", "that book she mentioned") instead of a saved item.

-- Allow assignments that are not linked to saved content
ALTER TABLE gift_assignments ALTER COLUMN content_id DROP NOT NULL;

-- The note text, when the assignment is a note
ALTER TABLE gift_assignments ADD COLUMN IF NOT EXISTS note_title TEXT;

-- Every assignment must be one or the other
ALTER TABLE gift_assignments DROP CONSTRAINT IF EXISTS gift_assignment_has_content_or_note;
ALTER TABLE gift_assignments ADD CONSTRAINT gift_assignment_has_content_or_note
  CHECK (content_id IS NOT NULL OR note_title IS NOT NULL);

-- The old UNIQUE(recipient_id, content_id) already tolerates NULL content_id
-- (NULLs are distinct), so multiple notes per person work without changes.
