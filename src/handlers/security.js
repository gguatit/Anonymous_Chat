import { jsonError } from '../utils/errors.js';
import { calculateRiskScore, getRecommendedBlockThreshold, getCriticalThreshold } from '../utils/risk-scorer.js';
import { withAuth } from './admin.js';

async function parseQueryJSON(request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

async function getAllIPs(db, since) {
    const result = await db.prepare(
        `SELECT ip, event_type, category, severity_score, timestamp
         FROM security_events
         WHERE ip IS NOT NULL AND timestamp > ?
         ORDER BY timestamp DESC
         LIMIT 5000`
    ).bind(since).all();

    return result.results || [];
}

function groupByIP(rows) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.ip)) {
            map.set(row.ip, []);
        }
        map.get(row.ip).push({
            event_type: row.event_type,
            severity_score: row.severity_score,
            category: row.category,
            timestamp: row.timestamp,
        });
    }
    return map;
}

export async function listEvents(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
        const offset = (page - 1) * limit;
        const category = url.searchParams.get('category') || '';
        const severity = url.searchParams.get('severity') || '';
        const search = url.searchParams.get('search') || '';
        const ip = url.searchParams.get('ip') || '';

        let where = 'WHERE 1=1';
        const params = [];

        if (category) {
            where += ' AND category = ?';
            params.push(category);
        }
        if (severity) {
            where += ' AND severity = ?';
            params.push(severity);
        }
        if (search) {
            where += ' AND (details LIKE ? OR path LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (ip) {
            where += ' AND ip = ?';
            params.push(ip);
        }

        const countResult = await env.DB_ADMIN.prepare(
            `SELECT COUNT(*) as total FROM security_events ${where}`
        ).bind(...params).first();

        params.push(limit, offset);
        const events = await env.DB_ADMIN.prepare(
            `SELECT * FROM security_events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
        ).bind(...params).all();

        return new Response(JSON.stringify({
            events: events.results || [],
            total: countResult?.total || 0,
            page,
            limit,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] listEvents error:', error);
        return jsonError('Failed to fetch security events', 500, request.headers.get('Origin'));
    }
}

export async function getStats(request, env, corsHeaders) {
    try {
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

        const [byCategory, bySeverity, total] = await Promise.all([
            env.DB_ADMIN.prepare(
                `SELECT category, COUNT(*) as count
                 FROM security_events WHERE timestamp > ? GROUP BY category`
            ).bind(dayAgo).all(),
            env.DB_ADMIN.prepare(
                `SELECT severity, COUNT(*) as count
                 FROM security_events WHERE timestamp > ? GROUP BY severity`
            ).bind(dayAgo).all(),
            env.DB_ADMIN.prepare(
                `SELECT COUNT(*) as total FROM security_events WHERE timestamp > ?`
            ).bind(dayAgo).first(),
        ]);

        return new Response(JSON.stringify({
            byCategory: byCategory.results || [],
            bySeverity: bySeverity.results || [],
            last24h: total?.total || 0,
            criticalThreshold: getCriticalThreshold(),
            blockThreshold: getRecommendedBlockThreshold(),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] getStats error:', error);
        return jsonError('Failed to fetch security stats', 500, request.headers.get('Origin'));
    }
}

export async function getRiskIPs(request, env, corsHeaders) {
    try {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const rows = await getAllIPs(env.DB_ADMIN, sevenDaysAgo);
        const grouped = groupByIP(rows);

        const scored = [];
        for (const [ip, events] of grouped) {
            const result = calculateRiskScore(events);
            scored.push({
                ip,
                score: result.score,
                eventCount: result.eventCount,
                categories: [...result.categories],
                breakdown: result.breakdown,
                recentCount: events.filter(
                    (e) => e.timestamp > Date.now() - 60 * 60 * 1000
                ).length,
            });
        }

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 10);

        return new Response(JSON.stringify({
            riskIPs: top,
            blockThreshold: getRecommendedBlockThreshold(),
            criticalThreshold: getCriticalThreshold(),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] getRiskIPs error:', error);
        return jsonError('Failed to compute risk IPs', 500, request.headers.get('Origin'));
    }
}

export async function getEvent(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const id = parseInt(url.pathname.split('/').pop());

        const event = await env.DB_ADMIN.prepare(
            'SELECT * FROM security_events WHERE id = ?'
        ).bind(id).first();

        if (!event) {
            return jsonError('Event not found', 404, request.headers.get('Origin'));
        }

        let related = { results: [] };
        if (event.ip) {
            related = await env.DB_ADMIN.prepare(
                `SELECT * FROM security_events
                 WHERE ip = ? AND id != ?
                 ORDER BY timestamp DESC LIMIT 20`
            ).bind(event.ip, id).all();
        }

        return new Response(JSON.stringify({
            event,
            relatedByIp: related.results || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] getEvent error:', error);
        return jsonError('Failed to fetch event', 500, request.headers.get('Origin'));
    }
}

export async function clearEvents(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const before = parseInt(url.searchParams.get('before') || String(Date.now() - 90 * 24 * 60 * 60 * 1000));

        const result = await env.DB_ADMIN.prepare(
            'DELETE FROM security_events WHERE timestamp < ?'
        ).bind(before).run();

        return new Response(JSON.stringify({
            success: true,
            deleted: result.changes || 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] clearEvents error:', error);
        return jsonError('Failed to clear security events', 500, request.headers.get('Origin'));
    }
}

export async function exportCSV(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const category = url.searchParams.get('category') || '';
        const since = parseInt(url.searchParams.get('since') || String(Date.now() - 7 * 24 * 60 * 60 * 1000));

        let where = 'WHERE timestamp > ?';
        const params = [since];
        if (category) {
            where += ' AND category = ?';
            params.push(category);
        }

        const events = await env.DB_ADMIN.prepare(
            `SELECT * FROM security_events ${where} ORDER BY timestamp DESC LIMIT 10000`
        ).bind(...params).all();

        const rows = events.results || [];
        const headers = ['id', 'event_type', 'category', 'severity', 'severity_score', 'ip', 'country', 'path', 'method', 'details', 'timestamp'];
        const csvLines = [headers.join(',')];

        for (const row of rows) {
            const line = headers.map((h) => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',');
            csvLines.push(line);
        }

        const csvContent = csvLines.join('\n');

        return new Response(csvContent, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="security-events.csv"',
            },
        });
    } catch (error) {
        console.error('[Security] exportCSV error:', error);
        return jsonError('Failed to export CSV', 500, request.headers.get('Origin'));
    }
}

export async function getBadge(request, env, corsHeaders) {
    try {
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

        const [high, medium, critical] = await Promise.all([
            env.DB_ADMIN.prepare(
                `SELECT COUNT(*) as count FROM security_events
                 WHERE timestamp > ? AND severity_score >= 40 AND severity_score < 60`
            ).bind(dayAgo).first(),
            env.DB_ADMIN.prepare(
                `SELECT COUNT(*) as count FROM security_events
                 WHERE timestamp > ? AND severity_score >= 20 AND severity_score < 40`
            ).bind(dayAgo).first(),
            env.DB_ADMIN.prepare(
                `SELECT COUNT(*) as count FROM security_events
                 WHERE timestamp > ? AND severity_score >= 60`
            ).bind(dayAgo).first(),
        ]);

        return new Response(JSON.stringify({
            critical: critical?.count || 0,
            high: high?.count || 0,
            medium: medium?.count || 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] getBadge error:', error);
        return jsonError('Failed to fetch badge count', 500, request.headers.get('Origin'));
    }
}

export async function blockRecommendedIP(request, env, corsHeaders) {
    try {
        const body = await parseQueryJSON(request);
        const ip = body.ip;

        if (!ip || typeof ip !== 'string') {
            return jsonError('IP address is required', 400, request.headers.get('Origin'));
        }

        const resp = await env.CHAT_ROOM.get(
            env.CHAT_ROOM.idFromName('main-room')
        ).fetch(new Request('https://dummy/ban-ip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Internal-Token': env.HMAC_SECRET,
            },
            body: JSON.stringify({ ip, duration: 86400 }),
        }));

        const result = await resp.json();

        return new Response(JSON.stringify({
            success: true,
            ip,
            action: 'banned',
            duration: 86400,
            doResponse: result,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('[Security] blockRecommendedIP error:', error);
        return jsonError('Failed to block IP', 500, request.headers.get('Origin'));
    }
}

export const handleListEvents = withAuth(listEvents);
export const handleGetStats = withAuth(getStats);
export const handleGetRiskIPs = withAuth(getRiskIPs);
export const handleGetEvent = withAuth(getEvent);
export const handleClearEvents = withAuth(clearEvents);
export const handleExportCSV = withAuth(exportCSV);
export const handleGetBadge = withAuth(getBadge);
export const handleBlockIP = withAuth(blockRecommendedIP);
