-- Calendar Sync Schema
-- Allows users to sync their weekly planner with external calendar apps (Google Calendar, iCal, etc.)

-- Calendar sync tokens table
-- Each user gets a unique token they can use to access their calendar feed
CREATE TABLE calendar_sync_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id) -- Each user has only one token at a time
);

CREATE INDEX idx_calendar_sync_tokens_token ON calendar_sync_tokens(token);
CREATE INDEX idx_calendar_sync_tokens_user ON calendar_sync_tokens(user_id);

-- Enable RLS
ALTER TABLE calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sync tokens" ON calendar_sync_tokens
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage sync tokens" ON calendar_sync_tokens
  FOR ALL USING (auth.role() = 'service_role');
