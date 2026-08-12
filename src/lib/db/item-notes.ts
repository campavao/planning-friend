import { createServerClient } from "./client";
import type { ItemNote, ItemNoteWithOccasion } from "./types";

/**
 * Postgres/PostgREST codes for "the migration hasn't been run yet". Reads
 * degrade to empty so an un-migrated deployment still renders the detail page;
 * writes never swallow this — a note that silently vanishes is worse than an
 * error the user can see.
 */
const MISSING_SCHEMA_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "PGRST205", // PostgREST: table not found in schema cache
]);

function isMissingSchema(error: { code?: string } | null): boolean {
  return Boolean(error?.code && MISSING_SCHEMA_CODES.has(error.code));
}

// The occasion is embedded through plan_item_id so a note can say which visit
// it describes. `!inner` is deliberately not used: notes with no occasion are
// still notes.
const NOTE_SELECT = `
  *,
  occasion:plan_item_id (id, planned_date, note_title)
`;

export async function getItemNotes(
  contentId: string,
  userId: string
): Promise<ItemNoteWithOccasion[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("item_notes")
    .select(NOTE_SELECT)
    .eq("content_id", contentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingSchema(error)) {
      console.warn("item_notes not migrated yet, returning no notes");
      return [];
    }
    throw new Error(`Failed to get item notes: ${error.message}`);
  }

  return (data ?? []) as unknown as ItemNoteWithOccasion[];
}

export async function createItemNote(options: {
  contentId: string;
  userId: string;
  body: string;
  rating?: number | null;
  planItemId?: string | null;
}): Promise<ItemNoteWithOccasion> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("item_notes")
    .insert({
      content_id: options.contentId,
      user_id: options.userId,
      body: options.body,
      rating: options.rating ?? null,
      plan_item_id: options.planItemId ?? null,
    })
    .select(NOTE_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create item note: ${error.message}`);
  }

  return data as unknown as ItemNoteWithOccasion;
}

export async function updateItemNote(
  noteId: string,
  updates: { body?: string; rating?: number | null }
): Promise<ItemNoteWithOccasion> {
  const supabase = createServerClient();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.body !== undefined) payload.body = updates.body;
  // Explicit null clears the rating, so `undefined` and `null` differ here.
  if (updates.rating !== undefined) payload.rating = updates.rating;

  const { data, error } = await supabase
    .from("item_notes")
    .update(payload)
    .eq("id", noteId)
    .select(NOTE_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update item note: ${error.message}`);
  }

  return data as unknown as ItemNoteWithOccasion;
}

export async function deleteItemNote(noteId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from("item_notes").delete().eq("id", noteId);

  if (error) {
    throw new Error(`Failed to delete item note: ${error.message}`);
  }
}

export async function getItemNoteById(
  noteId: string
): Promise<ItemNote | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("item_notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) return null;
    throw new Error(`Failed to get item note: ${error.message}`);
  }

  return (data as ItemNote | null) ?? null;
}

/** One row per plan item the reminder cron should consider. */
export interface NoteReminderRow {
  planItemId: string;
  userId: string;
  contentId: string | null;
  contentTitle: string;
  plannedDate: string;
  noteReminderSentAt: string | null;
  hasNoteSincePlanned: boolean;
}

interface RawReminderRow {
  id: string;
  planned_date: string | null;
  content_id: string | null;
  note_reminder_sent_at: string | null;
  content?: { id: string; title: string } | null;
  weekly_plans?: { user_id: string } | null;
}

/**
 * Plan items in the given planned_date range that still have no reminder
 * stamp, with the "was a note already written for this occasion" flag resolved.
 * Eligibility itself is decided by shouldSendNoteReminder — this only gathers
 * the facts, because the per-user delay isn't expressible in one query.
 */
export async function getNoteReminderCandidates(
  fromIso: string,
  toIso: string
): Promise<NoteReminderRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_items")
    .select(
      `
      id,
      planned_date,
      content_id,
      note_reminder_sent_at,
      content:content_id!inner (id, title),
      weekly_plans!inner (user_id)
    `
    )
    .is("note_reminder_sent_at", null)
    .not("content_id", "is", null)
    .gte("planned_date", fromIso)
    .lte("planned_date", toIso)
    .order("planned_date");

  if (error) {
    if (isMissingSchema(error)) {
      throw new Error(
        "note_reminder_sent_at is missing — apply supabase/schema-item-notes.sql"
      );
    }
    throw new Error(`Failed to get note reminder candidates: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawReminderRow[];
  const usable = rows.filter(
    (row): row is RawReminderRow & { planned_date: string } =>
      Boolean(row.planned_date && row.content_id && row.weekly_plans?.user_id)
  );
  if (usable.length === 0) return [];

  const notedItemIds = await getContentIdsWithNoteSince(usable);

  return usable.map((row) => ({
    planItemId: row.id,
    userId: row.weekly_plans!.user_id,
    contentId: row.content_id,
    contentTitle: row.content?.title ?? "your plan",
    plannedDate: row.planned_date,
    noteReminderSentAt: row.note_reminder_sent_at,
    hasNoteSincePlanned: notedItemIds.has(row.id),
  }));
}

/**
 * Which of these occasions already have a note. A note counts when it is tied
 * to the occasion, or when it was written for the same item any time after the
 * occasion — the second case covers a user who wrote the note from the item
 * page rather than from the reminder, and it deliberately ignores notes from
 * earlier visits.
 */
async function getContentIdsWithNoteSince(
  rows: (RawReminderRow & { planned_date: string })[]
): Promise<Set<string>> {
  const supabase = createServerClient();

  const contentIds = Array.from(
    new Set(rows.map((r) => r.content_id).filter((id): id is string => !!id))
  );
  const oldestPlanned = rows.reduce(
    (oldest, r) => (r.planned_date < oldest ? r.planned_date : oldest),
    rows[0].planned_date
  );

  const { data, error } = await supabase
    .from("item_notes")
    .select("content_id, user_id, plan_item_id, created_at")
    .in("content_id", contentIds)
    .gte("created_at", oldestPlanned);

  if (error) {
    if (isMissingSchema(error)) return new Set();
    throw new Error(`Failed to check existing notes: ${error.message}`);
  }

  const notes = (data ?? []) as {
    content_id: string;
    user_id: string;
    plan_item_id: string | null;
    created_at: string;
  }[];

  const noted = new Set<string>();
  for (const row of rows) {
    const userId = row.weekly_plans?.user_id;
    const hit = notes.some(
      (note) =>
        note.plan_item_id === row.id ||
        (note.content_id === row.content_id &&
          note.user_id === userId &&
          note.created_at >= row.planned_date)
    );
    if (hit) noted.add(row.id);
  }
  return noted;
}

/**
 * Stamp the reminder before the push goes out, and only from unstamped — the
 * conditional update is what makes two overlapping cron runs safe. Returns
 * false when another run already claimed this item.
 */
export async function claimNoteReminder(
  planItemId: string,
  sentAt: string = new Date().toISOString()
): Promise<boolean> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_items")
    .update({ note_reminder_sent_at: sentAt })
    .eq("id", planItemId)
    .is("note_reminder_sent_at", null)
    .select("id");

  if (error) {
    throw new Error(`Failed to claim note reminder: ${error.message}`);
  }

  return (data ?? []).length > 0;
}
