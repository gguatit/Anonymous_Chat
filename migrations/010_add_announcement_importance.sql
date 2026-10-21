-- 공지사항 '중요' 타입 추가: 일반(0/0) / 중요(0/1) / 긴급(1/0)
ALTER TABLE announcements ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0;
