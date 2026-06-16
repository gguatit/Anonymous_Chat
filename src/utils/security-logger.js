import {
    SECURITY_EVENTS_MAP,
    DEDUP_WINDOW_MS,
    CLEANUP_PROBABILITY,
} from '../constants/security-events.js';

const _dedupStore = new Map();

function isDuplicate(eventType, ip, now) {
    if (!ip) return false;
    const dedupKey = `${ip}:${eventType}`;
    const lastSeen = _dedupStore.get(dedupKey);
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
        return true;
    }
    _dedupStore.set(dedupKey, now);
    return false;
}

async function runCleanupIfNeeded(env, now) {
    if (Math.random() >= CLEANUP_PROBABILITY) return;
    try {
        const cutoff = now - 90 * 24 * 60 * 60 * 1000;
        await env.DB_ADMIN.prepare(
            'DELETE FROM security_events WHERE timestamp < ?'
        ).bind(cutoff).run();
    } catch (error) {
        console.error('[SecurityLogger] Failed to cleanup old security events:', error);
    }
}

export async function logSecurityEvent(env, eventType, details = {}) {
    if (!env?.DB_ADMIN) return;

    const eventDef = SECURITY_EVENTS_MAP[eventType];
    if (!eventDef) {
        console.error('[SecurityLogger] Unknown event type:', eventType);
        return;
    }

    const ip = details.ip || null;
    const now = Date.now();

    if (isDuplicate(eventType, ip, now)) return;

    try {
        await env.DB_ADMIN.prepare(
            `INSERT INTO security_events
             (event_type, category, severity, severity_score, ip, user_agent, country, path, method, session_id, details, metadata, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            eventDef.type,
            eventDef.category,
            eventDef.severity,
            eventDef.score,
            ip,
            details.userAgent || null,
            details.country || null,
            details.path || null,
            details.method || null,
            details.sessionId || null,
            details.details || null,
            details.metadata ? JSON.stringify(details.metadata) : null,
            now
        ).run();
    } catch (error) {
        console.error('[SecurityLogger] Failed to write security event:', error);
        return;
    }

    await runCleanupIfNeeded(env, now);
}

export function clearDedupCache() {
    _dedupStore.clear();
}
