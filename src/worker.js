import { metrics } from './config/constants.js';
import { getCorsHeaders, handleCorsPreflightResponse } from './config/cors.js';
import { forwardToDO } from './utils/do.js';

import * as admin from './handlers/admin.js';
import { handleWebSocket, handleCheckBan } from './handlers/websocket.js';
import { handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe } from './handlers/push.js';
import { handleMetrics, handleHealth } from './handlers/health.js';
import { handleTurnstileVerify } from './handlers/turnstile.js';
import { handlePreview } from './handlers/preview.js';

import { ChatRoom } from './durable-objects/ChatRoom.js';
import { ChannelRegistry } from './durable-objects/ChannelRegistry.js';
export { ChatRoom, ChannelRegistry };

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
];

async function handleChannelCreate(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
        const registry = env.CHANNEL_REGISTRY.get(registryId);
        const resp = await registry.fetch(new Request('https://dummy/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Internal-Token': env.HMAC_SECRET },
            body: JSON.stringify(body)
        }));
        return new Response(resp.body, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Channel create error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create channel' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleChannelJoin(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
        const registry = env.CHANNEL_REGISTRY.get(registryId);
        const resp = await registry.fetch(new Request('https://dummy/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Internal-Token': env.HMAC_SECRET },
            body: JSON.stringify(body)
        }));
        return new Response(resp.body, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Channel join error:', error);
        return new Response(JSON.stringify({ error: 'Failed to join channel' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleChannelList(request, env, corsHeaders) {
    try {
        const registryId = env.CHANNEL_REGISTRY.idFromName('registry');
        const registry = env.CHANNEL_REGISTRY.get(registryId);
        const resp = await registry.fetch(new Request('https://dummy/list', {
            method: 'GET',
            headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
        }));
        return new Response(resp.body, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Channel list error:', error);
        return new Response(JSON.stringify({ error: 'Failed to list channels' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

const publicRoutes = [
    ['/api/announcements', 'GET', async (req, env, cors) => {
        const resp = await forwardToDO(env, '/announcement-history');
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/channels/create', 'POST', handleChannelCreate],
    ['/api/channels/join', 'POST', handleChannelJoin],
    ['/api/channels/list', 'GET', handleChannelList],
    ['/api/push/vapid-key', null, handleGetVapidKey],
    ['/api/push/subscribe', 'POST', handlePushSubscribe],
    ['/api/push/unsubscribe', 'POST', handlePushUnsubscribe],
    ['/api/search', null, async (req, env, cors) => {
        const searchPath = '/search' + new URL(req.url).search;
        const resp = await forwardToDO(env, searchPath);
        return new Response(resp.body, { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }],
    ['/api/check-ban', null, handleCheckBan],
    ['/api/turnstile/verify', 'POST', handleTurnstileVerify],
    ['/api/preview', 'POST', handlePreview],
    ['/metrics', null, handleMetrics],
    ['/health', null, handleHealth],
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
    } catch {
        return null;
    }
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

            // File upload proxy
            if (url.pathname === '/api/upload' && request.method === 'POST') {
                try {
                    const formData = await request.formData();
                    const upstreamResponse = await fetch('https://file.xeon.kr/upload', { method: 'POST', body: formData });
                    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
                    return new Response(upstreamResponse.body, {
                        status: upstreamResponse.status,
                        headers: { ...corsHeaders, 'Content-Type': contentType }
                    });
                } catch (error) {
                    console.error('File upload proxy error:', error);
                    return new Response(JSON.stringify({ error: 'Upload proxy failed' }), {
                        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // Client error log forwarding
            if (url.pathname === '/api/logs/error' && request.method === 'POST') {
                const body = await request.text();
                const resp = await forwardToDO(env, '/api/logs/error', {
                    method: 'POST', headers: { ...Object.fromEntries(request.headers) }, body
                });
                return new Response(resp.body, { status: resp.status, headers: corsHeaders });
            }

            // Config endpoint
            if (url.pathname === '/api/config') {
                return new Response(JSON.stringify({
                    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '0x4AAAAAADAY6kk52-ZxU23s'
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

        } catch (error) {
            metrics.errors++;
            console.error('Worker error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};
