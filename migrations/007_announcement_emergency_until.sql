-- Track emergency banner expiry so list badges match the live banner state (긴급공지 지속시간)
ALTER TABLE announcements ADD COLUMN emergency_until INTEGER;
