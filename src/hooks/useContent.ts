import type { ContentWithTags, Tag } from "@/lib/supabase";
import { fetcher } from "@/lib/swr-config";
import useSWR from "swr";
import type { PlanHistorySummary } from "@/lib/plan-history";

interface ContentResponse {
  success: boolean;
  content: ContentWithTags[];
  tags: Tag[];
}

interface UseContentOptions {
  // Only fetch when enabled (e.g., after session is validated)
  enabled?: boolean;
}

export function useContent({ enabled = true }: UseContentOptions = {}) {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ContentResponse>(
      enabled ? "/api/content?includeTags=true" : null,
      fetcher,
      {
        revalidateOnFocus: true,
        keepPreviousData: true,
        dedupingInterval: 5000,
      }
    );

  return {
    content: data?.content ?? [],
    tags: data?.tags ?? [],
    isLoading,
    isValidating,
    error,
    // Expose mutate for optimistic updates
    mutate,
    // Helper to refresh content
    refresh: () => mutate(),
  };
}

// Hook for fetching a single content item
interface SingleContentResponse {
  content: ContentWithTags;
  tags: Tag[];
  isOwner?: boolean;
  ownerName?: string | null;
}

export function useContentById(
  id: string | null,
  { enabled = true }: UseContentOptions = {}
) {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<SingleContentResponse>(
      enabled && id ? `/api/content/${id}` : null,
      fetcher,
      {
        revalidateOnFocus: false,
        keepPreviousData: true,
      }
    );

  return {
    content: data?.content ?? null,
    tags: data?.tags ?? [],
    isOwner: data?.isOwner ?? false,
    ownerName: data?.ownerName ?? null,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

// Hook for fetching all user tags
interface TagsResponse {
  tags: Tag[];
}

export function useTags({ enabled = true }: UseContentOptions = {}) {
  const { data, error, isLoading, mutate } = useSWR<TagsResponse>(
    enabled ? "/api/tags" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Tags don't change often
    }
  );

  return {
    tags: data?.tags ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * When this item has been planned before.
 *
 * A separate request from the item itself, and only for the owner: the content
 * endpoint is public so items can be shared by link, while planning history is
 * a fact about the person rather than the recipe. Fetching it alongside also
 * keeps a second query off the critical path for a line that renders below the
 * fold.
 */
export function usePlanHistory(id: string | null, { enabled = true } = {}) {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    summary: PlanHistorySummary;
  }>(enabled && id ? `/api/content/${id}/history` : null, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    history: data?.summary ?? null,
    isLoading,
    error,
    mutate,
  };
}
