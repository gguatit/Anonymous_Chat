-- Security events table for attack/intrusion tracking (90-day retention)
CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    severity_score INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT,
    country TEXT,
    path TEXT,
    method TEXT,
    session_id TEXT,
    details TEXT,
    metadata TEXT,
    timestamp INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sec_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_ip ON security_events(ip);
CREATE INDEX IF NOT EXISTS idx_sec_events_category ON security_events(category);
CREATE INDEX IF NOT EXISTS idx_sec_events_severity ON security_events(severity_score DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_type ON security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_sec_events_ip_recent
  ON security_events(ip, timestamp DESC)
  WHERE timestamp > (strftime('%s','now') - 7*24*60*60) * 1000;
