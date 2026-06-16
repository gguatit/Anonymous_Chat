import { logSecurityEvent as _logSecurityEvent } from './security-logger.js';

const MAX_LOG_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_PROBABILITY = 0.1;

export { _logSecurityEvent as logSecurityEvent };

export async function logAdminActivity(env, activity) {
    if (!env?.DB_ADMIN) return;

    const type = String(activity.type || '');
    const ip = activity.ip ? String(activity.ip) : null;
    const timestamp = Number(activity.timestamp || Date.now());
    const data = JSON.stringify(activity);

    try {
        await env.DB_ADMIN.prepare(
            'INSERT INTO admin_activity_logs (type, ip, timestamp, data) VALUES (?, ?, ?, ?)'
        ).bind(type, ip, timestamp, data).run();
    } catch (error) {
        console.error('[Logger] Failed to write admin activity log:', error);
        return;
    }

    if (Math.random() < CLEANUP_PROBABILITY) {
        try {
            await env.DB_ADMIN.prepare(
                'DELETE FROM admin_activity_logs WHERE timestamp < ?'
            ).bind(Date.now() - MAX_LOG_AGE_MS).run();
        } catch (error) {
            console.error('[Logger] Failed to cleanup old activity logs:', error);
        }
    }
}

export async function logAuditLog(db, action, details, metadata = {}) {
    if (!db) return;
    const timestamp = Date.now();
    try {
        await db.prepare(
            'INSERT INTO audit_logs (action, details, timestamp, metadata) VALUES (?, ?, ?, ?)'
        ).bind(action, details || '', timestamp, JSON.stringify(metadata)).run();
    } catch (error) {
        console.error('[Logger] Failed to write audit log:', error);
    }
}

export async function logErrorLog(db, type, message, stackTrace, location, environment, context) {
    if (!db) return;
    const timestamp = new Date().toISOString();
    try {
        await db.prepare(
            'INSERT INTO error_logs (type, message, stack_trace, location, environment, context, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(type, message, stackTrace || '', location || '', JSON.stringify(environment || {}), context || '', timestamp).run();
    } catch (error) {
        console.error('[Logger] Failed to write error log:', error);
    }
}
