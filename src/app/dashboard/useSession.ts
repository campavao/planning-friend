import { fetcher } from "@/lib/swr-config";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

/** What we last told the server, so a page load is not a write. */
const TIME_ZONE_SENT_KEY = "settings_timezone_reported";

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

    // A failed request tells us the network hiccuped, not that the session is
    // gone — and middleware already refused this page without a valid one.
    // Redirecting here sends you to the login page, which finds the session
    // intact and throws you straight back: the app builds itself twice for
    // one dropped request.
    if (error) return;

    // Not authenticated according to the current (possibly cached) data.
    // Wait for any in-flight revalidation to settle before redirecting so a
    // stale persisted "unauthenticated" entry can't bounce a freshly
    // logged-in user back to the login page.
    if (isValidating) return;

    // Only an explicit { authenticated: false } from the server is grounds
    // for a redirect.
    if (!data) return;

    if (!allowUnauthenticated) {
      router.push("/");
    }
  }, [
    data,
    isLoading,
    isValidating,
    isAuthenticated,
    error,
    router,
    onSuccess,
    allowUnauthenticated,
  ]);

  /**
   * Report which zone this browser is in, once per session.
   *
   * The planner stores a dinner as a wall clock, not an instant, so anything
   * that needs a real moment — the note-reminder cron — has to be told which
   * zone that clock belongs to. Nobody would ever go and set this by hand, and
   * the browser already knows, so it is reported rather than asked for.
   *
   * Fire-and-forget on purpose: a failed write means reminders keep using the
   * UTC fallback they used before this existed, which is worth nothing to
   * interrupt anyone over.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;
    // Once per browser per zone: re-sending it on every mount would be a write
    // per page load for a value that changes when someone gets on a plane.
    if (window.localStorage.getItem(TIME_ZONE_SENT_KEY) === timezone) return;

    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    })
      .then((res) => {
        if (res.ok) window.localStorage.setItem(TIME_ZONE_SENT_KEY, timezone);
      })
      .catch(() => {
        // See above.
      });
  }, [isAuthenticated]);

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
