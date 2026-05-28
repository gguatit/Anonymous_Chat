import { sleep, constantTimeCompare } from '../utils/security.js';
import { logAdminActivity } from '../utils/logger.js';
import { checkRateLimit, incrementRateLimit, generateAdminToken, verifyAdminToken } from '../middleware/auth.js';
import { forwardToDO, forwardToChannelDO } from '../utils/do.js';
import { safeJson } from '../utils/helpers.js';
import { AUTH } from '../config/constants.js';

async function requireAdminAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET, env);
    return isValid ? token : null;
}

function withAuth(handler) {
    return async (request, env, corsHeaders) => {
        const token = await requireAdminAuth(request, env);
        if (!token) return new Response(null, { status: 401, headers: corsHeaders });
        return handler(request, env, corsHeaders);
    };
}

function jsonError(corsHeaders, message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

function forwardResponse(response, corsHeaders) {
    return new Response(response.body, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

export async function handleAdminLogin(request, env, corsHeaders) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const timestamp = Date.now();

    try {
        const rateLimitKey = `ratelimit:${clientIP}`;
        const isBlocked = await checkRateLimit(env, rateLimitKey);

        if (isBlocked) {
            await logAdminActivity(env, {
                type: 'login_blocked',
                reason: 'rate_limit_exceeded',
                ip: clientIP,
                timestamp
            });

            await sleep(1000);

            return new Response(JSON.stringify({
                success: false,
                error: 'Too many login attempts. Please try again later.'
            }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { id, password } = await safeJson(request);

        if (!env.ADMIN_ID || !env.ADMIN_PASSWORD) {
            await logAdminActivity(env, {
                type: 'login_failed',
                reason: 'credentials_not_configured',
                ip: clientIP,
                timestamp
            });

            return new Response(JSON.stringify({
                success: false,
                error: 'Service temporarily unavailable'
            }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const ADMIN_ID = env.ADMIN_ID;
        const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

        const idMatch = await constantTimeCompare(id, ADMIN_ID);
        const _passwordMatch = await constantTimeCompare(password, ADMIN_PASSWORD);

        if (idMatch && _passwordMatch) {
            if (env?.ADMIN_TOKENS) {
                await env.ADMIN_TOKENS.delete(rateLimitKey);
            }

            const token = await generateAdminToken(id + ':' + password, env.HMAC_SECRET);

            await logAdminActivity(env, {
                type: 'login_success',
                admin: id,
                ip: clientIP,
                timestamp,
                userAgent: request.headers.get('User-Agent')
            });

            return new Response(JSON.stringify({
                success: true,
                token
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        await incrementRateLimit(env, rateLimitKey);
        await sleep(100);

        await logAdminActivity(env, {
            type: 'login_failed',
            reason: 'invalid_credentials',
            attemptedId: id,
            ip: clientIP,
            timestamp,
            userAgent: request.headers.get('User-Agent')
        });

        return new Response(JSON.stringify({
            success: false,
            error: 'Invalid credentials'
        }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (_error) {
        await logAdminActivity(env, {
            type: 'login_error',
            error: _error.message,
            ip: clientIP,
            timestamp
        });

        await sleep(100);

        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

export const handleAdminVerify = withAuth(async (_request, _env, corsHeaders) => {
    return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
});

export const handleAdminMetrics = withAuth(async (_request, env, corsHeaders) => {
    const response = await forwardToDO(env, '/admin/metrics', {
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    return forwardResponse(response, corsHeaders);
});

export const handleAdminSessions = withAuth(async (_request, env, corsHeaders) => {
    const response = await forwardToDO(env, '/admin/sessions', {
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    return forwardResponse(response, corsHeaders);
});

export const handleAdminMessages = withAuth(async (_request, env, corsHeaders) => {
    const response = await forwardToDO(env, '/admin/messages', {
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    return forwardResponse(response, corsHeaders);
});

export const handleAdminDeleteErrorLogs = withAuth(async (request, env, corsHeaders) => {
    if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: corsHeaders });
    }

    if (env?.DB_ADMIN) {
        try {
            await env.DB_ADMIN.prepare('DELETE FROM error_logs').run();
        } catch (e) {
            console.error('Failed to delete error logs from D1:', e);
        }
    }

    const response = await forwardToDO(env, '/admin/delete-error-logs', {
        method: 'POST',
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    return forwardResponse(response, corsHeaders);
});

export async function handleAdminLogout(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (env?.ADMIN_TOKENS) {
        await env.ADMIN_TOKENS.put(`revoked:${token}`, 'true', {
            expirationTtl: AUTH.TOKEN_EXPIRY_MS / 1000
        });
    }

    await logAdminActivity(env, {
        type: 'logout',
        ip: clientIP,
        timestamp: Date.now()
    });

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

export const handleAdminLogs = withAuth(async (_request, env, corsHeaders) => {
    if (!env?.DB_ADMIN) {
        return new Response(JSON.stringify({ logs: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { results } = await env.DB_ADMIN.prepare(
        'SELECT data FROM admin_activity_logs ORDER BY timestamp DESC LIMIT 100'
    ).all();

    const logs = (results || []).map(row => {
        try { return JSON.parse(row.data); } catch (_e) { /* expected: malformed log rows */ return null; }
    }).filter(Boolean);

    return new Response(JSON.stringify({ logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
});

export const handleAdminDeleteLogs = withAuth(async (_request, env, corsHeaders) => {
    if (!env?.DB_ADMIN) {
        return new Response(JSON.stringify({ success: true, deletedCount: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const { meta } = await env.DB_ADMIN.prepare(
            'DELETE FROM admin_activity_logs'
        ).run();

        return new Response(JSON.stringify({ success: true, deletedCount: meta?.changes || 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to delete logs', 500);
    }
});

export const handleAdminBroadcast = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const content = typeof body.content === 'string' ? body.content : '';
        const file = body.file || null;

        const response = await forwardToDO(env, '/admin/broadcast', {
            method: 'POST',
            json: { content, file, adminId: 'admin' }
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Invalid request');
    }
});

export const handleAdminEditMessage = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const messageId = body.messageId;
        const newContent = body.newContent;

        if (!messageId || !newContent) {
            return jsonError(corsHeaders, 'Missing required fields');
        }

        const response = await forwardToDO(env, '/admin/edit-message', {
            method: 'POST',
            json: { messageId, newContent }
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Invalid request');
    }
});

export const handleAdminDeleteMessage = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const messageId = body.messageId;

        if (!messageId) {
            return jsonError(corsHeaders, 'Missing messageId');
        }

        const response = await forwardToDO(env, '/admin/delete-message', {
            method: 'POST',
            json: { messageId }
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Invalid request');
    }
});

export const handleAdminDeleteAllMessages = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const confirmation = body.confirmation;

        if (confirmation !== 'DELETE_ALL_MESSAGES') {
            return jsonError(corsHeaders, 'Invalid confirmation');
        }

        const response = await forwardToDO(env, '/admin/delete-all-messages', {
            method: 'POST',
            json: { confirmation }
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Invalid request');
    }
});

export const handleAdminKickUser = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const sessionId = body.sessionId;
        const banDuration = body.banDuration || 0;

        if (!sessionId) {
            return jsonError(corsHeaders, 'Missing sessionId');
        }

        const response = await forwardToDO(env, '/admin/kick-user', {
            method: 'POST',
            json: { sessionId, banDuration }
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Invalid request');
    }
});

export const handleAdminAnnounce = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const content = typeof body.content === 'string' ? body.content : '';
        const timestamp = body.timestamp;

        if (request.method === 'POST' && !content) {
            return jsonError(corsHeaders, 'Missing content');
        }

        if ((request.method === 'PUT' || request.method === 'DELETE') && !timestamp) {
            return jsonError(corsHeaders, 'Missing timestamp');
        }

        const forwardBody = { content };
        if (request.method === 'PUT' || request.method === 'DELETE') {
            forwardBody.timestamp = timestamp;
        }
        if (request.method === 'POST' || request.method === 'PUT') {
            if (Object.hasOwn(body, 'isEmergency')) {
                forwardBody.isEmergency = !!body.isEmergency;
            }
            if (Object.hasOwn(body, 'emergencyUntil')) {
                forwardBody.emergencyUntil = body.emergencyUntil ? Number(body.emergencyUntil) : null;
            }
        }
        if (body.scheduleAt) {
            forwardBody.scheduleAt = body.scheduleAt;
        }
        if (body.expiresAt) {
            forwardBody.expiresAt = body.expiresAt;
        }

        const response = await forwardToDO(env, '/admin/announce', {
            method: request.method,
            json: forwardBody
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Invalid request');
    }
});

export const handleAdminBannedIPs = withAuth(async (_request, env, corsHeaders) => {
    try {
        const response = await forwardToDO(env, '/admin/banned-ips');
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to fetch banned IPs', 500);
    }
});

export const handleAdminUnbanIP = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const ip = body.ip;

        if (!ip) {
            return jsonError(corsHeaders, 'Missing IP address');
        }

        const response = await forwardToDO(env, '/admin/unban-ip', {
            method: 'POST',
            json: { ip }
        });
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to unban IP', 500);
    }
});

export const handleAdminUserDetails = withAuth(async (request, env, corsHeaders) => {
    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            return jsonError(corsHeaders, 'Missing sessionId');
        }

        const response = await forwardToDO(env, `/admin/user-details?sessionId=${encodeURIComponent(sessionId)}`);
        return forwardResponse(response, corsHeaders);
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to fetch user details', 500);
    }
});

export const handleAdminAuditLogs = withAuth(async (_request, env, corsHeaders) => {
    if (!env?.DB_ADMIN) {
        return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const { results } = await env.DB_ADMIN.prepare(
            'SELECT action, details, timestamp, metadata FROM audit_logs ORDER BY timestamp DESC LIMIT 100'
        ).all();

        const logs = (results || []).map(r => ({
            timestamp: r.timestamp,
            action: r.action,
            details: r.details,
            metadata: r.metadata ? JSON.parse(r.metadata) : {}
        }));

        return new Response(JSON.stringify(logs), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to fetch audit logs', 500);
    }
});

export const handleAdminDeleteAuditLogs = withAuth(async (_request, env, corsHeaders) => {
    try {
        if (env?.DB_ADMIN) {
            await env.DB_ADMIN.prepare('DELETE FROM audit_logs').run();
        }
        await forwardToDO(env, '/admin/delete-audit-logs', { method: 'POST' });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to delete audit logs', 500);
    }
});

export const handleAdminChannels = withAuth(async (_request, env, corsHeaders) => {
    try {
        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
        const registry = env.CHANNEL_REGISTRY.get(registryId);
        const resp = await registry.fetch(new Request('https://dummy/admin/channels', {
            headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
        }));
        return new Response(resp.body, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to fetch channels', 500);
    }
});

export const handleAdminChannelDetails = withAuth(async (request, env, corsHeaders) => {
    try {
        const url = new URL(request.url);
        const slug = url.searchParams.get('slug');
        if (!slug) {
            return jsonError(corsHeaders, 'Missing channel slug');
        }

        const response = await forwardToChannelDO(env, slug, '/admin/info');
        return new Response(response.body, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to fetch channel details', 500);
    }
});

export const handleAdminChannelDelete = withAuth(async (request, env, corsHeaders) => {
    try {
        const body = await safeJson(request);
        const slug = body.slug;
        if (!slug) {
            return jsonError(corsHeaders, 'Missing channel slug');
        }

        try {
            await forwardToChannelDO(env, slug, '/admin/force-delete', {
                method: 'POST',
                json: { confirmation: 'FORCE_DELETE_CHANNEL' }
            });
        } catch (_e) { /* expected: DO may already be deleted */ }

        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
        const registry = env.CHANNEL_REGISTRY.get(registryId);
        const resp = await registry.fetch(new Request('https://dummy/admin/channel-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Internal-Token': env.HMAC_SECRET },
            body: JSON.stringify({ slug })
        }));

        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        await logAdminActivity(env, {
            type: 'channel_delete',
            channelSlug: slug,
            ip: clientIP,
            timestamp: Date.now()
        });

        return new Response(resp.body, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (_e) {
        return jsonError(corsHeaders, 'Failed to delete channel', 500);
    }
});
