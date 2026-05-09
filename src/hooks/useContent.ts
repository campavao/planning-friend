import type { ContentWithTags, Tag } from "@/lib/supabase";
import { fetcher } from "@/lib/swr-config";
import useSWR from "swr";

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
