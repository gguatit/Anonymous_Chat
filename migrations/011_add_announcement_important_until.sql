-- 공지사항 '중요' 타입 지속시간: NULL = 계속, 값 = 해당 시각까지 활성
ALTER TABLE announcements ADD COLUMN important_until INTEGER;
