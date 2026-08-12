import { createServerClient } from "./client";

/**
 * Resource-ownership checks. The app talks to Supabase with the service-role
 * key, which bypasses Row-Level Security, so these checks are the actual
 * authorization boundary for any route that accepts a resource id from the
 * client. Each returns true only if the resource exists AND belongs to userId.
 */

async function ownsByUserIdColumn(
  table: string,
  id: string,
  userId: string
): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from(table)
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { user_id: string }).user_id === userId;
}

export function userOwnsContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  return ownsByUserIdColumn("content", contentId, userId);
}

export function userOwnsTag(tagId: string, userId: string): Promise<boolean> {
  return ownsByUserIdColumn("tags", tagId, userId);
}

export function userOwnsGiftRecipient(
  recipientId: string,
  userId: string
): Promise<boolean> {
  return ownsByUserIdColumn("gift_recipients", recipientId, userId);
}

export function userOwnsFriend(
  friendId: string,
  userId: string
): Promise<boolean> {
  return ownsByUserIdColumn("friends", friendId, userId);
}

/**
 * plan_items have no direct user_id — ownership flows through the parent
 * weekly_plan.
 */
export async function userOwnsPlanItem(
  itemId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("plan_id")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) return false;
  const planId = (data as { plan_id: string }).plan_id;
  if (!planId) return false;

  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("user_id")
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) return false;
  return (plan as { user_id: string }).user_id === userId;
}

export function userOwnsItemNote(
  noteId: string,
  userId: string
): Promise<boolean> {
  return ownsByUserIdColumn("item_notes", noteId, userId);
}

export async function userOwnsWeeklyPlan(
  planId: string,
  userId: string
): Promise<boolean> {
  return ownsByUserIdColumn("weekly_plans", planId, userId);
}

/**
 * gift_assignments have no direct user_id — ownership flows through the
 * assigned recipient.
 */
export async function userOwnsGiftAssignment(
  assignmentId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("gift_assignments")
    .select("recipient_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) return false;
  const recipientId = (data as { recipient_id: string }).recipient_id;
  if (!recipientId) return false;
  return userOwnsGiftRecipient(recipientId, userId);
}
