export function isEmergencyActive(announcement) {
    if (!announcement || !announcement.isEmergency) return false;
    if (!announcement.emergencyUntil) return true;
    return Date.now() < announcement.emergencyUntil;
}

export function isImportantActive(announcement) {
    if (!announcement || announcement.isEmergency || !announcement.isImportant) return false;
    if (!announcement.importantUntil) return true;
    return Date.now() < announcement.importantUntil;
}
