-- Announcements move to D1 for durable storage (DO storage value limits were losing history)
CREATE TABLE IF NOT EXISTS announcements (
    timestamp INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    is_emergency INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
