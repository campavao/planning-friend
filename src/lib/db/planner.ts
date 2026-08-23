import { createServerClient } from "./client";
import type {
  Content,
  ContentCategory,
  ContentWithTags,
  PlanItem,
  Tag,
  WeeklyPlan,
  WeeklyPlanWithItems,
} from "./types";
import { formatDateString, parseDateString } from "@/lib/utils";

export const ELIGIBLE_SUGGESTION_CATEGORIES: ContentCategory[] = [
  "meal",
  "event",
  "date_idea",
  "drink",
];

export interface DecayedHistoryItem {
  contentId: string;
  category: ContentCategory;
  plannedDate: string;
  dayIndex: number;
  weight: number;
  tagIds: string[];
}

export interface DecayedHistory {
  items: DecayedHistoryItem[];
  weeksOfHistory: number;
}

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return formatDateString(d);
}

function getUtcRangeForDates(startDate: string, endDate: string) {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  const startUtc = new Date(
    Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      0,
      0,
      0
    )
  );
  const endUtc = new Date(
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)
  );

  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
  };
}

export async function getOrCreateWeeklyPlan(
  userId: string,
  weekStart: string
): Promise<WeeklyPlan> {
  const supabase = createServerClient();

  const { data: existingPlan, error: findError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (existingPlan) {
    return existingPlan as WeeklyPlan;
  }

  if (findError && findError.code === "PGRST116") {
    const { data: newPlan, error: createError } = await supabase
      .from("weekly_plans")
      .insert({ user_id: userId, week_start: weekStart })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create weekly plan: ${createError.message}`);
    }

    return newPlan as WeeklyPlan;
  }

  throw new Error(`Failed to get weekly plan: ${findError?.message}`);
}

export async function getWeeklyPlan(
  userId: string,
  weekStart: string
): Promise<WeeklyPlan | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get weekly plan: ${error.message}`);
  }

  return data as WeeklyPlan;
}

export async function getWeeklyPlanWithItems(
  userId: string,
  weekStart: string
): Promise<WeeklyPlanWithItems | null> {
  const supabase = createServerClient();

  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (planError && planError.code !== "PGRST116") {
    throw new Error(`Failed to get weekly plan: ${planError.message}`);
  }

  const startDate = parseDateString(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const { startUtc, endUtc } = getUtcRangeForDates(
    weekStart,
    formatDateString(endDate)
  );

  const { data: items, error: itemsError } = await supabase
    .from("plan_items")
    .select(
      `
      *,
      content:content_id (*),
      weekly_plans!inner(user_id)
    `
    )
    .eq("weekly_plans.user_id", userId)
    .gte("planned_date", startUtc)
    .lte("planned_date", endUtc)
    .order("planned_date")
    .order("slot_order");

  if (itemsError) {
    throw new Error(`Failed to get plan items: ${itemsError.message}`);
  }

  return {
    ...(plan || {
      id: `range-${weekStart}`,
      user_id: userId,
      week_start: weekStart,
      created_at: new Date().toISOString(),
    }),
    items: (items || []) as PlanItem[],
  } as WeeklyPlanWithItems;
}

export async function addPlanItem(
  planId: string,
  options: {
    contentId?: string;
    noteTitle?: string;
    notes?: string;
    plannedDate: string;
    source?: "manual" | "ai_suggested" | "quick_note";
  }
): Promise<PlanItem> {
  const supabase = createServerClient();

  if (!options.contentId && !options.noteTitle) {
    throw new Error("Either contentId or noteTitle must be provided");
  }
  if (!options.plannedDate) {
    throw new Error("plannedDate is required");
  }

  const { data: existingItems } = await supabase
    .from("plan_items")
    .select("slot_order")
    .eq("plan_id", planId)
    .order("slot_order", { ascending: false })
    .limit(1);

  const slotOrder = existingItems?.[0]?.slot_order ?? -1;

  const insertData: {
    plan_id: string;
    content_id?: string;
    note_title?: string;
    planned_date: string;
    slot_order: number;
    notes?: string;
    source?: string;
  } = {
    plan_id: planId,
    planned_date: options.plannedDate,
    slot_order: slotOrder + 1,
  };

  if (options.contentId) {
    insertData.content_id = options.contentId;
  }
  if (options.noteTitle) {
    insertData.note_title = options.noteTitle;
  }
  if (options.notes) {
    insertData.notes = options.notes;
  }
  if (options.source) {
    insertData.source = options.source;
  } else {
    insertData.source = options.noteTitle ? "quick_note" : "manual";
  }

  const { data, error } = await supabase
    .from("plan_items")
    .insert(insertData)
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to add plan item: ${error.message}`);
  }

  return data as PlanItem;
}

export async function updatePlanItem(
  itemId: string,
  updates: {
    contentId?: string | null;
    noteTitle?: string | null;
    notes?: string | null;
    plannedDate?: string;
  }
): Promise<PlanItem> {
  const supabase = createServerClient();

  const updateData: {
    content_id?: string | null;
    note_title?: string | null;
    notes?: string | null;
    planned_date?: string;
  } = {};

  if (updates.contentId !== undefined) {
    updateData.content_id = updates.contentId;
  }
  if (updates.noteTitle !== undefined) {
    updateData.note_title = updates.noteTitle;
  }
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }
  if (updates.plannedDate) {
    updateData.planned_date = updates.plannedDate;
  }

  const { data, error } = await supabase
    .from("plan_items")
    .update(updateData)
    .eq("id", itemId)
    .select(
      `
      *,
      content:content_id (*)
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to update plan item: ${error.message}`);
  }

  return data as PlanItem;
}

export async function removePlanItem(itemId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("plan_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw new Error(`Failed to remove plan item: ${error.message}`);
  }
}

const HISTORY_HALF_LIFE_WEEKS = 6;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

interface RawHistoryRow {
  id: string;
  planned_date: string | null;
  content_id: string | null;
  content?: { id: string; category: ContentCategory } | null;
}

function mondayIndexFromIsoDate(value: string): number | null {
  const planned = new Date(value);
  if (Number.isNaN(planned.getTime())) return null;
  return (planned.getUTCDay() + 6) % 7;
}

export async function getDecayedHistory(
  userId: string,
  now: Date = new Date()
): Promise<DecayedHistory> {
  const supabase = createServerClient();

  const ownItemsPromise = supabase
    .from("plan_items")
    .select(
      `
      id,
      planned_date,
      content_id,
      content:content_id (id, category),
      weekly_plans!inner(user_id)
    `
    )
    .eq("weekly_plans.user_id", userId)
    .not("content_id", "is", null);

  const planSharesPromise = supabase
    .from("plan_shares")
    .select("plan_id")
    .eq("shared_with_user_id", userId);

  const itemSharesPromise = supabase
    .from("plan_item_shares")
    .select("plan_item_id")
    .eq("shared_with_user_id", userId);

  const [ownRes, planSharesRes, itemSharesRes] = await Promise.all([
    ownItemsPromise,
    planSharesPromise,
    itemSharesPromise,
  ]);

  if (ownRes.error) {
    console.error("Failed to get own plan history:", ownRes.error);
  }

  const merged = new Map<string, RawHistoryRow>();
  for (const row of (ownRes.data ?? []) as unknown as RawHistoryRow[]) {
    if (row.id) merged.set(row.id, row);
  }

  const sharedPlanIds = (planSharesRes.data ?? []).map(
    (r: { plan_id: string }) => r.plan_id
  );
  if (sharedPlanIds.length > 0) {
    const { data: sharedPlanItems, error: sharedPlanItemsError } =
      await supabase
        .from("plan_items")
        .select(
          `
          id,
          planned_date,
          content_id,
          content:content_id (id, category)
        `
        )
        .in("plan_id", sharedPlanIds)
        .not("content_id", "is", null);
    if (sharedPlanItemsError) {
      console.error(
        "Failed to get shared-plan history:",
        sharedPlanItemsError
      );
    } else {
      for (const row of (sharedPlanItems ?? []) as unknown as RawHistoryRow[]) {
        if (row.id && !merged.has(row.id)) merged.set(row.id, row);
      }
    }
  }

  const sharedItemIds = (itemSharesRes.data ?? []).map(
    (r: { plan_item_id: string }) => r.plan_item_id
  );
  if (sharedItemIds.length > 0) {
    const { data: sharedItems, error: sharedItemsError } = await supabase
      .from("plan_items")
      .select(
        `
        id,
        planned_date,
        content_id,
        content:content_id (id, category)
      `
      )
      .in("id", sharedItemIds)
      .not("content_id", "is", null);
    if (sharedItemsError) {
      console.error("Failed to get item-share history:", sharedItemsError);
    } else {
      for (const row of (sharedItems ?? []) as unknown as RawHistoryRow[]) {
        if (row.id && !merged.has(row.id)) merged.set(row.id, row);
      }
    }
  }

  const contentIds = Array.from(
    new Set(
      Array.from(merged.values())
        .map((r) => r.content_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let tagIdsByContent = new Map<string, string[]>();
  if (contentIds.length > 0) {
    const { data: tagRows } = await supabase
      .from("content_tags")
      .select("content_id, tag_id")
      .in("content_id", contentIds);
    tagIdsByContent = new Map<string, string[]>();
    for (const row of (tagRows ?? []) as { content_id: string; tag_id: string }[]) {
      const existing = tagIdsByContent.get(row.content_id) ?? [];
      existing.push(row.tag_id);
      tagIdsByContent.set(row.content_id, existing);
    }
  }

  const items: DecayedHistoryItem[] = [];
  let oldestMs = Number.POSITIVE_INFINITY;
  const nowMs = now.getTime();

  for (const row of merged.values()) {
    if (!row.planned_date || !row.content_id || !row.content) continue;
    const dayIndex = mondayIndexFromIsoDate(row.planned_date);
    if (dayIndex === null) continue;
    const plannedMs = new Date(row.planned_date).getTime();
    if (Number.isNaN(plannedMs)) continue;
    const weeksOld = Math.max(0, (nowMs - plannedMs) / MS_PER_WEEK);
    const weight = Math.pow(0.5, weeksOld / HISTORY_HALF_LIFE_WEEKS);
    if (plannedMs < oldestMs) oldestMs = plannedMs;
    items.push({
      contentId: row.content_id,
      category: row.content.category,
      plannedDate: row.planned_date,
      dayIndex,
      weight,
      tagIds: tagIdsByContent.get(row.content_id) ?? [],
    });
  }

  const weeksOfHistory =
    items.length === 0
      ? 0
      : Math.max(0, (nowMs - oldestMs) / MS_PER_WEEK);

  return { items, weeksOfHistory };
}

export async function getEligibleContentPool(
  userId: string
): Promise<ContentWithTags[]> {
  const supabase = createServerClient();

  const { data: contentRows, error: contentError } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("category", ELIGIBLE_SUGGESTION_CATEGORIES);

  if (contentError) {
    throw new Error(
      `Failed to get eligible content pool: ${contentError.message}`
    );
  }

  const content = (contentRows ?? []) as Content[];
  if (content.length === 0) return [];

  const contentIds = content.map((c) => c.id);
  const { data: tagRows, error: tagsError } = await supabase
    .from("content_tags")
    .select(
      `
      content_id,
      tag:tag_id (*)
    `
    )
    .in("content_id", contentIds);

  if (tagsError) {
    throw new Error(`Failed to get content tags: ${tagsError.message}`);
  }

  const tagsByContent = new Map<string, Tag[]>();
  for (const row of (tagRows ?? []) as unknown as {
    content_id: string;
    tag: Tag | null;
  }[]) {
    if (!row.tag) continue;
    const existing = tagsByContent.get(row.content_id) ?? [];
    existing.push(row.tag);
    tagsByContent.set(row.content_id, existing);
  }

  return content.map((c) => ({
    ...c,
    tags: tagsByContent.get(c.id) ?? [],
  }));
}

export interface PlanItemSearchResult {
  id: string;
  planned_date: string;
  title: string;
  category: ContentCategory | null;
  thumbnail_url: string | null;
  is_note: boolean;
  content_id: string | null;
  /** Set when the item was shared with the user by a friend */
  owner_name?: string;
}

interface PlanItemSearchRow {
  id: string;
  planned_date: string | null;
  note_title: string | null;
  content?: {
    id: string;
    title: string;
    category: ContentCategory;
    thumbnail_url: string | null;
  } | null;
}

/**
 * Search a user's planned items (quick notes and scheduled content like
 * meals or events) by title. Results are ordered newest-first.
 */
export async function searchPlanItems(
  userId: string,
  query: string,
  limit: number = 20
): Promise<PlanItemSearchResult[]> {
  const supabase = createServerClient();
  const sanitized = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const pattern = `%${sanitized}%`;

  const noteMatchesPromise = supabase
    .from("plan_items")
    .select(
      `
      id,
      planned_date,
      note_title,
      weekly_plans!inner(user_id)
    `
    )
    .eq("weekly_plans.user_id", userId)
    .ilike("note_title", pattern)
    .not("planned_date", "is", null)
    .order("planned_date", { ascending: false })
    .limit(limit);

  const contentMatchesPromise = supabase
    .from("plan_items")
    .select(
      `
      id,
      planned_date,
      note_title,
      content:content_id!inner(id, title, category, thumbnail_url),
      weekly_plans!inner(user_id)
    `
    )
    .eq("weekly_plans.user_id", userId)
    .ilike("content.title", pattern)
    .not("planned_date", "is", null)
    .order("planned_date", { ascending: false })
    .limit(limit);

  const [noteRes, contentRes] = await Promise.all([
    noteMatchesPromise,
    contentMatchesPromise,
  ]);

  if (noteRes.error) {
    throw new Error(`Failed to search plan notes: ${noteRes.error.message}`);
  }
  if (contentRes.error) {
    throw new Error(`Failed to search plan items: ${contentRes.error.message}`);
  }

  const merged = new Map<string, PlanItemSearchRow>();
  for (const row of (noteRes.data ?? []) as unknown as PlanItemSearchRow[]) {
    merged.set(row.id, row);
  }
  for (const row of (contentRes.data ?? []) as unknown as PlanItemSearchRow[]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }

  return Array.from(merged.values())
    .filter((row): row is PlanItemSearchRow & { planned_date: string } =>
      Boolean(row.planned_date)
    )
    .map((row) => ({
      id: row.id,
      planned_date: row.planned_date,
      title: row.content?.title ?? row.note_title ?? "Untitled",
      category: row.content?.category ?? null,
      thumbnail_url: row.content?.thumbnail_url ?? null,
      is_note: !row.content,
      content_id: row.content?.id ?? null,
    }))
    .sort((a, b) => b.planned_date.localeCompare(a.planned_date))
    .slice(0, limit);
}

interface SharedSearchRow {
  plan_items: {
    id: string;
    planned_date: string | null;
    note_title: string | null;
    content: {
      id: string;
      title: string;
      category: ContentCategory;
      thumbnail_url: string | null;
    } | null;
  } | null;
  users: { name?: string | null; phone_number?: string | null } | null;
}

/**
 * Search items friends have shared with this user. Item shares are few
 * per user, so we fetch them all and match titles in JS rather than
 * fighting nested PostgREST OR-filters.
 */
export async function searchSharedPlanItems(
  userId: string,
  query: string,
  limit: number = 20
): Promise<PlanItemSearchResult[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_item_shares")
    .select(
      `
      plan_items!inner (
        id,
        planned_date,
        note_title,
        content:content_id (id, title, category, thumbnail_url)
      ),
      users!plan_item_shares_owner_user_id_fkey (name, phone_number)
    `
    )
    .eq("shared_with_user_id", userId);

  if (error) {
    throw new Error(`Failed to search shared items: ${error.message}`);
  }

  const lowered = query.toLowerCase();
  const results: PlanItemSearchResult[] = [];
  for (const row of (data ?? []) as unknown as SharedSearchRow[]) {
    const item = row.plan_items;
    if (!item?.planned_date) continue;
    const title = item.content?.title ?? item.note_title ?? "";
    if (!title.toLowerCase().includes(lowered)) continue;
    results.push({
      id: item.id,
      planned_date: item.planned_date,
      title: title || "Untitled",
      category: item.content?.category ?? null,
      thumbnail_url: item.content?.thumbnail_url ?? null,
      is_note: !item.content,
      content_id: item.content?.id ?? null,
      owner_name:
        row.users?.name || row.users?.phone_number?.slice(-4) || "Friend",
    });
  }

  return results
    .sort((a, b) => b.planned_date.localeCompare(a.planned_date))
    .slice(0, limit);
}

/**
 * Search the user's saved event content by title. Used to surface
 * auto-injected events (dated events that were never materialized into
 * plan items) in planner search; the caller parses each event's date.
 */
export async function searchDatedEventContent(
  userId: string,
  query: string,
  limit: number = 20
): Promise<Content[]> {
  const supabase = createServerClient();
  const sanitized = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);

  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("category", "event")
    .ilike("title", `%${sanitized}%`)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search event content: ${error.message}`);
  }

  return (data ?? []) as Content[];
}

export async function getPastWeeklyPlans(
  userId: string,
  limit: number = 4
): Promise<WeeklyPlan[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get past plans: ${error.message}`);
  }

  return data as WeeklyPlan[];
}

/**
 * Every date one content item has been planned for, by this user.
 *
 * Scoped to the caller's own plans through the weekly_plans join rather than
 * filtering afterwards: a shared item appears in a friend's week too, and
 * "you had this 3 times" must mean times *you* had it.
 *
 * Returns raw ISO strings and leaves the interpretation to
 * summarisePlanHistory — past versus future, frequency, weekday pattern — so
 * the judgement about what is worth claiming stays in one testable place.
 */
export async function getPlanHistoryForContent(
  userId: string,
  contentId: string
): Promise<string[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_items")
    .select("planned_date, weekly_plans!inner(user_id)")
    .eq("weekly_plans.user_id", userId)
    .eq("content_id", contentId)
    .not("planned_date", "is", null)
    .order("planned_date");

  if (error) {
    throw new Error(`Failed to get plan history: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (row as { planned_date: string | null }).planned_date)
    .filter((value): value is string => Boolean(value));
}

/**
 * Quick note titles this user has planned before, most recent first.
 *
 * "Leftovers", "Dinner at mum's", "Eating out" recur constantly and are retyped
 * every time, because the add-item search only ever looked at saved content
 * (PLA-43). Offering them back turns a repeated typing job into a tap.
 *
 * Deduplicated case-insensitively, keeping the earliest-seen spelling, so
 * "leftovers" and "Leftovers" do not both appear — they are the same note as
 * far as the person typing is concerned.
 */
export async function getRecentQuickNotes(
  userId: string,
  limit = 40
): Promise<string[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_items")
    .select("note_title, planned_date, weekly_plans!inner(user_id)")
    .eq("weekly_plans.user_id", userId)
    .is("content_id", null)
    .not("note_title", "is", null)
    .order("planned_date", { ascending: false })
    .limit(limit * 4);

  if (error) {
    console.error("Failed to get recent quick notes:", error);
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of (data ?? []) as { note_title: string | null }[]) {
    const title = row.note_title?.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * Average rating per content item, from the notes the owner wrote after the
 * fact (PLA-9).
 *
 * This is the only signal in the engine that is an actual verdict. Everything
 * else infers preference from behaviour — what got planned, what got saved
 * recently — where a rating is the user saying outright whether the thing was
 * any good. An item rated 2 should stop being suggested long past the ordinary
 * cooldown, and one rated 5 should come back.
 *
 * Averaged rather than last-wins: repeat visits are exactly where ratings come
 * from, and a single bad night should not erase four good ones.
 */
export async function getContentRatings(
  userId: string
): Promise<Map<string, number>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("item_notes")
    .select("content_id, rating")
    .eq("user_id", userId)
    .not("rating", "is", null);

  if (error) {
    // A missing rating signal degrades ranking; it must not fail the week.
    console.error("Failed to get content ratings:", error);
    return new Map();
  }

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of (data ?? []) as {
    content_id: string | null;
    rating: number | null;
  }[]) {
    if (!row.content_id || typeof row.rating !== "number") continue;
    const entry = totals.get(row.content_id) ?? { sum: 0, count: 0 };
    entry.sum += row.rating;
    entry.count += 1;
    totals.set(row.content_id, entry);
  }

  const averages = new Map<string, number>();
  for (const [contentId, { sum, count }] of totals) {
    averages.set(contentId, sum / count);
  }
  return averages;
}
