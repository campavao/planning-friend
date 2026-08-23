import { z } from "zod";
import {
  MAX_NOTE_REMINDER_DELAY_MINUTES,
  MIN_NOTE_REMINDER_DELAY_MINUTES,
} from "@/lib/note-reminders";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * The whole writable settings surface, in one place. POST /api/settings parses
 * with this instead of destructuring named fields: a hand-listed destructure is
 * how a new setting ends up appearing to save while never reaching the row.
 *
 * Every field is optional so a partial save (just the location, just the
 * toggle) leaves the rest alone — upsertUserSettings drops the undefined keys.
 */
export const updateUserSettingsBodySchema = z.object({
  home_region: z.string().max(200).optional(),
  home_country: z.string().max(200).optional(),
  note_reminders_enabled: z.boolean().optional(),
  note_reminder_delay_minutes: z
    .number()
    .int("Delay must be a whole number of minutes")
    .min(
      MIN_NOTE_REMINDER_DELAY_MINUTES,
      `Delay must be at least ${MIN_NOTE_REMINDER_DELAY_MINUTES} minute`
    )
    .max(
      MAX_NOTE_REMINDER_DELAY_MINUTES,
      `Delay must be at most ${MAX_NOTE_REMINDER_DELAY_MINUTES} minutes`
    )
    .optional(),
  /**
   * An IANA zone name, reported by the browser rather than chosen by hand.
   * Checked against the runtime's own zone data: this ends up in
   * Intl.DateTimeFormat, which throws on a name it does not know, and a throw
   * inside the reminder cron would take out everyone's reminders, not just the
   * one bad row.
   */
  timezone: z
    .string()
    .max(100)
    .refine(isValidTimeZone, "Not a recognised time zone")
    .optional(),
});

export type UpdateUserSettingsBody = z.infer<
  typeof updateUserSettingsBodySchema
>;
