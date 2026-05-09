import { createServerClient } from "./client";
import type {
  Content,
  PlanItem,
  PlanShare,
  PlanItemShare,
  ShareInvite,
  SharedPlanDetails,
  SharedPlanItem,
  User,
} from "./types";
import { formatDateString, parseDateString } from "@/lib/utils";

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createShareInvite(
  planId: string,
  ownerUserId: string
): Promise<ShareInvite> {
  const supabase = createServerClient();

  const shareCode = generateShareCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("share_invites")
    .insert({
      plan_id: planId,
      owner_user_id: ownerUserId,
      share_code: shareCode,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create share invite: ${error.message}`);
  }

  return data as ShareInvite;
}

export async function getShareInvite(
  shareCode: string
): Promise<ShareInvite | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("share_invites")
    .select("*")
    .eq("share_code", shareCode)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get share invite: ${error.message}`);
  }

  return data as ShareInvite | null;
}

export async function claimShareInvite(
  shareCode: string,
  userId: string
): Promise<PlanShare> {
  const supabase = createServerClient();

  const invite = await getShareInvite(shareCode);
  if (!invite) {
    throw new Error("Invalid share code");
  }

  if (new Date(invite.expires_at) < new Date()) {
    throw new Error("Share code has expired");
  }

  if (invite.claimed_by_user_id) {
    throw new Error("Share code has already been used");
  }

  if (invite.owner_user_id === userId) {
    throw new Error("You cannot accept your own share invite");
  }

  const { data: shareData, error: shareError } = await supabase
    .from("plan_shares")
    .insert({
      plan_id: invite.plan_id,
      shared_with_user_id: userId,
      share_code: shareCode,
    })
    .select()
    .single();

  if (shareError) {
    if (shareError.code === "23505") {
      throw new Error("You already have access to this plan");
    }
    throw new Error(`Failed to claim share invite: ${shareError.message}`);
  }

  await supabase
    .from("share_invites")
    .update({ claimed_by_user_id: userId })
    .eq("id", invite.id);

  return shareData as PlanShare;
}

export async function getSharedPlans(
  userId: string
): Promise<PlanShare[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_shares")
    .select("*")
    .eq("shared_with_user_id", userId);

  if (error) {
    throw new Error(`Failed to get shared plans: ${error.message}`);
  }

  return data as PlanShare[];
}

export async function getSharedPlansWithDetails(
  userId: string
): Promise<SharedPlanDetails[]> {
  const supabase = createServerClient();

  const { data: planShares, error: sharesError } = await supabase
    .from("plan_shares")
    .select("*")
    .eq("shared_with_user_id", userId);

  if (sharesError) {
    throw new Error(`Failed to get shared plans: ${sharesError.message}`);
  }

  if (!planShares || planShares.length === 0) {
    return [];
  }

  const planIds = planShares.map((ps: PlanShare) => ps.plan_id);

  const { data: plans, error: plansError } = await supabase
    .from("weekly_plans")
    .select("id, user_id, week_start")
    .in("id", planIds);

  if (plansError) {
    throw new Error(`Failed to get plan details: ${plansError.message}`);
  }

  const ownerIds = [
    ...new Set(plans.map((p: { user_id: string }) => p.user_id)),
  ];
  const { data: owners, error: ownersError } = await supabase
    .from("users")
    .select("id, phone_number")
    .in("id", ownerIds);

  if (ownersError) {
    throw new Error(`Failed to get owner details: ${ownersError.message}`);
  }

  const planMap = new Map(
    plans.map((p: { id: string; user_id: string; week_start: string }) => [
      p.id,
      p,
    ])
  );
  const ownerMap = new Map(
    owners.map((o: { id: string; phone_number: string }) => [
      o.id,
      o.phone_number,
    ])
  );

  return planShares.map((share: PlanShare) => {
    const plan = planMap.get(share.plan_id);
    const ownerPhone = plan ? ownerMap.get(plan.user_id) : undefined;
    return {
      ...share,
      owner_phone: ownerPhone || "Unknown",
      week_start: plan?.week_start || "",
    };
  }) as SharedPlanDetails[];
}

export async function getPlanShareInfo(
  planId: string,
  userId: string
): Promise<{ isShared: boolean; sharedWith: string[] }> {
  const supabase = createServerClient();

  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("user_id")
    .eq("id", planId)
    .single();

  if (planError) {
    return { isShared: false, sharedWith: [] };
  }

  if (plan.user_id !== userId) {
    return { isShared: false, sharedWith: [] };
  }

  const { data: shares, error: sharesError } = await supabase
    .from("plan_shares")
    .select("shared_with_user_id")
    .eq("plan_id", planId);

  if (sharesError || !shares) {
    return { isShared: false, sharedWith: [] };
  }

  if (shares.length === 0) {
    return { isShared: false, sharedWith: [] };
  }

  const sharedUserIds = shares.map(
    (s: { shared_with_user_id: string }) => s.shared_with_user_id
  );
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("phone_number")
    .in("id", sharedUserIds);

  if (usersError) {
    return { isShared: true, sharedWith: [] };
  }

  return {
    isShared: true,
    sharedWith: users.map((u: { phone_number: string }) => u.phone_number),
  };
}

export async function removePlanShare(
  planId: string,
  sharedWithUserId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("plan_shares")
    .delete()
    .eq("plan_id", planId)
    .eq("shared_with_user_id", sharedWithUserId);

  if (error) {
    throw new Error(`Failed to remove plan share: ${error.message}`);
  }
}

export async function shareItemWithFriends(
  itemId: string,
  ownerUserId: string,
  friendUserIds: string[]
): Promise<void> {
  const supabase = createServerClient();

  const shares = friendUserIds.map((userId) => ({
    plan_item_id: itemId,
    owner_user_id: ownerUserId,
    shared_with_user_id: userId,
  }));

  const { error } = await supabase
    .from("plan_item_shares")
    .upsert(shares, { onConflict: "plan_item_id,shared_with_user_id" });

  if (error) {
    throw new Error(`Failed to share item: ${error.message}`);
  }
}

export async function unshareItemWithFriends(
  itemId: string,
  friendUserIds: string[]
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("plan_item_shares")
    .delete()
    .eq("plan_item_id", itemId)
    .in("shared_with_user_id", friendUserIds);

  if (error) {
    throw new Error(`Failed to unshare item: ${error.message}`);
  }
}

export async function getSharedItemsForUser(
  userId: string,
  weekStart: string
): Promise<SharedPlanItem[]> {
  const supabase = createServerClient();

  const recipientWeekStart = parseDateString(weekStart);
  const recipientWeekEnd = new Date(recipientWeekStart);
  recipientWeekEnd.setDate(recipientWeekEnd.getDate() + 6);

  const { data: shares, error: sharesError } = await supabase
    .from("plan_item_shares")
    .select(
      `
      id,
      plan_item_id,
      owner_user_id,
      created_at,
      plan_items!inner (
        id,
        plan_id,
        content_id,
        note_title,
        planned_date,
        slot_order,
        notes,
        created_at,
        content (*)
      ),
      users!plan_item_shares_owner_user_id_fkey (
        id,
        name,
        phone_number
      )
    `
    )
    .eq("shared_with_user_id", userId);

  if (sharesError) {
    throw new Error(`Failed to get shared items: ${sharesError.message}`);
  }

  if (!shares || shares.length === 0) {
    return [];
  }

  const sharedItems: SharedPlanItem[] = [];

  for (const share of shares) {
    const planItem = share.plan_items as unknown as PlanItem & {
      content: Content;
    };
    const owner = share.users as unknown as User;

    const parsePlannedDate = (value: string): Date => {
      return value.includes("T") ? new Date(value) : parseDateString(value);
    };

    if (planItem.planned_date) {
      const itemDate = parsePlannedDate(planItem.planned_date);
      const normalizedItemDate = parseDateString(formatDateString(itemDate));

      if (
        normalizedItemDate >= recipientWeekStart &&
        normalizedItemDate <= recipientWeekEnd
      ) {
        sharedItems.push({
          ...planItem,
          owner_user_id: share.owner_user_id,
          owner_name:
            owner?.name || owner?.phone_number?.slice(-4) || "Friend",
          shared_date: formatDateString(normalizedItemDate),
          is_shared: true,
        });
      }
    }
  }

  return sharedItems;
}

export async function leaveSharedItem(
  itemId: string,
  userId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("plan_item_shares")
    .delete()
    .eq("plan_item_id", itemId)
    .eq("shared_with_user_id", userId);

  if (error) {
    throw new Error(`Failed to leave shared item: ${error.message}`);
  }
}

export async function getItemShareInfo(
  itemId: string
): Promise<{ sharedWith: { userId: string; name: string }[] }> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_item_shares")
    .select(
      `
      shared_with_user_id,
      users!plan_item_shares_shared_with_user_id_fkey (
        id,
        name,
        phone_number
      )
    `
    )
    .eq("plan_item_id", itemId);

  if (error) {
    throw new Error(`Failed to get item share info: ${error.message}`);
  }

  const sharedWith =
    data?.map((share) => {
      const user = share.users as unknown as User;
      return {
        userId: share.shared_with_user_id,
        name: user?.name || user?.phone_number?.slice(-4) || "User",
      };
    }) || [];

  return { sharedWith };
}

export async function updateItemSharing(
  itemId: string,
  ownerUserId: string,
  friendUserIds: string[]
): Promise<void> {
  const supabase = createServerClient();

  const { data: currentShares } = await supabase
    .from("plan_item_shares")
    .select("shared_with_user_id")
    .eq("plan_item_id", itemId);

  const currentUserIds = new Set(
    currentShares?.map((s) => s.shared_with_user_id) || []
  );
  const newUserIds = new Set(friendUserIds);

  const toAdd = friendUserIds.filter((id) => !currentUserIds.has(id));
  const toRemove = Array.from(currentUserIds).filter(
    (id) => !newUserIds.has(id)
  );

  if (toAdd.length > 0) {
    await shareItemWithFriends(itemId, ownerUserId, toAdd);
  }

  if (toRemove.length > 0) {
    await unshareItemWithFriends(itemId, toRemove);
  }
}

// Returns every content item that has been shared with this user via
// plan_item_shares, deduplicated by content id. Used by the Alexa skill
// to broaden recipe fuzzy-match beyond the user's own library.
export async function getAllSharedContent(
  userId: string
): Promise<{ content: Content; ownerName: string }[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_item_shares")
    .select(
      `
      plan_items!inner (
        content (*)
      ),
      users!plan_item_shares_owner_user_id_fkey (
        name,
        phone_number
      )
    `
    )
    .eq("shared_with_user_id", userId);

  if (error) {
    throw new Error(`Failed to get shared content: ${error.message}`);
  }

  const seen = new Set<string>();
  const result: { content: Content; ownerName: string }[] = [];
  for (const row of data ?? []) {
    const planItem = row.plan_items as unknown as { content: Content | null };
    const owner = row.users as unknown as {
      name?: string;
      phone_number?: string;
    };
    const content = planItem?.content;
    if (!content || seen.has(content.id)) continue;
    seen.add(content.id);
    result.push({
      content,
      ownerName: owner?.name || owner?.phone_number?.slice(-4) || "Friend",
    });
  }
  return result;
}

export async function getPlanItemShares(
  itemId: string
): Promise<PlanItemShare[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("plan_item_shares")
    .select("*")
    .eq("plan_item_id", itemId);

  if (error) {
    throw new Error(`Failed to get plan item shares: ${error.message}`);
  }

  return data as PlanItemShare[];
}
