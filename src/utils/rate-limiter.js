import { CLEANUP_INTERVAL_MS } from '../config/constants.js';

/**
 * Creates a rate limiter with automatic stale entry cleanup.
 * Replaces the inline checkRateLimit in worker.js with a managed instance.
 *
 * LIMITATION: state is held in-memory per Worker isolate. Cloudflare may run
 * multiple isolates for the same Worker across colos/concurrent requests, so
 * this limiter caps abuse per-isolate, not globally. It reduces load but is
 * not a hard guarantee. For a global limit, move state to a Durable Object.
 *
 * @param {number} [cleanupIntervalMs] - How often to purge expired entries (default: CLEANUP_INTERVAL_MS)
 * @returns {{ checkRateLimit: Function, cleanup: Function, destroy: Function }}
 */
export function createRateLimiter(cleanupIntervalMs = CLEANUP_INTERVAL_MS) {
    const store = new Map();
    let intervalId = null;
    let destroyed = false;

    function checkRateLimit(ip, config, tag = '') {
        if (destroyed) return false;
        const key = tag ? `${ip}:${tag}` : ip;
        const now = Date.now();
        const entry = store.get(key);
        if (!entry || now - entry.windowStart > config.windowMs) {
            store.set(key, { windowStart: now, count: 1, windowMs: config.windowMs });
            return true;
        }
        if (entry.count >= config.max) {
            return false;
        }
        entry.count++;
        return true;
    }

    function cleanup() {
        if (destroyed || store.size === 0) return;
        const now = Date.now();
        for (const [key, entry] of store) {
            if (now - entry.windowStart > Math.max(60000, entry.windowMs || 60000)) {
                store.delete(key);
            }
        }
    }

    if (cleanupIntervalMs > 0) {
        intervalId = setInterval(cleanup, cleanupIntervalMs);
    }

    function destroy() {
        destroyed = true;
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        store.clear();
    }

    return { checkRateLimit, cleanup, destroy };
}
