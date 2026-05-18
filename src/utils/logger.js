const MAX_LOG_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_PROBABILITY = 0.1;

export async function logAdminActivity(env, activity) {
    if (!env?.DB_ADMIN) return;

    const type = String(activity.type || '');
    const ip = activity.ip ? String(activity.ip) : null;
    const timestamp = Number(activity.timestamp || Date.now());
    const data = JSON.stringify(activity);

    try {
        await env.DB_ADMIN.prepare(
            'INSERT INTO admin_logs (type, ip, timestamp, data) VALUES (?, ?, ?, ?)'
        ).bind(type, ip, timestamp, data).run();
    } catch (error) {
        console.error('[Logger] Failed to write admin log:', error);
        return;
    }

    if (Math.random() < CLEANUP_PROBABILITY) {
        try {
            await env.DB_ADMIN.prepare(
                'DELETE FROM admin_logs WHERE timestamp < ?'
            ).bind(Date.now() - MAX_LOG_AGE_MS).run();
        } catch (error) {
            console.error('[Logger] Failed to cleanup old logs:', error);
        }
    }
}
