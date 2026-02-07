import { createServerClient } from "./client";
import type {
  Content,
  ContentCategory,
  PlanItem,
  WeeklyPlan,
  WeeklyPlanWithItems,
} from "./types";
import { formatDateString, parseDateString } from "@/lib/utils";

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

export async function getUsagePatterns(
  userId: string
): Promise<Map<number, ContentCategory[]>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_items")
    .select(
      `
      planned_date,
      content:content_id (category)
    `
    )
    .eq("plan_id.user_id", userId);

  if (error) {
    console.error("Failed to get usage patterns:", error);
    return new Map();
  }

  const patterns = new Map<number, ContentCategory[]>();
  for (const item of data || []) {
    const plannedDate = (item as { planned_date?: string }).planned_date;
    if (!plannedDate) continue;
    const planned = new Date(plannedDate);
    if (Number.isNaN(planned.getTime())) continue;
    const day = (planned.getUTCDay() + 6) % 7;
    const contentData = item.content as unknown as {
      category: ContentCategory;
    } | null;
    const category = contentData?.category;
    if (category) {
      const existing = patterns.get(day) || [];
      existing.push(category);
      patterns.set(day, existing);
    }
  }

  return patterns;
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
