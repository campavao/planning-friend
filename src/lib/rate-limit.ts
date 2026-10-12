import { createServerClient } from "@/lib/db/client";

// Counts one hit against `key` in the current fixed window and reports whether
// it is still within `limit`. The counters live in Postgres
// (supabase/schema-rate-limits.sql) so every serverless instance shares them.
// Throws if the database call fails; callers should treat that as a refusal.
export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await createServerClient().rpc("hit_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return (data as number) <= limit;
}

// The caller's IP as Vercel reports it. Vercel overwrites these headers at the
// edge, so the client cannot spoof them.
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
