import { metrics, API_RATE_LIMIT, AI_SUMMARY, UPLOAD } from './config/constants.js';
import { getCorsHeaders, handleCorsPreflightResponse } from './config/cors.js';
import { forwardToDO } from './utils/do.js';
import { safeJson } from './utils/helpers.js';
import { createRateLimiter } from './utils/rate-limiter.js';
import { jsonError, textError } from './utils/errors.js';

import * as admin from './handlers/admin.js';
import { handleWebSocket, handleCheckBan } from './handlers/websocket.js';
import { handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe } from './handlers/push.js';
import { handleMetrics, handleHealth } from './handlers/health.js';
import { handleTurnstileVerify } from './handlers/turnstile.js';
import { handlePreview } from './handlers/preview.js';
import { handleSummary } from './handlers/summary.js';

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

const API_PREFIX = '/api/admin/';

const adminRoutes = [
    ['login', null, admin.handleAdminLogin],
    ['verify', null, admin.handleAdminVerify],
    ['metrics', null, admin.handleAdminMetrics],
    ['sessions', null, admin.handleAdminSessions],
    ['messages', null, admin.handleAdminMessages],
    ['delete-error-logs', null, admin.handleAdminDeleteErrorLogs],
    ['logout', null, admin.handleAdminLogout],
    ['logs', null, admin.handleAdminLogs],
    ['delete-logs', 'POST', admin.handleAdminDeleteLogs],
    ['broadcast', null, admin.handleAdminBroadcast],
    ['edit-message', null, admin.handleAdminEditMessage],
    ['delete-message', null, admin.handleAdminDeleteMessage],
    ['delete-all-messages', null, admin.handleAdminDeleteAllMessages],
    ['kick-user', null, admin.handleAdminKickUser],
    ['announce', null, admin.handleAdminAnnounce],
    ['banned-ips', null, admin.handleAdminBannedIPs],
    ['unban-ip', null, admin.handleAdminUnbanIP],
    ['user-details', null, admin.handleAdminUserDetails],
    ['audit-logs', null, admin.handleAdminAuditLogs],
    ['delete-audit-logs', 'POST', admin.handleAdminDeleteAuditLogs],
    ['channels', null, admin.handleAdminChannels],
    ['channel-details', null, admin.handleAdminChannelDetails],
    ['channel-delete', 'POST', admin.handleAdminChannelDelete],
];

async function channelRequest(request, env, corsHeaders, endpoint, method, errorMsg) {
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
        const resp = await forwardToDO(env, '/announcement-history');
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/emergency-announcement', 'GET', async (req, env, cors) => {
        const resp = await forwardToDO(env, '/emergency-announcement');
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/channels/create', 'POST', handleChannelCreate],
    ['/api/channels/join', 'POST', handleChannelJoin],
    ['/api/channels/list', 'GET', handleChannelList],
    ['/api/push/vapid-key', null, handleGetVapidKey],
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
        const searchPath = '/search' + new URL(req.url).search;
        const resp = await forwardToDO(env, searchPath);
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/check-ban', null, handleCheckBan],
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
            const body = await req.text();
            const resp = await doStub.fetch(new Request('https://dummy/store', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            }));
            const data = await resp.text();
            return new Response(data, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (_error) {
            console.error('Secret store error:', _error);
            return jsonError('Secret store failed', 500, req.headers.get('Origin'));
        }
    }],
    ['/api/secret-read', 'GET', async (req, env, cors) => {
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
        if (routeMethod !== null && routeMethod !== method) continue;
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

            if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
                return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
            }

            const origin = request.headers.get('Origin');
            const corsHeaders = getCorsHeaders(origin);

            if (request.method === 'OPTIONS') {
                return handleCorsPreflightResponse(corsHeaders);
            }

            // Match admin routes: /api/admin/<name>
            if (url.pathname.startsWith(API_PREFIX)) {
                const name = url.pathname.slice(API_PREFIX.length);
                const handler = matchRoute(adminRoutes, name, request.method);
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
                if (!fileId || !/^[a-f0-9-]{32,36}$/.test(fileId)) {
                    return jsonError('Invalid file ID', 400, origin);
                }
                const apiKey = env.FILE_API_KEY;
                if (!apiKey) {
                    return jsonError('File service not configured', 503, origin);
                }
                try {
                    const fileResp = await fetch(`https://file.kalpha.kr/api/files/${encodeURIComponent(fileId)}`, {
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
                    const cd = fileResp.headers.get('content-disposition');
                    const isInline = /^image\//.test(ct) || /^video\//.test(ct) || /^audio\//.test(ct) || /^application\/pdf/.test(ct);
                    if (cd && !isInline) {
                        respHeaders.set('content-disposition', cd);
                    } else if (!cd && !isInline) {
                        respHeaders.set('content-disposition', 'attachment');
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

            // Chunked upload proxy routes (file.kalpha.kr)
            if (url.pathname === '/api/upload/init' && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'upload')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                const apiKey = env.FILE_API_KEY;
                if (!apiKey) return jsonError('File service not configured', 503, origin);
                try {
                    const body = await safeJson(request);
                    if (!body.filename || !body.totalSize) {
                        return jsonError('Missing filename or totalSize', 400, origin);
                    }
                    const resp = await fetch('https://file.kalpha.kr/api/files/chunked/init', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify(body)
                    });
                    const data = await resp.text();
                    return new Response(data, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                } catch (_error) {
                    console.error('Chunked init error:', _error);
                    return jsonError('Upload init failed', 502, origin);
                }
            }

            const chunkPartMatch = url.pathname.match(/^\/api\/upload\/([^/]+)\/part$/);
            if (chunkPartMatch && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'upload')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                const uploadId = chunkPartMatch[1];
                const partNumber = url.searchParams.get('partNumber');
                const fileId = url.searchParams.get('fileId');
                const apiKey = env.FILE_API_KEY;
                if (!apiKey) return jsonError('File service not configured', 503, origin);
                if (!partNumber || !fileId) return jsonError('Missing partNumber or fileId', 400, origin);
                try {
                    const chunkUrl = `https://file.kalpha.kr/api/files/chunked/${encodeURIComponent(uploadId)}/part?partNumber=${encodeURIComponent(partNumber)}&fileId=${encodeURIComponent(fileId)}`;
                    const resp = await fetch(chunkUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/octet-stream', 'Authorization': `Bearer ${apiKey}` },
                        body: request.body
                    });
                    const data = await resp.text();
                    return new Response(data, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                } catch (_error) {
                    console.error('Chunked part error:', _error);
                    return jsonError('Upload part failed', 502, origin);
                }
            }

            const chunkCompleteMatch = url.pathname.match(/^\/api\/upload\/([^/]+)\/complete$/);
            if (chunkCompleteMatch && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'upload')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                const uploadId = chunkCompleteMatch[1];
                const apiKey = env.FILE_API_KEY;
                if (!apiKey) return jsonError('File service not configured', 503, origin);
                try {
                    const body = await safeJson(request);
                    if (!body.fileId || !body.parts) {
                        return jsonError('Missing fileId or parts', 400, origin);
                    }
                    const completeBody = JSON.stringify(body);
                    console.error('[chunk-complete]', uploadId.substring(0, 16), completeBody.substring(0, 300));
                    const resp = await fetch(`https://file.kalpha.kr/api/files/chunked/${encodeURIComponent(uploadId)}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: completeBody
                    });
                    if (!resp.ok) {
                        const errBody = await resp.text();
                        return new Response(errBody, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }
                    const result = await resp.json();
                    if (result.success && result.data) {
                        const d = result.data;
                        const uploadOrigin = new URL(request.url).origin;
                        return new Response(JSON.stringify({
                            full_url: `${uploadOrigin}/api/file/${d.id}`,
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
                    console.error('Chunked complete error:', _error);
                    return jsonError('Upload complete failed', 502, origin);
                }
            }

            if (url.pathname === '/api/upload' && request.method === 'POST') {
                    if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'upload')) {
                        return jsonError('Rate limit exceeded', 429, origin);
                }
                try {
                    const contentLength = parseInt(request.headers.get('content-length') || '0');
                    if (contentLength > UPLOAD.MAX_BYTES) {
                        return jsonError('File too large (max 250MB)', 413, origin);
                    }
                    const uploadUrl = env.FILE_UPLOAD_URL || 'https://file.kalpha.kr/api/files';
                    const apiKey = env.FILE_API_KEY;
                    const fetchHeaders = new Headers(request.headers);
                    if (apiKey) {
                        fetchHeaders.set('Authorization', `Bearer ${apiKey}`);
                    }
                    const upstreamResponse = await fetch(uploadUrl, {
                        method: 'POST',
                        body: request.body,
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
                    console.error('File upload proxy error:', _error);
                    return jsonError('Upload proxy failed', 502, origin);
                }
            }

            // Client error log forwarding
            if (url.pathname === '/api/logs/error' && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'errorlog')) {
                    return jsonError('Rate limit exceeded', 429, origin);
                }
                const body = await request.text();
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
                return await handleWebSocket(request, env, HMAC_SECRET);
            }

            // Static assets
            const staticResponse = await serveStaticAssets(request, env, url);
            if (staticResponse) return staticResponse;

            return new Response('Not Found', { status: 404 });

        } catch (_error) {
            metrics.errors++;
            console.error('Worker error:', _error);
            return textError('Internal Server Error', 500);
        }
    }
};
