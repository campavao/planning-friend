import type {
    Content,
    PlanItem,
    SharedPlanItem,
    Tag,
    WeeklyPlanWithItems,
} from "@/lib/supabase";
import { fetcher } from "@/lib/swr-config";
import useSWR from "swr";

// Extended plan item with sharing info from API
interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  shared_with?: { userId: string; name: string }[];
}

// Extended plan type
interface WeeklyPlanWithSharingItems
  extends Omit<WeeklyPlanWithItems, "items"> {
  items: PlanItemWithSharing[];
}

// Friend that can be shared with (has a linked account)
interface ShareableFriend {
  id: string;
  name: string;
  linkedUserId: string;
  isFavorite: boolean;
}

// Content with tags for filtering
interface ContentWithTags extends Content {
  tags?: Tag[];
}

export interface PlannerData {
  plan: WeeklyPlanWithSharingItems | null;
  sharedItems: SharedPlanItem[];
  availableContent: ContentWithTags[];
  suggestions: Record<number, Content[]>;
  shareableFriends: ShareableFriend[];
  allTags?: Tag[];
}

interface UsePlannerOptions {
  enabled?: boolean;
}

export function usePlanner(
  weekStart: string | null,
  { enabled = true }: UsePlannerOptions = {}
) {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<PlannerData>(
      enabled && weekStart ? `/api/planner?week=${weekStart}` : null,
      fetcher,
      {
        revalidateOnFocus: true,
        keepPreviousData: true,
        dedupingInterval: 2000,
      }
    );

  return {
    data: data ?? null,
    plan: data?.plan ?? null,
    sharedItems: data?.sharedItems ?? [],
    availableContent: data?.availableContent ?? [],
    suggestions: data?.suggestions ?? {},
    shareableFriends: data?.shareableFriends ?? [],
    allTags: data?.allTags ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
    // Helper to invalidate and refetch
    refresh: () => mutate(),
  };
}
