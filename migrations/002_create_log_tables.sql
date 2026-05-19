-- Admin activity logs (login/logout/channel-delete records)
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ip TEXT,
    timestamp INTEGER NOT NULL,
    data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON admin_activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON admin_activity_logs(type);

-- Audit logs (admin actions: kick, edit, delete, announce, unban, etc.)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    details TEXT,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- Error logs (system errors, client errors, WebSocket errors)
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    location TEXT,
    environment TEXT,
    context TEXT,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_error_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_type ON error_logs(type);
