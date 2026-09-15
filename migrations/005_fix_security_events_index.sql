-- D1 rejects every write to a table that has an index whose definition uses a
-- non-deterministic expression. idx_sec_events_ip_recent used
-- strftime('%s','now') in its partial-index WHERE clause, which made all
-- security_events INSERTs fail with:
--   "non-deterministic use of strftime() in an index: SQLITE_ERROR"
-- Replace it with a plain (deterministic) composite index.
DROP INDEX IF EXISTS idx_sec_events_ip_recent;

CREATE INDEX IF NOT EXISTS idx_sec_events_ip_timestamp
    ON security_events(ip, timestamp DESC);
