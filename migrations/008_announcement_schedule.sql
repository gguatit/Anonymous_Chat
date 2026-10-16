-- Hide scheduled announcements from public reads until their activation time (예약 공지 사전 노출 방지)
ALTER TABLE announcements ADD COLUMN schedule_at INTEGER;
