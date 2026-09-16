import { metrics, API_RATE_LIMIT, AI_SUMMARY, UPLOAD } from './config/constants.js';
import { getCorsHeaders, handleCorsPreflightResponse } from './config/cors.js';
import { forwardToDO } from './utils/do.js';
import { safeJson, readBodyCapped, isBodyTooLargeError } from './utils/helpers.js';
import { createRateLimiter } from './utils/rate-limiter.js';
import { jsonError, textError } from './utils/errors.js';

import * as admin from './handlers/admin.js';
import { handleWebSocket, handleCheckBan } from './handlers/websocket.js';
import { handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe } from './handlers/push.js';
import { handleMetrics, handleHealth } from './handlers/health.js';
import { handleTurnstileVerify, verifyTurnstileTicket } from './handlers/turnstile.js';
import { handlePreview } from './handlers/preview.js';
import { handleSummary } from './handlers/summary.js';

import { logSecurityEvent } from './utils/logger.js';
import * as security from './handlers/security.js';

import { ChatRoom } from './durable-objects/ChatRoom.js';
import { ChannelRegistry } from './durable-objects/ChannelRegistry.js';
import { DeadDropStore } from './durable-objects/DeadDropStore.js';
export { ChatRoom, ChannelRegistry, DeadDropStore };

let _rateLimiter = null;
function checkRateLimit(ip, config, tag = '') {
    if (!_rateLimiter) {
        _rateLimiter = createRateLimiter();
    }
    return _rateLimiter.checkRateLimit(ip, config, tag);
}

const SAFE_HEADERS = ['content-type', 'content-length', 'user-agent', 'accept-language'];

// Channel slugs outside the user namespace (admin/monitoring rooms) skip registry existence checks
const ADMIN_CHANNEL_PREFIXES = ['admin'];

const API_PREFIX = '/api/admin/';

const adminRoutes = [
    ['login', 'POST', admin.handleAdminLogin],
    ['verify', 'POST', admin.handleAdminVerify],
    ['metrics', 'GET', admin.handleAdminMetrics],
    ['sessions', 'GET', admin.handleAdminSessions],
    ['messages', 'GET', admin.handleAdminMessages],
    ['delete-error-logs', 'POST', admin.handleAdminDeleteErrorLogs],
    ['logout', 'POST', admin.handleAdminLogout],
    ['logs', 'GET', admin.handleAdminLogs],
    ['delete-logs', 'POST', admin.handleAdminDeleteLogs],
    ['broadcast', 'POST', admin.handleAdminBroadcast],
    ['edit-message', 'POST', admin.handleAdminEditMessage],
    ['delete-message', 'POST', admin.handleAdminDeleteMessage],
    ['delete-all-messages', 'POST', admin.handleAdminDeleteAllMessages],
    ['kick-user', 'POST', admin.handleAdminKickUser],
    ['announce', ['POST', 'PUT', 'DELETE'], admin.handleAdminAnnounce],
    ['banned-ips', 'GET', admin.handleAdminBannedIPs],
    ['unban-ip', 'POST', admin.handleAdminUnbanIP],
    ['user-details', 'GET', admin.handleAdminUserDetails],
    ['audit-logs', 'GET', admin.handleAdminAuditLogs],
    ['delete-audit-logs', 'POST', admin.handleAdminDeleteAuditLogs],
    ['channels', 'GET', admin.handleAdminChannels],
    ['channel-details', 'GET', admin.handleAdminChannelDetails],
    ['channel-delete', 'POST', admin.handleAdminChannelDelete],
    ['security/events', 'GET', security.handleListEvents],
    ['security/stats', 'GET', security.handleGetStats],
    ['security/risk-ips', 'GET', security.handleGetRiskIPs],
    ['security/events/export', 'GET', security.handleExportCSV],
    ['security/events/clear', 'POST', security.handleClearEvents],
    ['security/badge', 'GET', security.handleGetBadge],
    ['security/block-ip', 'POST', security.handleBlockIP],
    ['observer-ticket', 'POST', admin.handleAdminObserverTicket],
];

async function channelRequest(request, env, corsHeaders, endpoint, method, errorMsg) {
    if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHANNELS, `channel${endpoint}`)) {
        return jsonError('Rate limit exceeded', 429, request.headers.get('Origin'));
    }
    try {
        const body = method === 'GET' ? undefined : await safeJson(request);
        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
        const registry = env.CHANNEL_REGISTRY.get(registryId);
        const fetchOptions = {
            method,
            headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET },
        };
        if (body) {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(body);
        }
        const resp = await registry.fetch(new Request(`https://dummy${endpoint}`, fetchOptions));
        return new Response(resp.body, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error(`Channel ${endpoint} error:`, error);
        return jsonError(errorMsg, 500, request.headers.get('Origin'));
    }
}

async function handleChannelCreate(request, env, corsHeaders) {
    return channelRequest(request, env, corsHeaders, '/create', 'POST', 'Failed to create channel');
}

async function handleChannelJoin(request, env, corsHeaders) {
    return channelRequest(request, env, corsHeaders, '/join', 'POST', 'Failed to join channel');
}

async function handleChannelList(request, env, corsHeaders) {
    return channelRequest(request, env, corsHeaders, '/list', 'GET', 'Failed to list channels');
}

const publicRoutes = [
    ['/api/announcements', 'GET', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.ANNOUNCEMENTS, 'announcements')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        // Announcements are stored in D1 for durable storage (M24)
        try {
            const { results } = await env.DB_ADMIN.prepare(
                'SELECT timestamp, content, is_emergency FROM announcements ORDER BY timestamp DESC LIMIT 100'
            ).all();
            const list = (results || []).map(r => ({
                content: r.content,
                timestamp: r.timestamp,
                isEmergency: !!r.is_emergency
            }));
            return new Response(JSON.stringify(list), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (error) {
            console.error('Announcements D1 read failed:', error);
            const resp = await forwardToDO(env, '/announcement-history');
            return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
    }],
    ['/api/emergency-announcement', 'GET', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.ANNOUNCEMENTS, 'emergency-announcement')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        const resp = await forwardToDO(env, '/emergency-announcement');
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/channels/create', 'POST', handleChannelCreate],
    ['/api/channels/join', 'POST', handleChannelJoin],
    ['/api/channels/list', 'GET', handleChannelList],
    ['/api/push/vapid-key', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.VAPID, 'push:vapid')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return await handleGetVapidKey(req, env, cors);
    }],
    ['/api/push/subscribe', 'POST', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.PUSH, 'push:sub')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return await handlePushSubscribe(req, env, cors);
    }],
    ['/api/push/unsubscribe', 'POST', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.PUSH, 'push:unsub')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return await handlePushUnsubscribe(req, env, cors);
    }],
    ['/api/search', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.SEARCH, 'search')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        const searchPath = '/search' + new URL(req.url).search;
        const resp = await forwardToDO(env, searchPath);
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/check-ban', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'check-ban')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return await handleCheckBan(req, env, cors);
    }],
    ['/api/turnstile/verify', 'POST', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.TURNSTILE, 'turnstile')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return await handleTurnstileVerify(req, env, cors);
    }],
    ['/api/preview', 'POST', handlePreview],
    ['/api/secret-store', 'POST', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'secret')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        try {
            const did = env.DEAD_DROP_STORE.idFromName('singleton');
            const doStub = env.DEAD_DROP_STORE.get(did);
            const body = await readBodyCapped(req, UPLOAD.MAX_BODY_BYTES);
            const resp = await doStub.fetch(new Request('https://dummy/store', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            }));
            const data = await resp.text();
            return new Response(data, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (_error) {
            if (isBodyTooLargeError(_error)) {
                return jsonError('Request too large', 413, req.headers.get('Origin'));
            }
            console.error('Secret store error:', _error);
            return jsonError('Secret store failed', 500, req.headers.get('Origin'));
        }
    }],
    ['/api/secret-read', 'GET', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'secret-read')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        try {
            const did = env.DEAD_DROP_STORE.idFromName('singleton');
            const doStub = env.DEAD_DROP_STORE.get(did);
            const url = new URL(req.url);
            const resp = await doStub.fetch(new Request(`https://dummy/read?id=${url.searchParams.get('id') || ''}`));
            const data = await resp.text();
            return new Response(data, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (_error) {
            console.error('Secret read error:', _error);
            return jsonError('Secret read failed', 500, req.headers.get('Origin'));
        }
    }],
    ['/api/summary', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', AI_SUMMARY.RATE_LIMIT, 'summary')) {
            return jsonError('잠시 후 다시 시도해주세요. (15초에 1회 제한)', 429, req.headers.get('Origin'));
        }
        return await handleSummary(req, env, cors);
    }],
    ['/metrics', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.HEALTH, 'metrics')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return handleMetrics(cors);
    }],
    ['/health', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.HEALTH, 'health')) {
            return jsonError('Rate limit exceeded', 429, req.headers.get('Origin'));
        }
        return handleHealth(cors);
    }],
];

async function serveStaticAssets(request, env, url) {
    if (!env.ASSETS) return null;
    try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status === 200) return assetResponse;
        if (assetResponse.status === 404 && !url.pathname.startsWith('/api')) {
            const indexRequest = new Request(new URL('/index.html', request.url), request);
            return await env.ASSETS.fetch(indexRequest);
        }
        return assetResponse;
    } catch (_e) { /* expected: asset fetch failures */ }
}

function matchRoute(routes, pathname, method) {
    for (const route of routes) {
        const [routePath, routeMethod, handler] = route;
        if (Array.isArray(routeMethod)) {
            if (!routeMethod.includes(method)) continue;
        } else if (routeMethod !== null && routeMethod !== method) {
            continue;
        }
        if (routePath === pathname) return handler;
    }
    return null;
}

/**
 * @typedef {Object} WorkerEnv
 * @property {string} HMAC_SECRET - HMAC key for message integrity
 * @property {DurableObjectNamespace} CHAT_ROOM - ChatRoom DO namespace
 * @property {DurableObjectNamespace} CHANNEL_REGISTRY - ChannelRegistry DO namespace
 * @property {DurableObjectNamespace} DEAD_DROP_STORE - DeadDropStore DO namespace
 * @property {KVNamespace} ADMIN_TOKENS - Admin auth token storage
 * @property {KVNamespace} PUSH_SUBSCRIPTIONS - Web push subscription storage
 * @property {D1Database} DB_ADMIN - Admin audit/error log database
 * @property {Object} AI - Workers AI binding
 * @property {string} ADMIN_ID - Admin account ID
 * @property {string} ADMIN_PASSWORD - Admin account password
 * @property {string} FILE_UPLOAD_URL - External file upload service URL
 * @property {Object} ASSETS - Cloudflare Pages static assets binding
 */

export default {
    /**
     * Main request handler for Cloudflare Pages Functions.
     * Routes requests to static assets, API endpoints, WebSocket upgrades,
     * admin APIs, file upload proxy, and Turnstile verification.
     *
     * @param {Request} request - Incoming HTTP request
     * @param {WorkerEnv} env - Cloudflare bindings and environment variables
     * @param {{waitUntil: function}} _ctx - Execution context
     * @returns {Promise<Response>} HTTP response
     */
    async fetch(request, env, _ctx) {
        try {
            if (!env.HMAC_SECRET) {
                console.error('HMAC_SECRET environment variable is not set');
                return textError('Service configuration error', 500);
            }
            const HMAC_SECRET = env.HMAC_SECRET;
            const url = new URL(request.url);

            if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
            }

            const origin = request.headers.get('Origin');
            const corsHeaders = getCorsHeaders(origin);

            if (request.method === 'OPTIONS') {
                return handleCorsPreflightResponse(corsHeaders);
            }

            // Match admin routes: /api/admin/<name>
            if (url.pathname.startsWith(API_PREFIX)) {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.ADMIN, 'admin')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                const name = url.pathname.slice(API_PREFIX.length);
                let handler = matchRoute(adminRoutes, name, request.method);
                if (!handler && /^security\/events\/\d+$/.test(name)) {
                    handler = security.handleGetEvent;
                }
                if (handler) return await handler(request, env, corsHeaders);
            }

            // Match public routes by exact path
            const handler = matchRoute(publicRoutes, url.pathname, request.method);
            if (handler) return await handler(request, env, corsHeaders);

            // File download proxy (no auth needed, worker adds API_KEY)
            if (url.pathname.startsWith('/api/file/') && request.method === 'GET') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'filedl')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                const fileId = url.pathname.slice('/api/file/'.length);
                if (!fileId || !UPLOAD.FILE_ID_PATTERN.test(fileId)) {
                    return jsonError('Invalid file ID', 400, origin);
                }
                const apiKey = env.FILE_API_KEY;
                if (!apiKey) {
                    return jsonError('File service not configured', 503, origin);
                }
                try {
                    const fileBase = env.FILE_UPLOAD_URL || 'https://file.kalpha.kr/api/files';
                    const fileResp = await fetch(`${fileBase}/${encodeURIComponent(fileId)}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (!fileResp.ok) {
                        return jsonError('File not found', fileResp.status, origin);
                    }
                    const respHeaders = new Headers();
                    const ct = fileResp.headers.get('content-type') || '';
                    if (ct) respHeaders.set('content-type', ct);
                    respHeaders.set('cache-control', 'public, max-age=86400');
                    respHeaders.set('x-content-type-options', 'nosniff');
                    // Only plain raster images may render inline; document types like SVG/HTML/PDF
                    // would execute scripts on this origin (C1), so force them to download.
                    const isRasterImage = /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/i.test(ct);
                    if (!isRasterImage) {
                        // No filename on purpose: the file service sanitizes Korean to underscores in its
                        // Content-Disposition, and browsers prefer any CD filename over the chat link's
                        // `download` attribute. Omitting it lets the original Korean name win (same-origin link).
                        respHeaders.set('content-disposition', 'attachment');
                        respHeaders.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
                    }
                    for (const [k, v] of Object.entries(corsHeaders)) {
                        respHeaders.set(k, v);
                    }
                    return new Response(fileResp.body, { status: 200, headers: respHeaders });
                } catch (_error) {
                    console.error('File download proxy error:', _error);
                    return jsonError('Download failed', 502, origin);
                }
            }

            if (url.pathname === '/api/upload' && request.method === 'POST') {
                    if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'upload')) {
                        return jsonError('Rate limit exceeded', 429, origin);
                }
                let tooLarge = false;
                try {
                    const contentLength = parseInt(request.headers.get('content-length') || '0');
                    if (contentLength > UPLOAD.MAX_BYTES) {
                        return jsonError('File too large (max 100MB)', 413, origin);
                    }
                    const uploadUrl = env.FILE_UPLOAD_URL || 'https://file.kalpha.kr/api/files';
                    const apiKey = env.FILE_API_KEY;
                    // Forward only expected headers to the file service (never the client's full header set)
                    const fetchHeaders = new Headers();
                    const contentType = request.headers.get('content-type');
                    if (contentType) {
                        fetchHeaders.set('Content-Type', contentType);
                    }
                    if (contentLength > 0) {
                        fetchHeaders.set('Content-Length', String(contentLength));
                    }
                    if (apiKey) {
                        fetchHeaders.set('Authorization', `Bearer ${apiKey}`);
                    }

                    // Enforce the real byte cap while streaming (Content-Length alone can be absent or spoofed)
                    let counted = 0;
                    const { readable, writable } = new TransformStream({
                        transform(chunk, controller) {
                            counted += chunk.byteLength;
                            if (counted > UPLOAD.MAX_BYTES) {
                                tooLarge = true;
                                controller.error(new Error('File too large'));
                                return;
                            }
                            controller.enqueue(chunk);
                        }
                    });
                    if (request.body) {
                        request.body.pipeTo(writable).catch(() => { /* surfaced via upstream fetch failure */ });
                    }

                    const upstreamResponse = await fetch(uploadUrl, {
                        method: 'POST',
                        body: request.body ? readable : undefined,
                        headers: fetchHeaders
                    });
                    if (!upstreamResponse.ok) {
                        const errBody = await upstreamResponse.text();
                        return new Response(errBody, {
                            status: upstreamResponse.status,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }
                    const result = await upstreamResponse.json();
                    if (result.success && result.data) {
                        const d = result.data;
                        const origin = new URL(request.url).origin;
                        return new Response(JSON.stringify({
                            full_url: `${origin}/api/file/${d.id}`,
                            filename: d.originalFilename,
                            filesize: d.size,
                            filetype: d.contentType || 'application/octet-stream'
                        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }
                    return new Response(JSON.stringify({ error: 'Unexpected upload response' }), {
                        status: 502,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (_error) {
                    if (tooLarge) {
                        return jsonError('File too large (max 100MB)', 413, origin);
                    }
                    console.error('File upload proxy error:', _error);
                    return jsonError('Upload proxy failed', 502, origin);
                }
            }

            // Client error log forwarding
            if (url.pathname === '/api/logs/error' && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'errorlog')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                let body;
                try {
                    body = await readBodyCapped(request, UPLOAD.MAX_BODY_BYTES);
                } catch (error) {
                    if (isBodyTooLargeError(error)) {
                        return jsonError('Request too large', 413, origin);
                    }
                    throw error;
                }
                const filteredHeaders = {};
                for (const h of SAFE_HEADERS) {
                    const val = request.headers.get(h);
                    if (val) filteredHeaders[h] = val;
                }
                const resp = await forwardToDO(env, '/api/logs/error', {
                    method: 'POST', headers: filteredHeaders, body
                });
                return new Response(resp.body, { status: resp.status, headers: corsHeaders });
            }

            // Config endpoint
            if (url.pathname === '/api/config') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CONFIG, 'config')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                if (!env.TURNSTILE_SITE_KEY) {
                    return jsonError('Turnstile not configured', 503, origin);
                }
                return new Response(JSON.stringify({
                    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
                    fileUploadUrl: env.FILE_UPLOAD_URL || null,
                    kalphaApiUrl: env.KALPHA_API_URL || null
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // WebSocket
            if (url.pathname === '/ws') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.WS, 'ws')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                // Turnstile gate: anonymous sessions must present a valid ticket issued by /api/turnstile/verify
                const wsSessionId = url.searchParams.get('sessionId') || '';
                const isObserverSession = wsSessionId.startsWith('admin_obs_');
                if (!isObserverSession) {
                    if (!env.TURNSTILE_SECRET_KEY) {
                        // ponytail: unverifiable config (local dev without secret) — fail-open with a loud warning
                        console.warn('Turnstile not configured; skipping WS ticket verification');
                    } else {
                        const ticketOk = await verifyTurnstileTicket(env, url.searchParams.get('ticket') || '', wsSessionId);
                        if (!ticketOk) {
                            return jsonError('Turnstile verification required', 403, origin);
                        }
                    }
                }
                // Never upgrade into a channel that is not in the registry (e.g. deleted by admin)
                const channelSlug = url.searchParams.get('channel');
                if (channelSlug && channelSlug !== '0' && !ADMIN_CHANNEL_PREFIXES.some((prefix) => channelSlug.startsWith(prefix))) {
                    try {
                        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
                        const registry = env.CHANNEL_REGISTRY.get(registryId);
                        const registryResp = await registry.fetch(new Request('https://dummy/get', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ slug: channelSlug })
                        }));
                        const registryData = await registryResp.json();
                        if (!registryData.found) {
                            return jsonError('Channel not found', 404, origin);
                        }
                    } catch (error) {
                        // Fail-open: a registry outage must not block chat connectivity
                        console.error('Channel registry check failed, continuing:', error);
                    }
                }
                return await handleWebSocket(request, env, HMAC_SECRET);
            }

            // Static assets
            const staticResponse = await serveStaticAssets(request, env, url);
            if (staticResponse) return staticResponse;

            await logSecurityEvent(env, 'ENDPOINT_SCAN', {
                ip: request.headers.get('CF-Connecting-IP') || 'unknown',
                path: url.pathname,
                method: request.method,
                userAgent: request.headers.get('User-Agent'),
                country: request.headers.get('CF-IPCountry') || null,
                details: `Unknown endpoint: ${request.method} ${url.pathname}`,
            });

            return new Response('Not Found', { status: 404 });

        } catch (_error) {
            metrics.errors++;
            console.error('Worker error:', _error);
            return textError('Internal Server Error', 500);
        }
    }
};
