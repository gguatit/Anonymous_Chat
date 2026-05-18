CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ip TEXT,
    timestamp INTEGER NOT NULL,
    data JSON,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_type ON admin_logs(type);
