-- Item notes and the post-event note reminder (PLA-6)
-- Run this in your Supabase SQL Editor. Safe to re-run.
--
-- Three pieces, all needed together:
--   1. item_notes — how a thing actually went, written after the fact.
--   2. plan_items.note_reminder_sent_at — idempotency for the reminder cron.
--   3. user_settings note-reminder preferences.

-- ---------------------------------------------------------------------------
-- 1. item_notes
-- ---------------------------------------------------------------------------
-- Many rows per (user, content) on purpose. The value is in reflecting across
-- repeat visits — "better than last time", "skip the app next time" — so this
-- is deliberately not a single review column on `content`.
CREATE TABLE IF NOT EXISTS item_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  -- Optional: a note is worth keeping even when the writer doesn't want to
  -- score it. 1-5 when present. This is the negative preference signal the
  -- suggestion rework (PLA-9) needs — stars only ever say "yes".
  rating SMALLINT CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  -- The occasion the note came from, when there was one. ON DELETE SET NULL,
  -- not CASCADE: removing a past plan item must not erase the review of it.
  plan_item_id UUID REFERENCES plan_items(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- The only list query is "this user's notes on this item, newest first".
CREATE INDEX IF NOT EXISTS idx_item_notes_user_content
  ON item_notes (user_id, content_id);

-- Row Level Security ---------------------------------------------------------
-- Service-role only, and nothing else. `auth.uid()` is always NULL in this app
-- — sessions are HMAC-signed cookies (src/lib/auth.ts), not Supabase Auth — so
-- a user-facing policy built on it would match zero rows while still widening
-- the surface. Every real read/write goes through createServerClient() with the
-- service role key and is authorized in the API route. See
-- supabase/schema-rls-hardening.sql for why `USING (true)` must never come back.
ALTER TABLE item_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage item notes" ON item_notes;
CREATE POLICY "Service role can manage item notes" ON item_notes
  FOR ALL USING (auth.role() = 'service_role');

-- Defense in depth: notes are the most personal rows in the database, so they
-- are unreachable through the Data API even if a permissive policy is ever
-- reintroduced by accident.
REVOKE SELECT, INSERT, UPDATE, DELETE ON item_notes FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reminder idempotency
-- ---------------------------------------------------------------------------
-- Stamped when the cron sends the "how was it?" push. Without it, two cron
-- runs over the same window notify twice.
ALTER TABLE plan_items
  ADD COLUMN IF NOT EXISTS note_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Partial index matching the cron's query exactly: unsent reminders for items
-- that point at a saved item (quick notes have nothing to review). Sent rows
-- are the permanent majority, so indexing them is dead weight.
CREATE INDEX IF NOT EXISTS idx_plan_items_note_reminder_pending
  ON plan_items (planned_date)
  WHERE note_reminder_sent_at IS NULL AND content_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Reminder preferences
-- ---------------------------------------------------------------------------
-- Default on. Users who have never opened Settings have no user_settings row
-- at all, so the same defaults are also applied in code
-- (resolveNoteReminderSettings in src/lib/note-reminders.ts).
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS note_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS note_reminder_delay_minutes INT NOT NULL DEFAULT 120;

-- ADD CONSTRAINT has no IF NOT EXISTS, so guard it to keep this file re-runnable.
DO $$
BEGIN
  ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_note_reminder_delay_range
    CHECK (note_reminder_delay_minutes BETWEEN 1 AND 10080);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
