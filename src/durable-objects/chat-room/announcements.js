export function isEmergencyActive(announcement) {
    if (!announcement || !announcement.isEmergency) return false;
    if (!announcement.emergencyUntil) return true;
    return Date.now() < announcement.emergencyUntil;
}
