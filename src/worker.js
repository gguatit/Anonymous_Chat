// Cloudflare Worker with Durable Objects for Anonymous Chat

// Import configuration
import { metrics } from './config/constants.js';
import { getCorsHeaders, handleCorsPreflightResponse } from './config/cors.js';

// Import handlers
import {
    handleAdminLogin,
    handleAdminVerify,
    handleAdminMetrics,
    handleAdminSessions,
    handleAdminMessages,
    handleAdminLogout,
    handleAdminLogs,
    handleAdminBroadcast,
    handleAdminEditMessage,
    handleAdminDeleteMessage,
    handleAdminDeleteAllMessages,
    handleAdminDeleteErrorLogs,
    handleAdminKickUser,
    handleAdminAnnounce,
    handleAdminBannedIPs,
    handleAdminUnbanIP,
    handleAdminUserDetails,
    handleAdminAuditLogs
} from './handlers/admin.js';
import { handleWebSocket, handleCheckBan } from './handlers/websocket.js';
import { handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe } from './handlers/push.js';
import { handleMetrics, handleHealth } from './handlers/health.js';

// Import Durable Object
import { ChatRoom } from './durable-objects/ChatRoom.js';

// Export Durable Object class
export { ChatRoom };

export default {
    async fetch(request, env, ctx) {
        try {
            // HMAC secret is required for message integrity
            if (!env.HMAC_SECRET) {
                console.error('HMAC_SECRET environment variable is not set');
                return new Response('Service configuration error', { status: 500 });
            }
            const HMAC_SECRET = env.HMAC_SECRET;

            const url = new URL(request.url);

            // Force HTTPS redirect in production
            if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
                return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
            }

            // CORS 보안 강화: 허용된 도메인만 접근 허용
            const origin = request.headers.get('Origin');
            const corsHeaders = getCorsHeaders(origin);

            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return handleCorsPreflightResponse(corsHeaders);
            }

            // Admin API endpoints
            if (url.pathname === '/api/admin/login') {
                return await handleAdminLogin(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/verify') {
                return await handleAdminVerify(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/metrics') {
                return await handleAdminMetrics(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/sessions') {
                return await handleAdminSessions(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/messages') {
                return await handleAdminMessages(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/delete-error-logs') {
                return await handleAdminDeleteErrorLogs(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/logout') {
                return await handleAdminLogout(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/logs') {
                return await handleAdminLogs(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/broadcast') {
                return await handleAdminBroadcast(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/edit-message') {
                return await handleAdminEditMessage(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/delete-message') {
                return await handleAdminDeleteMessage(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/delete-all-messages') {
                return await handleAdminDeleteAllMessages(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/kick-user') {
                return await handleAdminKickUser(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/announce') {
                return await handleAdminAnnounce(request, env, corsHeaders);
            }

            // Public: announcement history (no auth required)
            if (url.pathname === '/api/announcements' && request.method === 'GET') {
                const id = env.CHAT_ROOM.idFromName('main-room');
                const room = env.CHAT_ROOM.get(id);
                const forward = new Request('https://dummy/announcement-history');
                const response = await room.fetch(forward);
                return new Response(response.body, {
                    status: response.status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            if (url.pathname === '/api/admin/banned-ips') {
                return await handleAdminBannedIPs(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/unban-ip') {
                return await handleAdminUnbanIP(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/user-details') {
                return await handleAdminUserDetails(request, env, corsHeaders);
            }
            if (url.pathname === '/api/admin/audit-logs') {
                return await handleAdminAuditLogs(request, env, corsHeaders);
            }

            // Push notification endpoints
            if (url.pathname === '/api/push/vapid-key') {
                return await handleGetVapidKey(request, env, corsHeaders);
            }
            if (url.pathname === '/api/push/subscribe') {
                return await handlePushSubscribe(request, env, corsHeaders);
            }
            if (url.pathname === '/api/push/unsubscribe') {
                return await handlePushUnsubscribe(request, env, corsHeaders);
            }

            // Client Error logging endpoint
            if (url.pathname === '/api/logs/error' && request.method === 'POST') {
                const id = env.CHAT_ROOM.idFromName('global-room');
                const room = env.CHAT_ROOM.get(id);
                // 중요 보안 패치: 클라이언트가 보낸 url을 그대로 넘기지 않고, 명시적으로 '/api/logs/error' 경로로 새로 만들어서 fetch
                const logRequest = new Request('https://dummy/api/logs/error', {
                    method: 'POST',
                    headers: request.headers,
                    body: request.body
                });
                const response = await room.fetch(logRequest);
                return new Response(response.body, {
                    status: response.status,
                    headers: corsHeaders
                });
            }

            // Check IP ban status
            if (url.pathname === '/api/check-ban') {
                return await handleCheckBan(request, env, corsHeaders);
            }

            // WebSocket upgrade request
            if (url.pathname === '/ws') {
                return await handleWebSocket(request, env, HMAC_SECRET);
            }

            // Metrics endpoint (minimal anonymous data)
            if (url.pathname === '/metrics') {
                return handleMetrics(corsHeaders);
            }

            // Health check endpoint
            if (url.pathname === '/health') {
                return handleHealth(corsHeaders);
            }

            // Serve static files from assets binding
            if (env.ASSETS) {
                try {
                    // Try to fetch the requested asset
                    const assetResponse = await env.ASSETS.fetch(request);

                    // If asset found, return it
                    if (assetResponse.status === 200) {
                        return assetResponse;
                    }

                    // For SPA routing: if not found and not an API endpoint, serve index.html
                    if (assetResponse.status === 404 && !url.pathname.startsWith('/api')) {
                        const indexRequest = new Request(new URL('/index.html', request.url), request);
                        return await env.ASSETS.fetch(indexRequest);
                    }

                    return assetResponse;
                } catch (e) {
                    console.log('Asset fetch error:', e);
                }
            }

            // Fallback 404
            return new Response('Not Found', { status: 404 });

        } catch (error) {
            metrics.errors++;
            console.error('Worker error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};
