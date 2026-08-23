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
export interface PlanItemWithSharing extends PlanItem {
  is_owner: boolean;
  is_auto_event?: boolean;
  shared_with?: { userId: string; name: string }[];
}

// Extended plan type
interface WeeklyPlanWithSharingItems
  extends Omit<WeeklyPlanWithItems, "items"> {
  items: PlanItemWithSharing[];
}

// Friend that can be shared with (has a linked account)
export interface ShareableFriend {
  id: string;
  name: string;
  linkedUserId: string;
  isFavorite: boolean;
}

// Content with tags for filtering
interface ContentWithTags extends Content {
  tags?: Tag[];
}

export interface SuggestionPick {
  contentId: string;
  why: string | null;
}

export interface SuggestionsMeta {
  /** False when NEXT_PUBLIC_SMART_SUGGESTIONS_ENABLED is not set on the server. */
  enabled: boolean;
  emptyPool: boolean;
  poolSize: number;
  source?: string;
}

// Week-scoped planner payload (GET /api/planner?week=...&fields=week)
export interface PlannerData {
  plan: WeeklyPlanWithSharingItems | null;
  sharedItems: SharedPlanItem[];
  suggestions: Record<number, SuggestionPick[]>;
  suggestionsMeta?: SuggestionsMeta;
}

// Week-independent planner payload (GET /api/planner/library)
export interface PlannerLibraryData {
  availableContent: ContentWithTags[];
  allTags: Tag[];
  shareableFriends: ShareableFriend[];
  /** Quick note titles planned before, most recent first (PLA-43). */
  recentNotes: string[];
}

export const PLANNER_LIBRARY_KEY = "/api/planner/library";

export function plannerWeekKey(weekStart: string) {
  return `/api/planner?week=${weekStart}&fields=week`;
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
      enabled && weekStart ? plannerWeekKey(weekStart) : null,
      fetcher,
      {
        revalidateOnFocus: true,
        keepPreviousData: true,
        dedupingInterval: 5000,
      }
    );

  return {
    data: data ?? null,
    plan: data?.plan ?? null,
    sharedItems: data?.sharedItems ?? [],
    suggestions: data?.suggestions ?? {},
    suggestionsMeta: data?.suggestionsMeta ?? {
      enabled: false,
      emptyPool: false,
      poolSize: 0,
    },
    isLoading,
    isValidating,
    error,
    mutate,
    // Helper to invalidate and refetch
    refresh: () => mutate(),
  };
}

export function usePlannerLibrary({ enabled = true }: UsePlannerOptions = {}) {
  const { data, error, isLoading, mutate } = useSWR<PlannerLibraryData>(
    enabled ? PLANNER_LIBRARY_KEY : null,
    fetcher,
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
      dedupingInterval: 5000,
    }
  );

  return {
    data: data ?? null,
    availableContent: data?.availableContent ?? [],
    allTags: data?.allTags ?? [],
    shareableFriends: data?.shareableFriends ?? [],
    recentNotes: data?.recentNotes ?? [],
    isLoading,
    error,
    mutate,
  };
}
