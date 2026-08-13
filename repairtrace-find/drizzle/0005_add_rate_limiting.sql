-- Create rate limiting log table
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id TEXT NOT NULL PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient cleanup and checking
CREATE INDEX IF NOT EXISTS rate_limit_events_key_created_idx ON rate_limit_events(key, created_at);

-- Cleanup old rate limit records (keep last 7 days)
DELETE FROM rate_limit_events WHERE datetime(created_at) < datetime('now', '-7 days');
