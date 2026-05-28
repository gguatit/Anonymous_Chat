import { metrics, API_RATE_LIMIT } from './config/constants.js';
import { getCorsHeaders, handleCorsPreflightResponse } from './config/cors.js';
import { AI_SUMMARY } from './config/constants.js';
import { forwardToDO } from './utils/do.js';
import { safeJson } from './utils/helpers.js';

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

const rateLimitMap = new Map();

function checkRateLimit(ip, config, tag = '') {
    const key = tag ? `${ip}:${tag}` : ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now - entry.windowStart > config.windowMs) {
        rateLimitMap.set(key, { windowStart: now, count: 1 });
        return true;
    }
    if (entry.count >= config.max) {
        return false;
    }
    entry.count++;
    return true;
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
        return new Response(JSON.stringify({ error: errorMsg }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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
            return new Response('Rate limit exceeded', { status: 429, headers: cors });
        }
        return await handlePushSubscribe(req, env, cors);
    }],
    ['/api/push/unsubscribe', 'POST', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.PUSH, 'push:unsub')) {
            return new Response('Rate limit exceeded', { status: 429, headers: cors });
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
            return new Response('Rate limit exceeded', { status: 429, headers: cors });
        }
        return await handleTurnstileVerify(req, env, cors);
    }],
    ['/api/preview', 'POST', handlePreview],
    ['/api/secret-store', 'POST', async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'secret')) {
            return new Response('Rate limit exceeded', { status: 429, headers: cors });
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
            return new Response(JSON.stringify({ error: 'Secret store failed' }), {
                status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
            });
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
            return new Response(JSON.stringify({ error: 'Secret read failed' }), {
                status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
    }],
    ['/api/summary', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', AI_SUMMARY.RATE_LIMIT, 'summary')) {
            return new Response(JSON.stringify({ error: '잠시 후 다시 시도해주세요. (15초에 1회 제한)' }), {
                status: 429, headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }
        return await handleSummary(req, env, cors);
    }],
    ['/metrics', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.HEALTH, 'metrics')) {
            return new Response('Rate limit exceeded', { status: 429, headers: cors });
        }
        return handleMetrics(cors);
    }],
    ['/health', null, async (req, env, cors) => {
        if (!checkRateLimit(req.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.HEALTH, 'health')) {
            return new Response('Rate limit exceeded', { status: 429, headers: cors });
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

export default {
    async fetch(request, env, _ctx) {
        try {
            if (!env.HMAC_SECRET) {
                console.error('HMAC_SECRET environment variable is not set');
                return new Response('Service configuration error', { status: 500 });
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

            if (url.pathname === '/api/upload' && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.UPLOAD, 'upload')) {
                    return new Response('Rate limit exceeded', { status: 429, headers: corsHeaders });
                }
                try {
                    const contentLength = parseInt(request.headers.get('content-length') || '0');
                    if (contentLength > 50 * 1024 * 1024) {
                        return new Response(JSON.stringify({ error: 'File too large (max 50MB)' }), {
                            status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }
                    const uploadUrl = env.FILE_UPLOAD_URL || 'https://file.xeon.kr/upload';
                    const upstreamResponse = await fetch(uploadUrl, {
                        method: 'POST',
                        body: request.body,
                        headers: request.headers
                    });
                    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
                    return new Response(upstreamResponse.body, {
                        status: upstreamResponse.status,
                        headers: { ...corsHeaders, 'Content-Type': contentType }
                    });
                } catch (_error) {
                    console.error('File upload proxy error:', _error);
                    return new Response(JSON.stringify({ error: 'Upload proxy failed' }), {
                        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // Client error log forwarding
            if (url.pathname === '/api/logs/error' && request.method === 'POST') {
                if (!checkRateLimit(request.headers.get('CF-Connecting-IP') || 'unknown', API_RATE_LIMIT.CHECK_BAN, 'errorlog')) {
                    return new Response('Rate limit exceeded', { status: 429, headers: corsHeaders });
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
                    return new Response('Rate limit exceeded', { status: 429, headers: corsHeaders });
                }
                if (!env.TURNSTILE_SITE_KEY) {
                    return new Response(JSON.stringify({ error: 'Turnstile not configured' }), {
                        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
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
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};
