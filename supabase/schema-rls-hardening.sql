-- RLS hardening — run this in your Supabase SQL Editor
--
-- Fixes PLA-17. Thirteen tables carried a SELECT policy named "Users can view
-- own X" whose predicate was literally `true`, applied to the `public` role
-- (i.e. everyone, including `anon`). Combined with the SELECT grants that
-- `anon` and `authenticated` hold on these tables, that made every row readable
-- through the Data API by anyone holding the anon key — which Supabase treats
-- as public by design. Verified before this change: `users` (phone numbers) and
-- `content` both returned rows to an unauthenticated PostgREST request.
--
-- The fix is to drop those policies outright rather than rewrite them. This app
-- does not use Supabase Auth for its own sessions — it uses an HMAC-signed
-- cookie (src/lib/auth.ts) — so `auth.uid()` is always NULL here and an
-- ownership predicate built on it could never match. Every real data path goes
-- through createServerClient() with the service role key, which has BYPASSRLS
-- and performs its own ownership checks in the API routes. So no user-facing
-- policy is needed at all: with RLS enabled and no matching policy, `anon` and
-- `authenticated` get zero rows, and the service role is unaffected.
--
-- This is the same shape `verification_codes` already had, which is why it was
-- the one sensitive table that was never exposed.

-- Drop the permissive SELECT policies.
DROP POLICY IF EXISTS "Users can view own content"      ON content;
DROP POLICY IF EXISTS "Users can view content tags"     ON content_tags;
DROP POLICY IF EXISTS "Users can view own friends"      ON friends;
DROP POLICY IF EXISTS "Users can view assignments"      ON gift_assignments;
DROP POLICY IF EXISTS "Users can view own recipients"   ON gift_recipients;
DROP POLICY IF EXISTS "Users can view plan item shares" ON plan_item_shares;
DROP POLICY IF EXISTS "Users can view plan shares"      ON plan_shares;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can view share invites"    ON share_invites;
DROP POLICY IF EXISTS "Users can view own tags"         ON tags;
DROP POLICY IF EXISTS "Users can view own settings"     ON user_settings;
DROP POLICY IF EXISTS "Users can view own data"         ON users;
DROP POLICY IF EXISTS "Users can view own suggestions"  ON weekly_plan_suggestions;

-- Defense in depth: revoke the Data API grants as well, so these tables are
-- unreachable even if a permissive policy is reintroduced by accident. Nothing
-- client-side uses the anon key for table access — createBrowserClient() in
-- src/lib/db/client.ts has no callers — and Supabase Auth (phone OTP) operates
-- on the `auth` schema, not on these tables, so revoking is safe.
REVOKE SELECT, INSERT, UPDATE, DELETE ON
  content,
  content_tags,
  friends,
  gift_assignments,
  gift_recipients,
  plan_item_shares,
  plan_shares,
  push_subscriptions,
  share_invites,
  tags,
  user_settings,
  users,
  verification_codes,
  weekly_plan_suggestions,
  weekly_plans,
  plan_items,
  grocery_list_cache
FROM anon, authenticated;

-- Note on the surviving "Service role can manage X" policies: they use
-- `auth.role() = 'service_role'`, which Supabase has deprecated, and they are
-- redundant anyway because the service role bypasses RLS entirely. They are
-- left in place here because removing them changes nothing and this migration
-- should stay minimal. Worth cleaning up separately.
