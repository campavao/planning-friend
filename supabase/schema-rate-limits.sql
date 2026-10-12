-- ---------------------------------------------------------------------------
-- rate_limits + hit_rate_limit()
-- ---------------------------------------------------------------------------
-- Shared fixed-window counters for public endpoints that cost money per call.
--
-- /api/auth/send-code texts a Verify OTP to whatever number it is handed. In
-- October 2026 SMS-pumping bots used it to send ~1,800 codes to premium-rate
-- numbers abroad (~$565). An in-memory limiter would not have helped: every
-- serverless instance keeps its own Map, so the counts have to live here.
--
-- hit_rate_limit() counts one hit against p_key in the current window and
-- returns the window's running total; the caller compares it to its limit.
-- The upsert is a single statement, so concurrent hits cannot both read the
-- same count. Rows from windows older than a day are pruned on the way in.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Only the service role (which bypasses RLS) touches this table.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION hit_rate_limit(p_key TEXT, p_window_seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '1 day';

  INSERT INTO rate_limits (key, window_start, hits)
  VALUES (
    p_key,
    to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds),
    1
  )
  ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits;
END;
$$;

-- Keep anon/authenticated from bumping (or probing) counters via PostgREST.
REVOKE EXECUTE ON FUNCTION hit_rate_limit(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
