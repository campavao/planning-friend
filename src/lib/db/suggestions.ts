import { createServerClient } from "./client";

export interface SuggestionPick {
  contentId: string;
  why: string | null;
}

export type SuggestionPayload = Record<number, SuggestionPick[]>;
export type CandidatePool = Record<number, string[]>;
export type DismissalMap = Record<number, string[]>;

export interface SuggestionCacheRow {
  id: string;
  user_id: string;
  week_start: string;
  payload: SuggestionPayload;
  candidate_pool: CandidatePool;
  dismissed: DismissalMap;
  generated_at: string;
  expires_at: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCached(
  userId: string,
  weekStart: string,
  now: Date = new Date()
): Promise<SuggestionCacheRow | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("weekly_plan_suggestions")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Failed to read suggestion cache:", error);
    return null;
  }

  const row = data as SuggestionCacheRow;
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    return null;
  }
  return row;
}

export async function upsertCache(args: {
  userId: string;
  weekStart: string;
  payload: SuggestionPayload;
  candidatePool: CandidatePool;
  dismissed?: DismissalMap;
  ttlMs?: number;
  now?: Date;
}): Promise<SuggestionCacheRow> {
  const supabase = createServerClient();
  const now = args.now ?? new Date();
  const ttlMs = args.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  const { data, error } = await supabase
    .from("weekly_plan_suggestions")
    .upsert(
      {
        user_id: args.userId,
        week_start: args.weekStart,
        payload: args.payload,
        candidate_pool: args.candidatePool,
        dismissed: args.dismissed ?? {},
        generated_at: now.toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "user_id,week_start" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert suggestion cache: ${error.message}`);
  }
  return data as SuggestionCacheRow;
}

export async function clearDayInCache(
  userId: string,
  weekStart: string,
  dayIndex: number
): Promise<void> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("weekly_plan_suggestions")
    .select("payload")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (error) {
    if (error.code === "PGRST116") return;
    console.error("Failed to clear day in cache:", error);
    return;
  }
  const payload = (data?.payload ?? {}) as SuggestionPayload;
  if (!(dayIndex in payload)) return;
  const next: SuggestionPayload = { ...payload };
  delete next[dayIndex];

  const { error: updateError } = await supabase
    .from("weekly_plan_suggestions")
    .update({ payload: next })
    .eq("user_id", userId)
    .eq("week_start", weekStart);
  if (updateError) {
    console.error("Failed to write cleared day to cache:", updateError);
  }
}

export async function addDismissal(
  userId: string,
  weekStart: string,
  dayIndex: number,
  contentId: string
): Promise<void> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("weekly_plan_suggestions")
    .select("payload, dismissed")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  if (error) {
    if (error.code === "PGRST116") return;
    console.error("Failed to read cache for dismissal:", error);
    return;
  }

  const payload = (data?.payload ?? {}) as SuggestionPayload;
  const dismissed = (data?.dismissed ?? {}) as DismissalMap;

  const dayPicks = payload[dayIndex] ?? [];
  const remaining = dayPicks.filter((p) => p.contentId !== contentId);
  const nextPayload: SuggestionPayload = { ...payload, [dayIndex]: remaining };

  const dayDismissed = new Set(dismissed[dayIndex] ?? []);
  dayDismissed.add(contentId);
  const nextDismissed: DismissalMap = {
    ...dismissed,
    [dayIndex]: Array.from(dayDismissed),
  };

  const { error: updateError } = await supabase
    .from("weekly_plan_suggestions")
    .update({ payload: nextPayload, dismissed: nextDismissed })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (updateError) {
    console.error("Failed to persist dismissal:", updateError);
  }
}

export async function bustCacheForWeek(
  userId: string,
  weekStart: string
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("weekly_plan_suggestions")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", weekStart);
  if (error) {
    console.error("Failed to bust cache for week:", error);
  }
}

/**
 * Bust the cache for the owner of a plan item plus everyone it's shared with,
 * across all the week_starts the item touches (e.g., old + new on a cross-week move).
 */
export async function bustForPlanItem(args: {
  planItemId: string;
  weekStarts: string[];
}): Promise<void> {
  const { planItemId, weekStarts } = args;
  const supabase = createServerClient();

  const { data: itemRow, error: itemError } = await supabase
    .from("plan_items")
    .select("plan_id, weekly_plans!inner(user_id)")
    .eq("id", planItemId)
    .single();
  if (itemError || !itemRow) {
    if (itemError && itemError.code !== "PGRST116") {
      console.error("Failed to load plan item for cache bust:", itemError);
    }
    return;
  }

  const planId = (itemRow as { plan_id: string }).plan_id;
  const ownerId = (
    itemRow as { weekly_plans: { user_id: string } | { user_id: string }[] }
  ).weekly_plans;
  const ownerUserId = Array.isArray(ownerId) ? ownerId[0]?.user_id : ownerId?.user_id;

  const stakeholderIds = new Set<string>();
  if (ownerUserId) stakeholderIds.add(ownerUserId);

  const [planShares, itemShares] = await Promise.all([
    supabase
      .from("plan_shares")
      .select("shared_with_user_id")
      .eq("plan_id", planId),
    supabase
      .from("plan_item_shares")
      .select("shared_with_user_id")
      .eq("plan_item_id", planItemId),
  ]);

  for (const s of (planShares.data ?? []) as { shared_with_user_id: string }[]) {
    stakeholderIds.add(s.shared_with_user_id);
  }
  for (const s of (itemShares.data ?? []) as { shared_with_user_id: string }[]) {
    stakeholderIds.add(s.shared_with_user_id);
  }

  await Promise.all(
    Array.from(stakeholderIds).flatMap((uid) =>
      weekStarts.map((ws) => bustCacheForWeek(uid, ws))
    )
  );
}

export async function bustAllUserWeeks(
  userId: string,
  fromWeekStart?: string
): Promise<void> {
  const supabase = createServerClient();
  let q = supabase
    .from("weekly_plan_suggestions")
    .delete()
    .eq("user_id", userId);
  if (fromWeekStart) q = q.gte("week_start", fromWeekStart);
  const { error } = await q;
  if (error) {
    console.error("Failed to bust all user weeks:", error);
  }
}
