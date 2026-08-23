-- ---------------------------------------------------------------------------
-- user_settings.timezone
-- ---------------------------------------------------------------------------
-- The zone a user's plan is written in.
--
-- plan_items.planned_date holds a calendar day and a wall-clock time parked in
-- the UTC fields of a timestamp — a 7pm dinner is stored as 19:00Z and every
-- view renders it with timeZone: "UTC" so it reads as 7pm wherever you are.
-- That works until something needs a real moment: the note-reminder cron read
-- 19:00Z as an instant, so a "how was dinner?" reminder for a 7pm meal in
-- Chicago came due at 4pm and arrived three hours before the meal.
--
-- IANA name ("America/Chicago"), not an offset, so daylight saving is the
-- runtime's problem rather than ours. Nullable: a user whose browser has not
-- reported one yet falls back to UTC in code, which is the behaviour that was
-- already there.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT;
