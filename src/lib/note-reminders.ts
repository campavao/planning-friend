/**
 * The "how was it?" reminder decision, kept free of Supabase and web-push so
 * the rule itself can be exercised directly. The cron route
 * (src/app/api/cron/note-reminders/route.ts) fetches rows and sends pushes;
 * every judgement about whether a given occasion earns a reminder lives here.
 */

/** Reminders are on unless the user turns them off. */
export const DEFAULT_NOTE_REMINDERS_ENABLED = true;

/** Two hours after the scheduled time — long enough to have finished eating. */
export const DEFAULT_NOTE_REMINDER_DELAY_MINUTES = 120;

/** Matches the CHECK on user_settings.note_reminder_delay_minutes (one week). */
export const MAX_NOTE_REMINDER_DELAY_MINUTES = 7 * 24 * 60;
export const MIN_NOTE_REMINDER_DELAY_MINUTES = 1;

/**
 * How long after becoming due an occasion still deserves a nudge. A cron that
 * was paused for a week — or a user who has just switched reminders on — must
 * not produce a burst of pushes about dinners nobody remembers.
 */
export const NOTE_REMINDER_WINDOW_MINUTES = 24 * 60;

const MS_PER_MINUTE = 60 * 1000;

export interface NoteReminderSettings {
  enabled: boolean;
  delayMinutes: number;
}

/**
 * The user_settings columns are optional here because they genuinely may be
 * absent: a user who never opened Settings has no row, and rows read before
 * schema-item-notes.sql is applied come back without the columns at all.
 */
export interface NoteReminderSettingsRow {
  note_reminders_enabled?: boolean | null;
  note_reminder_delay_minutes?: number | null;
}

export function resolveNoteReminderSettings(
  row: NoteReminderSettingsRow | null | undefined
): NoteReminderSettings {
  const enabled =
    typeof row?.note_reminders_enabled === "boolean"
      ? row.note_reminders_enabled
      : DEFAULT_NOTE_REMINDERS_ENABLED;

  return { enabled, delayMinutes: clampDelayMinutes(row?.note_reminder_delay_minutes) };
}

/**
 * A delay outside the supported range (or not a number at all) falls back to
 * the default rather than to the bound: an out-of-range value means the write
 * path let something through, and silently reminding a week late is worse than
 * reminding on the normal schedule.
 */
export function clampDelayMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_NOTE_REMINDER_DELAY_MINUTES;
  }
  const rounded = Math.round(value);
  if (
    rounded < MIN_NOTE_REMINDER_DELAY_MINUTES ||
    rounded > MAX_NOTE_REMINDER_DELAY_MINUTES
  ) {
    return DEFAULT_NOTE_REMINDER_DELAY_MINUTES;
  }
  return rounded;
}

export interface NoteReminderCandidate {
  planItemId: string;
  /** Quick notes have none — there is no saved item to review. */
  contentId: string | null;
  /** The occasion's scheduled date *and* time, as stored on plan_items. */
  plannedDate: string;
  /** Set once the reminder has gone out; the idempotency guard. */
  noteReminderSentAt?: string | null;
  /**
   * Whether a note already exists for this item dated on or after the
   * occasion. Deliberately not "has any note ever": the whole point of the
   * feature is repeat visits, so last year's review must not suppress this
   * week's nudge.
   */
  hasNoteSincePlanned: boolean;
}

export type NoteReminderSkipReason =
  | "reminders_disabled"
  | "no_content"
  | "invalid_planned_date"
  | "already_sent"
  | "note_already_written"
  | "not_due_yet"
  | "outside_window";

export type NoteReminderDecision =
  | { send: true; dueAt: Date }
  | { send: false; reason: NoteReminderSkipReason; dueAt: Date | null };

/** When the occasion becomes eligible. Null for an unparseable date. */
export function noteReminderDueAt(
  plannedDate: string,
  delayMinutes: number
): Date | null {
  const planned = new Date(plannedDate);
  if (Number.isNaN(planned.getTime())) return null;
  return new Date(planned.getTime() + delayMinutes * MS_PER_MINUTE);
}

/**
 * The single rule. Checks run cheapest-and-most-decisive first so the reason
 * reported for a skip is the one a human would give.
 */
export function shouldSendNoteReminder(
  candidate: NoteReminderCandidate,
  settings: NoteReminderSettings,
  now: Date = new Date()
): NoteReminderDecision {
  if (!settings.enabled) {
    return { send: false, reason: "reminders_disabled", dueAt: null };
  }
  if (!candidate.contentId) {
    return { send: false, reason: "no_content", dueAt: null };
  }

  const dueAt = noteReminderDueAt(candidate.plannedDate, settings.delayMinutes);
  if (!dueAt) {
    return { send: false, reason: "invalid_planned_date", dueAt: null };
  }

  if (candidate.noteReminderSentAt) {
    return { send: false, reason: "already_sent", dueAt };
  }
  if (candidate.hasNoteSincePlanned) {
    return { send: false, reason: "note_already_written", dueAt };
  }

  const elapsedMs = now.getTime() - dueAt.getTime();
  if (elapsedMs < 0) {
    return { send: false, reason: "not_due_yet", dueAt };
  }
  if (elapsedMs > NOTE_REMINDER_WINDOW_MINUTES * MS_PER_MINUTE) {
    return { send: false, reason: "outside_window", dueAt };
  }

  return { send: true, dueAt };
}

/**
 * The planned_date range worth fetching. The delay is per-user and unknown at
 * query time, so the window is widened by the longest delay the settings allow
 * and each row is then judged individually by shouldSendNoteReminder.
 */
export function noteReminderQueryWindow(now: Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  const lookbackMs =
    (NOTE_REMINDER_WINDOW_MINUTES + MAX_NOTE_REMINDER_DELAY_MINUTES) *
    MS_PER_MINUTE;
  return {
    fromIso: new Date(now.getTime() - lookbackMs).toISOString(),
    // Nothing scheduled in the future can be due, whatever the delay.
    toIso: now.toISOString(),
  };
}
