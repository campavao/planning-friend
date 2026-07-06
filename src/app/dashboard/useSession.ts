import { fetcher } from "@/lib/swr-config";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

export interface SessionUser {
  id: string;
  phoneNumber: string;
}

interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

interface UseSessionOptions {
  onSuccess?: () => Promise<void>;
  onFinishLoading?: () => void;
  // Set to true to skip redirect on unauthenticated (useful for public pages)
  allowUnauthenticated?: boolean;
}

export function useSession({
  onSuccess,
  onFinishLoading,
  allowUnauthenticated = false,
}: UseSessionOptions = {}) {
  const router = useRouter();

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<SessionResponse>("/api/auth/session", fetcher, {
      // Revalidate session on focus for security
      revalidateOnFocus: true,
      // Cache session for 5 minutes
      dedupingInterval: 5 * 60 * 1000,
      // Don't retry on auth errors
      shouldRetryOnError: false,
      // Keep showing cached session while revalidating
      revalidateIfStale: true,
    });

  const isAuthenticated = data?.authenticated ?? false;
  const user = data?.user ?? null;

  // Handle authentication redirect
  useEffect(() => {
    // Wait for initial load to complete
    if (isLoading) return;

    // If authenticated, call onSuccess
    if (isAuthenticated && !error) {
      onSuccess?.();
      return;
    }

    // Not authenticated according to the current (possibly cached) data.
    // Wait for any in-flight revalidation to settle before redirecting so a
    // stale persisted "unauthenticated" entry can't bounce a freshly
    // logged-in user back to the login page.
    if (isValidating) return;

    if (!allowUnauthenticated) {
      router.push("/");
    }
  }, [
    isLoading,
    isValidating,
    isAuthenticated,
    error,
    router,
    onSuccess,
    allowUnauthenticated,
  ]);

  // Call onFinishLoading when initial load completes
  useEffect(() => {
    if (!isLoading && onFinishLoading) {
      onFinishLoading();
    }
  }, [isLoading, onFinishLoading]);

  return {
    user,
    isLoading,
    isValidating,
    isAuthenticated,
    // Expose mutate for manual revalidation (e.g., after login/logout)
    mutate,
  };
}
