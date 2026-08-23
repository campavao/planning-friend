import { createServerClient } from "./client";

export interface SuggestionPick {
  contentId: string;
  why: string | null;
}

export type SuggestionPayload = Record<number, SuggestionPick[]>;
export type CandidatePool = Record<number, string[]>;
export type DismissalMap = Record<number, string[]>;

/**
 * Bump whenever a change to the engine makes an already-cached payload wrong —
 * new day-coverage rules, different filtering, a different payload shape.
 *
 * Cached rows outlive deploys (they only expire on their own TTL), so without
 * this a fix to the engine stays invisible for up to a day, per user, per week,
 * and "it works locally" turns into a support ticket. A row stamped with an
 * older version is treated as a miss and recomputed on the next read, so
 * shipping a change never needs a manual DELETE against the table.
 *
 * v1 = the original, unstamped payload (`{ "0": [...] }` at the top level).
 * v2 = every day in the week present, empty days included.
 */
// 3: stars and ratings entered the ranking (PLA-9), so v2 entries would keep
// serving pre-preference orderings until they expired on their own.
export const SUGGESTION_CACHE_VERSION = 3;

/**
 * What actually lives in the `payload` JSONB column. The extra fields ride
 * along in the envelope because the alternative is a migration for two
 * scalars, and they must survive the cache: without them a cache hit could not
 * tell "your library is too small" from "nothing to suggest today".
 */
interface VersionedPayload {
  v: number;
  days: SuggestionPayload;
  poolSize: number;
  emptyPool: boolean;
}

export interface SuggestionCacheRow {
  id: string;
  user_id: string;
  week_start: string;
  /** Unwrapped from the stored envelope — see `readVersionedPayload`. */
  payload: SuggestionPayload;
  candidate_pool: CandidatePool;
  dismissed: DismissalMap;
  generated_at: string;
  expires_at: string;
  /** From the payload envelope, not a column. */
  poolSize: number;
  /** From the payload envelope, not a column. */
  emptyPool: boolean;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function wrapVersionedPayload(args: {
  days: SuggestionPayload;
  poolSize: number;
  emptyPool: boolean;
}): VersionedPayload {
  return {
    v: SUGGESTION_CACHE_VERSION,
    days: args.days,
    poolSize: args.poolSize,
    emptyPool: args.emptyPool,
  };
}

/**
 * Returns null for anything this build should not trust: a payload from an
 * older engine version, or the unstamped v1 shape. Null means "recompute".
 */
export function readVersionedPayload(raw: unknown): VersionedPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Partial<VersionedPayload>;
  if (candidate.v !== SUGGESTION_CACHE_VERSION) return null;
  if (!candidate.days || typeof candidate.days !== "object") return null;
  return {
    v: candidate.v,
    days: candidate.days as SuggestionPayload,
    poolSize: typeof candidate.poolSize === "number" ? candidate.poolSize : 0,
    emptyPool: candidate.emptyPool === true,
  };
}

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

  const row = data as SuggestionCacheRow & { payload: unknown };
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    return null;
  }

  const stored = readVersionedPayload(row.payload);
  if (!stored) {
    console.log(
      "[suggestions] cache miss: stale payload version",
      JSON.stringify({ userId, weekStart, expected: SUGGESTION_CACHE_VERSION })
    );
    return null;
  }

  return {
    ...row,
    payload: stored.days,
    poolSize: stored.poolSize,
    emptyPool: stored.emptyPool,
  };
}

export async function upsertCache(args: {
  userId: string;
  weekStart: string;
  payload: SuggestionPayload;
  candidatePool: CandidatePool;
  dismissed?: DismissalMap;
  poolSize?: number;
  emptyPool?: boolean;
  ttlMs?: number;
  now?: Date;
}): Promise<SuggestionCacheRow> {
  const supabase = createServerClient();
  const now = args.now ?? new Date();
  const ttlMs = args.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const poolSize = args.poolSize ?? 0;
  const emptyPool = args.emptyPool ?? false;

  const { data, error } = await supabase
    .from("weekly_plan_suggestions")
    .upsert(
      {
        user_id: args.userId,
        week_start: args.weekStart,
        payload: wrapVersionedPayload({
          days: args.payload,
          poolSize,
          emptyPool,
        }),
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
  // Hand back the unwrapped view so callers never see the envelope.
  return {
    ...(data as SuggestionCacheRow),
    payload: args.payload,
    poolSize,
    emptyPool,
  };
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
  // A stale-version row is about to be recomputed wholesale, so editing it
  // would only be overwritten. Same for the dismissal path below.
  const stored = readVersionedPayload(data?.payload);
  if (!stored) return;
  if ((stored.days[dayIndex] ?? []).length === 0) return;
  // Cleared, not removed: every day stays present in a v2 payload.
  const next: SuggestionPayload = { ...stored.days, [dayIndex]: [] };

  const { error: updateError } = await supabase
    .from("weekly_plan_suggestions")
    .update({
      payload: wrapVersionedPayload({
        days: next,
        poolSize: stored.poolSize,
        emptyPool: stored.emptyPool,
      }),
    })
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

  const stored = readVersionedPayload(data?.payload);
  const dismissed = (data?.dismissed ?? {}) as DismissalMap;

  const dayDismissed = new Set(dismissed[dayIndex] ?? []);
  dayDismissed.add(contentId);
  const nextDismissed: DismissalMap = {
    ...dismissed,
    [dayIndex]: Array.from(dayDismissed),
  };

  // The dismissal itself always sticks, even against a stale payload — it is
  // user intent, and the recompute reads it back out of this column.
  const update: Record<string, unknown> = { dismissed: nextDismissed };
  if (stored) {
    const dayPicks = stored.days[dayIndex] ?? [];
    update.payload = wrapVersionedPayload({
      days: {
        ...stored.days,
        [dayIndex]: dayPicks.filter((p) => p.contentId !== contentId),
      },
      poolSize: stored.poolSize,
      emptyPool: stored.emptyPool,
    });
  }

  const { error: updateError } = await supabase
    .from("weekly_plan_suggestions")
    .update(update)
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
