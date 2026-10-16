-- Pin announcements to the top of the announcement list
ALTER TABLE announcements ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
