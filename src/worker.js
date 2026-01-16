// Cloudflare Worker with Durable Objects for Anonymous Chat

// Rate limiting configuration
const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 5,
    MESSAGE_COOLDOWN: 1000, // 1 second between messages
};

// Security configuration
const SECURITY = {
    MAX_MESSAGE_LENGTH: 5000,
    BANNED_IPS: new Set(), // Can be populated from KV or environment
    IP_WHITELIST: null, // null means all IPs allowed
    ALLOWED_ORIGINS: ['https://kalpha.mmv.kr'], // Production domain
};

// Metrics storage (in-memory, per-worker instance)
const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    errors: 0,
};

export default {
    async fetch(request, env, ctx) {
        try {
            // Get HMAC secret from environment variable or generate random for development
            const HMAC_SECRET = env.HMAC_SECRET || crypto.randomUUID();
            
            const url = new URL(request.url);

            // Force HTTPS redirect in production
            if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
                return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
            }

            // CORS 보안 강화: 허용된 도메인만 접근 허용
            const origin = request.headers.get('Origin');
            const allowedOrigins = [
                'https://kalpha.mmv.kr',
                'http://localhost:8787',
                'http://127.0.0.1:8787'
            ];
            const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
            
            const corsHeaders = {
                'Access-Control-Allow-Origin': corsOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true',
            };

            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return new Response(null, { headers: corsHeaders });
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

            if (url.pathname === '/api/admin/kick-user') {
                return await handleAdminKickUser(request, env, corsHeaders);
            }

            if (url.pathname === '/api/admin/announce') {
                return await handleAdminAnnounce(request, env, corsHeaders);
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
                return new Response(JSON.stringify({
                    timestamp: Date.now(),
                    activeConnections: metrics.activeConnections,
                    totalMessages: metrics.totalMessages,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Health check endpoint
            if (url.pathname === '/health') {
                return new Response(JSON.stringify({ status: 'healthy' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
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

async function handleWebSocket(request, env, HMAC_SECRET) {
    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Verify Origin header to prevent CSRF attacks
    const origin = request.headers.get('Origin');
    if (origin && SECURITY.ALLOWED_ORIGINS && !isAllowedOrigin(origin)) {
        console.warn('Blocked WebSocket from unauthorized origin:', origin);
        return new Response('Unauthorized Origin', { status: 403 });
    }

    // Get client IP for rate limiting and access control
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // IP-based access control
    if (SECURITY.BANNED_IPS.has(clientIP)) {
        return new Response('Access Denied', { status: 403 });
    }

    if (SECURITY.IP_WHITELIST && !SECURITY.IP_WHITELIST.has(clientIP)) {
        return new Response('Access Denied', { status: 403 });
    }

    // Extract sessionId from URL query parameters
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    // Check ban status BEFORE allowing WebSocket connection
    if (sessionId || clientIP !== 'unknown') {
        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);
        
        // Build check URL
        let checkUrl = `https://dummy/check-ban?ip=${encodeURIComponent(clientIP)}`;
        if (sessionId) {
            checkUrl += `&sessionId=${encodeURIComponent(sessionId)}`;
        }
        
        // Check ban status synchronously
        const checkRequest = new Request(checkUrl, {
            headers: {
                'X-HMAC-Secret': HMAC_SECRET,
                'CF-Connecting-IP': clientIP
            }
        });
        
        try {
            const banCheckResponse = await room.fetch(checkRequest);
            const banStatus = await banCheckResponse.json();
            
            if (banStatus.banned) {
                console.log(`Blocked WebSocket connection - banned: IP=${clientIP}, SessionID=${sessionId}`);
                return new Response('Access Denied - You are banned', { 
                    status: 403,
                    statusText: `Banned for ${banStatus.remainingSeconds} seconds`
                });
            }
        } catch (error) {
            console.error('Error checking ban status:', error);
            // Continue with connection on error to avoid blocking legitimate users
        }
    }

    // Get or create the Durable Object for the chat room
    const roomId = env.CHAT_ROOM.idFromName('main-room');
    const room = env.CHAT_ROOM.get(roomId);

    // Forward the request to the Durable Object with HMAC_SECRET in headers
    const modifiedRequest = new Request(request, {
        headers: {
            ...Object.fromEntries(request.headers),
            'X-HMAC-Secret': HMAC_SECRET
        }
    });
    return room.fetch(modifiedRequest);
}

// Check if origin is allowed
function isAllowedOrigin(origin) {
    try {
        const url = new URL(origin);
        // In development, allow localhost
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return true;
        }
        // In production, check against allowed origins
        return SECURITY.ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    } catch {
        return false;
    }
}

// ========== 보안 유틸리티 함수 ==========

// Sleep 함수 (타이밍 공격 방지용)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 상수 시간 비교 (타이밍 공격 방지)
async function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    
    // 길이가 다르면 항상 false지만, 타이밍 공격 방지를 위해 전체 비교
    const maxLen = Math.max(aBytes.length, bBytes.length);
    let result = aBytes.length === bBytes.length ? 0 : 1;
    
    for (let i = 0; i < maxLen; i++) {
        const aByte = i < aBytes.length ? aBytes[i] : 0;
        const bByte = i < bBytes.length ? bBytes[i] : 0;
        result |= aByte ^ bByte;
    }
    
    return result === 0;
}

// Rate Limit 체크 (IP당 5회 실패 시 5분간 차단)
async function checkRateLimit(env, key) {
    if (!env?.ADMIN_TOKENS) return false;
    
    const data = await env.ADMIN_TOKENS.get(key);
    if (!data) return false;
    
    try {
        const attempts = JSON.parse(data);
        const now = Date.now();
        
        // 5분 이내에 5회 이상 실패
        const recentAttempts = attempts.filter(t => now - t < 5 * 60 * 1000);
        return recentAttempts.length >= 5;
    } catch {
        return false;
    }
}

// Rate Limit 증가
async function incrementRateLimit(env, key) {
    if (!env?.ADMIN_TOKENS) return;
    
    try {
        const data = await env.ADMIN_TOKENS.get(key);
        const attempts = data ? JSON.parse(data) : [];
        const now = Date.now();
        
        // 5분 이내의 시도만 유지
        const recentAttempts = attempts.filter(t => now - t < 5 * 60 * 1000);
        recentAttempts.push(now);
        
        // 10분간 보관 (5분 차단 + 여유)
        await env.ADMIN_TOKENS.put(key, JSON.stringify(recentAttempts), {
            expirationTtl: 10 * 60
        });
    } catch (error) {
        console.error('Rate limit error:', error);
    }
}

// Admin Authentication Handlers
async function handleAdminLogin(request, env, corsHeaders) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const timestamp = Date.now();
    
    try {
        // Rate Limiting 체크 (브루트포스 방지)
        const rateLimitKey = `ratelimit:${clientIP}`;
        const isBlocked = await checkRateLimit(env, rateLimitKey);
        
        if (isBlocked) {
            await logAdminActivity(env, {
                type: 'login_blocked',
                reason: 'rate_limit_exceeded',
                ip: clientIP,
                timestamp
            });
            
            // 타이밍 공격 방지: 일정 시간 대기
            await sleep(1000);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Too many login attempts. Please try again later.'
            }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        const { id, password } = await request.json();
        
        // 환경변수 필수 체크 (하드코딩 완전 제거)
        if (!env.ADMIN_ID || !env.ADMIN_PASSWORD) {
            await logAdminActivity(env, {
                type: 'login_failed',
                reason: 'credentials_not_configured',
                ip: clientIP,
                timestamp
            });
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Admin credentials not configured'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        const ADMIN_ID = env.ADMIN_ID;
        const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
        
        // 타이밍 공격 방지: 상수 시간 비교
        const idMatch = await constantTimeCompare(id, ADMIN_ID);
        const passwordMatch = await constantTimeCompare(password, ADMIN_PASSWORD);
        
        if (idMatch && passwordMatch) {
            // Rate limit 초기화
            if (env?.ADMIN_TOKENS) {
                await env.ADMIN_TOKENS.delete(rateLimitKey);
            }
            
            // Generate JWT-like token
            const token = await generateAdminToken(id + ':' + password, env.HMAC_SECRET || crypto.randomUUID());
            
            // 감사 로그: 성공한 로그인
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
        
        // Rate limit 증가
        await incrementRateLimit(env, rateLimitKey);
        
        // 타이밍 공격 방지: 실패 시에도 동일한 시간 소요
        await sleep(100);
        
        // 감사 로그: 실패한 로그인 시도
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
    } catch (error) {
        await logAdminActivity(env, {
            type: 'login_error',
            error: error.message,
            ip: clientIP,
            timestamp
        });
        
        // 타이밍 공격 방지
        await sleep(100);
        
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminVerify(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    
    if (isValid) {
        return new Response(JSON.stringify({ valid: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    return new Response(null, { status: 401, headers: corsHeaders });
}

async function handleAdminMetrics(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    // Get metrics from Durable Object
    const roomId = env.CHAT_ROOM.idFromName('main-room');
    const room = env.CHAT_ROOM.get(roomId);
    const response = await room.fetch(new Request('https://dummy/admin/metrics'));
    
    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handleAdminSessions(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const roomId = env.CHAT_ROOM.idFromName('main-room');
    const room = env.CHAT_ROOM.get(roomId);
    const response = await room.fetch(new Request('https://dummy/admin/sessions'));
    
    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handleAdminMessages(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const roomId = env.CHAT_ROOM.idFromName('main-room');
    const room = env.CHAT_ROOM.get(roomId);
    const response = await room.fetch(new Request('https://dummy/admin/messages'));
    
    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// 감사 로그 기록 함수
async function logAdminActivity(env, activity) {
    if (!env?.ADMIN_LOGS) return;
    
    const logKey = `log:${activity.timestamp}:${crypto.randomUUID()}`;
    const logData = JSON.stringify(activity);
    
    // KV에 30일간 보관
    await env.ADMIN_LOGS.put(logKey, logData, {
        expirationTtl: 30 * 24 * 60 * 60
    });
}

// 로그아웃 (토큰 무효화)
async function handleAdminLogout(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // 토큰을 블랙리스트에 추가 (24시간 만료)
    if (env?.ADMIN_TOKENS) {
        await env.ADMIN_TOKENS.put(`revoked:${token}`, 'true', {
            expirationTtl: 24 * 60 * 60
        });
    }
    
    // 감사 로그
    await logAdminActivity(env, {
        type: 'logout',
        ip: clientIP,
        timestamp: Date.now()
    });
    
    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// 감사 로그 조회
async function handleAdminLogs(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }
    
    if (!env?.ADMIN_LOGS) {
        return new Response(JSON.stringify({ logs: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    // 최근 100개 로그 가져오기
    const list = await env.ADMIN_LOGS.list({ prefix: 'log:', limit: 100 });
    const logs = [];
    
    for (const key of list.keys) {
        const logData = await env.ADMIN_LOGS.get(key.name);
        if (logData) {
            logs.push(JSON.parse(logData));
        }
    }
    
    // 시간 역순 정렬
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    return new Response(JSON.stringify({ logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function handleAdminBroadcast(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const content = typeof body.content === 'string' ? body.content : '';
        const file = body.file || null;

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ content, file, adminId: 'admin' })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminBroadcast error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminEditMessage(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const messageId = body.messageId;
        const newContent = body.newContent;

        if (!messageId || !newContent) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/edit-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ messageId, newContent })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminEditMessage error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminDeleteMessage(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const messageId = body.messageId;

        if (!messageId) {
            return new Response(JSON.stringify({ error: 'Missing messageId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/delete-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ messageId })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminDeleteMessage error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminKickUser(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const sessionId = body.sessionId;

        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/kick-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ sessionId })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminKickUser error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminAnnounce(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const content = typeof body.content === 'string' ? body.content : '';

        if (!content) {
            return new Response(JSON.stringify({ error: 'Missing content' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/announce', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ content })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminAnnounce error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleCheckBan(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const sessionId = url.searchParams.get('sessionId');
        
        // Get the Durable Object
        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);
        
        // Build check URL with both IP and sessionId
        let checkUrl = `https://dummy/check-ban?ip=${encodeURIComponent(clientIP)}`;
        if (sessionId) {
            checkUrl += `&sessionId=${encodeURIComponent(sessionId)}`;
        }
        
        // Check ban status
        const checkRequest = new Request(checkUrl, {
            headers: {
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID(),
                'CF-Connecting-IP': clientIP
            }
        });
        const response = await room.fetch(checkRequest);
        const result = await response.json();
        
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error checking ban:', error);
        return new Response(JSON.stringify({ banned: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
}

async function handleAdminBannedIPs(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/banned-ips', {
            headers: { 'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID() }
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminBannedIPs error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch banned IPs' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminUnbanIP(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const ip = body.ip;

        if (!ip) {
            return new Response(JSON.stringify({ error: 'Missing IP address' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/unban-ip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ ip })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminUnbanIP error:', error);
        return new Response(JSON.stringify({ error: 'Failed to unban IP' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminUserDetails(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request(`https://dummy/admin/user-details?sessionId=${encodeURIComponent(sessionId)}`, {
            headers: { 'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID() }
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminUserDetails error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch user details' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleAdminAuditLogs(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    if (!isValid) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    try {
        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/audit-logs', {
            headers: { 'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID() }
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminAuditLogs error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch audit logs' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function generateAdminToken(password, secret) {
    const data = `${password}:${Date.now()}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    return `${btoa(data)}.${base64Sig}`;
}

async function verifyAdminToken(token, secret, env) {
    try {
        // 1. 블랙리스트 체크 (무효화된 토큰)
        if (env?.ADMIN_TOKENS) {
            const isRevoked = await env.ADMIN_TOKENS.get(`revoked:${token}`);
            if (isRevoked) {
                return false;
            }
        }
        
        // 2. 토큰 형식 검증
        const [dataPart, sigPart] = token.split('.');
        if (!dataPart || !sigPart) return false;
        
        const data = atob(dataPart);
        const [password, timestamp] = data.split(':');
        
        // Token expires after 24 hours
        if (Date.now() - parseInt(timestamp) > 24 * 60 * 60 * 1000) {
            return false;
        }
        
        // 3. HMAC 서명 검증
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(data);
        
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, messageData);
        const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signature)));
        
        return sigPart === expectedSig;
    } catch {
        return false;
    }
}

// HMAC signature generation for message integrity
async function generateMessageSignature(message, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(JSON.stringify({
        content: message.content,
        sessionId: message.sessionId,
        timestamp: message.timestamp
    }));
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return arrayBufferToHex(signature);
}

// Verify HMAC signature
async function verifyMessageSignature(message, signature, secret) {
    const expectedSignature = await generateMessageSignature(message, secret);
    return signature === expectedSignature;
}

// Helper function to convert ArrayBuffer to hex string
function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Durable Object for managing chat room state
export class ChatRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map(); // sessionId -> WebSocket
        this.ipConnections = new Map(); // IP -> count
        this.userMetadata = new Map(); // sessionId -> { ip, joinTime, messageCount, lastMessageTime }
        this.typingUsers = new Set();
        this.messages = []; // In-memory cache
        this.initialized = false;
        this.startTime = Date.now(); // Track uptime
        this.bannedIPs = new Map(); // IP -> { bannedUntil: timestamp, reason: string }
        this.bannedSessions = new Map(); // sessionId -> { bannedUntil: timestamp, reason: string }
        this.currentAnnouncement = null; // Current active announcement
        this.auditLogs = []; // Audit logs for admin actions
        
        // Periodic cleanup of stale data (every 5 minutes)
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    }

    async initializeMessages() {
        if (this.initialized) return;
        
        // Load messages from Durable Object storage
        const stored = await this.state.storage.get('messages');
        if (stored) {
            // Filter out messages older than 12 hours
            const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
            this.messages = stored.filter(msg => msg.timestamp > twelveHoursAgo);
            
            // Save cleaned messages back if any were removed
            if (this.messages.length !== stored.length) {
                await this.state.storage.put('messages', this.messages);
            }
        }

        // Load banned IPs from storage
        const bannedIPs = await this.state.storage.get('bannedIPs');
        if (bannedIPs) {
            this.bannedIPs = new Map(bannedIPs);
        }

        // Load banned sessions from storage
        const bannedSessions = await this.state.storage.get('bannedSessions');
        if (bannedSessions) {
            this.bannedSessions = new Map(bannedSessions);
        }

        // Load audit logs from storage
        const auditLogs = await this.state.storage.get('auditLogs');
        if (auditLogs) {
            this.auditLogs = auditLogs;
        }

        // Load current announcement from storage
        const announcement = await this.state.storage.get('currentAnnouncement');
        if (announcement) {
            this.currentAnnouncement = announcement;
        }
        
        this.initialized = true;
    }

    async fetch(request) {
        // Get HMAC_SECRET from request headers
        const HMAC_SECRET = request.headers.get('X-HMAC-Secret');
        
        const url = new URL(request.url);
        
        // Admin API endpoints
        if (url.pathname === '/admin/metrics') {
            return new Response(JSON.stringify({
                activeConnections: this.sessions.size,
                totalMessages: this.messages.length,
                totalConnections: metrics.totalConnections,
                errors: metrics.errors,
                uptime: Date.now() - (this.startTime || Date.now())
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (url.pathname === '/admin/sessions') {
            const sessions = Array.from(this.userMetadata.entries()).map(([sessionId, metadata]) => ({
                sessionId,
                ip: metadata.ip,
                joinTime: metadata.joinTime,
                messageCount: metadata.messageCount,
                lastMessageTime: metadata.lastMessageTime
            }));
            
            return new Response(JSON.stringify(sessions), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (url.pathname === '/admin/messages') {
            return new Response(JSON.stringify(this.messages), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/admin/broadcast' && request.method === 'POST') {
            try {
                const data = await request.json();
                const content = typeof data.content === 'string' ? data.content : '';
                const file = data.file || null;
                const adminId = data.adminId || 'admin';

                if (!content && !file) {
                    return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                // Generate unique message ID
                const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

                const message = {
                    type: 'message',
                    messageId: messageId,
                    content: this.sanitizeInput(content || ''),
                    sessionId: `admin_${adminId}`,
                    timestamp: Date.now(),
                    editedAt: null
                };

                if (file && file.url) {
                    message.file = {
                        url: file.url,
                        filename: file.filename || '',
                        filesize: file.filesize || null,
                        filetype: file.filetype || ''
                    };
                }

                // Get HMAC secret if provided
                const HMAC_SECRET = request.headers.get('X-HMAC-Secret');
                if (HMAC_SECRET) {
                    message.signature = await generateMessageSignature(message, HMAC_SECRET);
                } else {
                    message.signature = '';
                }

                this.messages.push(message);

                // Clean up messages older than 12 hours and limit to 500 messages
                const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
                this.messages = this.messages
                    .filter(msg => msg.timestamp > twelveHoursAgo)
                    .slice(-500);

                // Persist to Durable Object storage
                this.state.storage.put('messages', this.messages);

                // Broadcast message to all users
                this.broadcast(message);

                return new Response(JSON.stringify({ success: true, message }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('admin broadcast error:', error);
                return new Response(JSON.stringify({ error: 'Failed to broadcast' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (url.pathname === '/admin/edit-message' && request.method === 'POST') {
            try {
                const data = await request.json();
                const messageId = data.messageId;
                const newContent = data.newContent;

                if (!messageId || !newContent) {
                    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Find the message
                const messageIndex = this.messages.findIndex(msg => msg.messageId === messageId);
                
                if (messageIndex === -1) {
                    return new Response(JSON.stringify({ error: 'Message not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const originalMessage = this.messages[messageIndex];

                // Verify it's an admin message
                if (!originalMessage.sessionId || !String(originalMessage.sessionId).startsWith('admin_')) {
                    return new Response(JSON.stringify({ error: 'Not an admin message' }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // 관리자 메시지는 시간 제한 없음
                const now = Date.now();

                // Update message
                const editedMessage = {
                    ...originalMessage,
                    content: this.sanitizeInput(newContent),
                    editedAt: now
                };

                // Generate new signature
                const HMAC_SECRET = request.headers.get('X-HMAC-Secret');
                if (HMAC_SECRET) {
                    editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);
                }

                // Update in messages array
                this.messages[messageIndex] = editedMessage;

                // Persist to storage
                this.state.storage.put('messages', this.messages);

                // Broadcast edited message to all users
                this.broadcast({
                    type: 'message_edited',
                    message: editedMessage
                });

                // Add audit log
                await this.addAuditLog('edit_message', `Edited message ${messageId}`, {
                    messageId,
                    originalContent: originalMessage.content.substring(0, 50),
                    newContent: newContent.substring(0, 50)
                });

                return new Response(JSON.stringify({ success: true, message: editedMessage }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('admin edit message error:', error);
                return new Response(JSON.stringify({ error: 'Failed to edit message' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url.pathname === '/admin/delete-message' && request.method === 'POST') {
            try {
                const data = await request.json();
                const messageId = data.messageId;

                if (!messageId) {
                    return new Response(JSON.stringify({ error: 'Missing messageId' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Find the message
                const messageIndex = this.messages.findIndex(msg => msg.messageId === messageId);
                
                if (messageIndex === -1) {
                    return new Response(JSON.stringify({ error: 'Message not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const messageToDelete = this.messages[messageIndex];

                // 관리자는 모든 메시지 삭제 가능 (시간 제한 없음)
                // Remove message from array
                this.messages.splice(messageIndex, 1);

                // Persist to storage
                this.state.storage.put('messages', this.messages);

                // Broadcast deletion to all users
                this.broadcast({
                    type: 'message_deleted',
                    messageId: messageId
                });

                // Add audit log with more details
                await this.addAuditLog('admin_delete_message', `Admin deleted message ${messageId} from user ${messageToDelete.sessionId}`, {
                    messageId,
                    originalSessionId: messageToDelete.sessionId,
                    content: messageToDelete.content ? messageToDelete.content.substring(0, 50) : '(file only)',
                    hasFile: !!messageToDelete.file
                });

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('admin delete message error:', error);
                return new Response(JSON.stringify({ error: 'Failed to delete message' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url.pathname === '/admin/kick-user' && request.method === 'POST') {
            try {
                const data = await request.json();
                const sessionId = data.sessionId;
                const banDuration = data.banDuration || 0; // 0, 30, 300, 600 (seconds)

                if (!sessionId) {
                    return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Find the session
                const websocket = this.sessions.get(sessionId);
                const metadata = this.userMetadata.get(sessionId);
                
                if (!websocket && !metadata) {
                    return new Response(JSON.stringify({ error: 'Session not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                const clientIP = metadata?.ip;

                // Ban IP and Session if duration is specified
                if (banDuration > 0) {
                    const bannedUntil = Date.now() + (banDuration * 1000);
                    
                    // Ban the specific session
                    this.bannedSessions.set(sessionId, {
                        bannedUntil,
                        reason: 'Admin kick',
                        ip: clientIP
                    });
                    await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
                    
                    // Ban the IP if available
                    if (clientIP) {
                        this.bannedIPs.set(clientIP, {
                            bannedUntil,
                            reason: 'Admin kick',
                            sessionId
                        });
                        await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
                    }

                    // Kick all sessions from this IP or with this sessionId
                    for (const [sid, ws] of this.sessions.entries()) {
                        const meta = this.userMetadata.get(sid);
                        const shouldKick = sid === sessionId || (meta && meta.ip === clientIP);
                        
                        if (shouldKick) {
                            try {
                                ws.send(JSON.stringify({
                                    type: 'kicked',
                                    content: `관리자에 의해 ${banDuration}초간 차단되었습니다.`,
                                    banDuration,
                                    permanent: true // 클라이언트에게 재접속 금지 알림
                                }));
                                ws.close(1008, 'Kicked by admin');
                            } catch (e) {
                                console.error('Failed to kick session:', e);
                            }
                            this.sessions.delete(sid);
                            this.userMetadata.delete(sid);
                            this.typingUsers.delete(sid);
                        }
                    }

                    // Update IP connection count
                    this.ipConnections.delete(clientIP);
                } else {
                    // Just kick without ban
                    if (websocket) {
                        try {
                            websocket.send(JSON.stringify({
                                type: 'kicked',
                                content: '관리자에 의해 강제퇴장되었습니다.'
                            }));
                            websocket.close(1008, 'Kicked by admin');
                        } catch (e) {
                            console.error('Failed to send kick notification:', e);
                        }
                    }

                    // Clean up session data
                    this.sessions.delete(sessionId);
                    if (metadata && clientIP) {
                        const currentCount = this.ipConnections.get(clientIP) || 0;
                        if (currentCount > 1) {
                            this.ipConnections.set(clientIP, currentCount - 1);
                        } else {
                            this.ipConnections.delete(clientIP);
                        }
                    }
                    this.userMetadata.delete(sessionId);
                    this.typingUsers.delete(sessionId);
                }

                metrics.activeConnections = this.sessions.size;
                this.broadcastUserCount();

                // Add audit log
                await this.addAuditLog('kick_user', `Kicked session ${sessionId}`, {
                    sessionId,
                    ip: clientIP,
                    banDuration,
                    banned: banDuration > 0
                });

                return new Response(JSON.stringify({ 
                    success: true,
                    banned: banDuration > 0,
                    banDuration,
                    ip: clientIP
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('admin kick user error:', error);
                return new Response(JSON.stringify({ error: 'Failed to kick user' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url.pathname === '/admin/announce' && request.method === 'POST') {
            try {
                const data = await request.json();
                const content = typeof data.content === 'string' ? data.content : '';

                if (!content) {
                    return new Response(JSON.stringify({ error: 'Empty content' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                console.log('Broadcasting announcement:', content.substring(0, 50));

                // Save new announcement (replaces old one)
                this.currentAnnouncement = {
                    content: this.sanitizeInput(content),
                    timestamp: Date.now()
                };
                await this.state.storage.put('currentAnnouncement', this.currentAnnouncement);

                // Broadcast system announcement to all users
                const announcementMessage = {
                    type: 'announcement',
                    content: this.currentAnnouncement.content,
                    timestamp: this.currentAnnouncement.timestamp
                };
                
                console.log('Active sessions:', this.sessions.size);
                this.broadcast(announcementMessage);

                // Add audit log
                await this.addAuditLog('send_announcement', `Sent announcement: ${content.substring(0, 50)}...`, {
                    contentLength: content.length,
                    sessionsNotified: this.sessions.size
                });

                return new Response(JSON.stringify({ 
                    success: true, 
                    sessionsNotified: this.sessions.size 
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('admin announce error:', error);
                return new Response(JSON.stringify({ error: 'Failed to send announcement' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // Get banned IPs list
        if (url.pathname === '/admin/banned-ips') {
            const now = Date.now();
            const bannedList = [];
            
            for (const [ip, banInfo] of this.bannedIPs.entries()) {
                if (now < banInfo.bannedUntil) {
                    bannedList.push({
                        ip,
                        bannedUntil: banInfo.bannedUntil,
                        remainingSeconds: Math.ceil((banInfo.bannedUntil - now) / 1000),
                        reason: banInfo.reason || 'No reason provided',
                        bannedAt: banInfo.bannedAt || (banInfo.bannedUntil - (banInfo.duration || 0) * 1000)
                    });
                }
            }
            
            return new Response(JSON.stringify(bannedList), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Unban IP
        if (url.pathname === '/admin/unban-ip' && request.method === 'POST') {
            try {
                const data = await request.json();
                const ip = data.ip;
                
                if (!ip) {
                    return new Response(JSON.stringify({ error: 'Missing IP' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                this.bannedIPs.delete(ip);
                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
                
                // Add audit log
                await this.addAuditLog('UNBAN_IP', `Unbanned IP: ${ip}`);
                
                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('unban ip error:', error);
                return new Response(JSON.stringify({ error: 'Failed to unban IP' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // Get user details
        if (url.pathname === '/admin/user-details') {
            const sessionId = url.searchParams.get('sessionId');
            
            if (!sessionId) {
                return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            const metadata = this.userMetadata.get(sessionId);
            const userMessages = this.messages.filter(m => m.sessionId === sessionId);
            const isOnline = this.sessions.has(sessionId);
            
            return new Response(JSON.stringify({
                sessionId,
                metadata: metadata || null,
                messages: userMessages,
                messageCount: userMessages.length,
                isOnline,
                firstMessage: userMessages.length > 0 ? userMessages[0].timestamp : null,
                lastMessage: userMessages.length > 0 ? userMessages[userMessages.length - 1].timestamp : null
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Get audit logs
        if (url.pathname === '/admin/audit-logs') {
            // Return last 100 audit logs
            const logs = this.auditLogs.slice(-100).reverse();
            
            return new Response(JSON.stringify(logs), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Handle ban check endpoint
        if (url.pathname === '/check-ban') {
            const ip = url.searchParams.get('ip') || request.headers.get('CF-Connecting-IP') || 'unknown';
            const sessionId = url.searchParams.get('sessionId');
            const now = Date.now();
            
            // Check session ban first
            if (sessionId) {
                const sessionBanInfo = this.bannedSessions.get(sessionId);
                if (sessionBanInfo && now < sessionBanInfo.bannedUntil) {
                    const remainingSeconds = Math.ceil((sessionBanInfo.bannedUntil - now) / 1000);
                    return new Response(JSON.stringify({
                        banned: true,
                        remainingSeconds,
                        message: `이 세션은 ${remainingSeconds}초 동안 차단되었습니다.`
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else if (sessionBanInfo) {
                    // Session ban expired, remove it
                    this.bannedSessions.delete(sessionId);
                    await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
                }
            }
            
            // Check IP ban
            const banInfo = this.bannedIPs.get(ip);
            if (banInfo) {
                if (now < banInfo.bannedUntil) {
                    const remainingSeconds = Math.ceil((banInfo.bannedUntil - now) / 1000);
                    return new Response(JSON.stringify({
                        banned: true,
                        remainingSeconds,
                        message: `이 IP는 ${remainingSeconds}초 동안 차단되었습니다.`
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    // Ban expired, remove it
                    this.bannedIPs.delete(ip);
                    await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
                }
            }
            
            return new Response(JSON.stringify({ banned: false }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Initialize messages from storage on first request
        await this.initializeMessages();
        
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // Check if IP is banned
        const banInfo = this.bannedIPs.get(clientIP);
        if (banInfo) {
            const now = Date.now();
            if (now < banInfo.bannedUntil) {
                const remainingSeconds = Math.ceil((banInfo.bannedUntil - now) / 1000);
                return new Response(JSON.stringify({
                    error: 'banned',
                    message: `이 IP는 ${remainingSeconds}초 동안 차단되었습니다.`,
                    remainingSeconds
                }), { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // Ban expired, remove it
                this.bannedIPs.delete(clientIP);
                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
            }
        }
        
        // Check IP-based connection limit
        const currentConnections = this.ipConnections.get(clientIP) || 0;
        if (currentConnections >= RATE_LIMIT.MAX_CONNECTIONS_PER_IP) {
            return new Response('Too many connections from this IP', { status: 429 });
        }

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept the WebSocket connection
        await this.handleSession(server, clientIP, HMAC_SECRET);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    async handleSession(websocket, clientIP, HMAC_SECRET) {
        websocket.accept();

        let sessionId = null;
        let metadata = null;

        websocket.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle different message types
                switch (data.type) {
                    case 'ping': {
                        // Respond to heartbeat ping directly to this websocket
                        // Don't use sendToSession as sessionId might not be set yet
                        try {
                            websocket.send(JSON.stringify({
                                type: 'pong',
                                timestamp: Date.now()
                            }));
                        } catch (error) {
                            console.error('Error sending pong:', error);
                        }
                        break;
                    }
                    
                    case 'join': {
                        const isReconnect = data.isReconnect || false;
                        sessionId = data.sessionId || this.generateSessionId();
                        
                        // Check if session is banned
                        const sessionBanInfo = this.bannedSessions.get(sessionId);
                        if (sessionBanInfo) {
                            const now = Date.now();
                            if (now < sessionBanInfo.bannedUntil) {
                                const remainingSeconds = Math.ceil((sessionBanInfo.bannedUntil - now) / 1000);
                                websocket.send(JSON.stringify({
                                    type: 'banned',
                                    content: `이 세션은 ${remainingSeconds}초 동안 차단되었습니다.`,
                                    remainingSeconds
                                }));
                                websocket.close(1008, 'Session banned');
                                return;
                            } else {
                                // Ban expired, remove it
                                this.bannedSessions.delete(sessionId);
                                await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
                            }
                        }
                        
                        // Check if IP is still banned (even for reconnecting sessions)
                        const banInfo = this.bannedIPs.get(clientIP);
                        if (banInfo) {
                            const now = Date.now();
                            if (now < banInfo.bannedUntil) {
                                const remainingSeconds = Math.ceil((banInfo.bannedUntil - now) / 1000);
                                websocket.send(JSON.stringify({
                                    type: 'banned',
                                    content: `이 IP는 ${remainingSeconds}초 동안 차단되었습니다.`,
                                    remainingSeconds
                                }));
                                websocket.close(1008, 'IP banned');
                                return;
                            } else {
                                // Ban expired, remove it
                                this.bannedIPs.delete(clientIP);
                                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
                            }
                        }
                        
                        // Check if this is an existing session reconnecting
                        const existingMetadata = this.userMetadata.get(sessionId);
                        const wasAlreadyConnected = this.sessions.has(sessionId);
                        
                        if (wasAlreadyConnected || existingMetadata) {
                            // Existing session reconnecting - just update the websocket
                            console.log('Session reconnecting:', sessionId);
                            this.sessions.set(sessionId, websocket);
                            
                            // Keep existing metadata
                            metadata = existingMetadata || {
                                ip: clientIP,
                                joinTime: Date.now(),
                                messageCount: 0,
                                lastMessageTime: 0,
                            };
                            this.userMetadata.set(sessionId, metadata);
                            
                            // Send recent messages only (no welcome message for reconnect)
                            const recentMessages = this.messages.slice(-50);
                            for (const msg of recentMessages) {
                                this.sendToSession(sessionId, msg);
                            }
                            
                            // Send current announcement if exists
                            if (this.currentAnnouncement) {
                                this.sendToSession(sessionId, {
                                    type: 'announcement',
                                    content: this.currentAnnouncement.content,
                                    timestamp: this.currentAnnouncement.timestamp
                                });
                            }
                            
                            // Update user count
                            this.broadcastUserCount();
                        } else {
                            // New session joining
                            console.log('New session joining:', sessionId);
                            
                            // Initialize user metadata
                            metadata = {
                                ip: clientIP,
                                joinTime: Date.now(),
                                messageCount: 0,
                                lastMessageTime: 0,
                            };

                            this.sessions.set(sessionId, websocket);
                            this.userMetadata.set(sessionId, metadata);
                            
                            // Track IP connections
                            this.ipConnections.set(clientIP, (this.ipConnections.get(clientIP) || 0) + 1);
                            
                            // Update metrics
                            metrics.totalConnections++;
                            metrics.activeConnections++;

                            // Broadcast user count
                            this.broadcastUserCount();

                            // Send welcome message only for new users
                            this.sendToSession(sessionId, {
                                type: 'system',
                                content: '채팅방에 입장했습니다.'
                            });
                            
                            // Send last 50 messages to new user
                            const recentMessages = this.messages.slice(-50);
                            for (const msg of recentMessages) {
                                this.sendToSession(sessionId, msg);
                            }
                            
                            // Send current announcement if exists
                            if (this.currentAnnouncement) {
                                this.sendToSession(sessionId, {
                                    type: 'announcement',
                                    content: this.currentAnnouncement.content,
                                    timestamp: this.currentAnnouncement.timestamp
                                });
                            }
                        }

                        break;
                    }

                    case 'message': {
                        if (!sessionId || !metadata) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션이 유효하지 않습니다.'
                            });
                            return;
                        }

                        // Verify message signature if provided (server-side only)
                        if (data.signature) {
                            const isValid = await verifyMessageSignature(
                                {
                                    content: data.content,
                                    sessionId: data.sessionId,
                                    timestamp: data.timestamp
                                },
                                data.signature,
                                HMAC_SECRET
                            );
                            
                            if (!isValid) {
                                this.sendToSession(sessionId, {
                                    type: 'error',
                                    content: '메시지 무결성 검증 실패'
                                });
                                console.warn('Invalid message signature from session:', sessionId);
                                return;
                            }
                        }

                        // Verify session ID matches
                        if (data.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션 ID가 일치하지 않습니다.'
                            });
                            console.warn('Session ID mismatch:', data.sessionId, '!=', sessionId);
                            return;
                        }

                        // Validate message
                        const validationError = this.validateMessage(data, metadata);
                        if (validationError) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: validationError
                            });
                            return;
                        }

                        // Update metadata
                        metadata.messageCount++;
                        metadata.lastMessageTime = Date.now();
                        metrics.totalMessages++;

                        // Generate unique message ID
                        const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

                        // Create message object with signature
                        const message = {
                            type: 'message',
                            messageId: messageId,
                            content: this.sanitizeInput(data.content),
                            sessionId: sessionId,
                            timestamp: Date.now(),
                            editedAt: null
                        };
                        
                        // Add file info if present
                        if (data.file && data.file.url) {
                            message.file = {
                                url: data.file.url,
                                filename: data.file.filename,
                                filesize: data.file.filesize,
                                filetype: data.file.filetype
                            };
                        }
                        
                        // Generate server signature
                        message.signature = await generateMessageSignature(message, HMAC_SECRET);

                        // Add to messages array
                        this.messages.push(message);
                        
                        // Clean up messages older than 12 hours and limit to 500 messages
                        const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
                        this.messages = this.messages
                            .filter(msg => msg.timestamp > twelveHoursAgo)
                            .slice(-500); // Keep max 500 messages
                        
                        // Persist to Durable Object storage (async, non-blocking)
                        this.state.storage.put('messages', this.messages);

                        // Broadcast message to all users
                        this.broadcast(message);
                        break;
                    }

                    case 'edit': {
                        if (!sessionId || !metadata) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션이 유효하지 않습니다.'
                            });
                            return;
                        }

                        // Verify edit request signature (server-side only)
                        if (data.signature) {
                            const isValid = await verifyMessageSignature(
                                {
                                    content: data.newContent,
                                    sessionId: data.sessionId,
                                    timestamp: data.timestamp
                                },
                                data.signature,
                                HMAC_SECRET
                            );
                            
                            if (!isValid) {
                                this.sendToSession(sessionId, {
                                    type: 'error',
                                    content: '메시지 수정 요청 검증 실패'
                                });
                                console.warn('Invalid edit signature from session:', sessionId);
                                return;
                            }
                        }

                        // Verify session ID matches
                        if (data.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션 ID가 일치하지 않습니다.'
                            });
                            return;
                        }

                        // Find the original message
                        const messageIndex = this.messages.findIndex(msg => msg.messageId === data.messageId);
                        
                        if (messageIndex === -1) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '수정할 메시지를 찾을 수 없습니다.'
                            });
                            return;
                        }

                        const originalMessage = this.messages[messageIndex];

                        // Verify ownership
                        if (originalMessage.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '자신의 메시지만 수정할 수 있습니다.'
                            });
                            console.warn('Unauthorized edit attempt:', sessionId, 'tried to edit message from', originalMessage.sessionId);
                            return;
                        }

                        // Verify 10-minute time limit
                        const now = Date.now();
                        const tenMinutes = 10 * 60 * 1000;
                        if (now - originalMessage.timestamp > tenMinutes) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '메시지는 작성 후 10분 이내에만 수정할 수 있습니다.'
                            });
                            return;
                        }

                        // Validate new content
                        if (!data.newContent || data.newContent.trim().length === 0) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '수정할 내용이 비어있습니다.'
                            });
                            return;
                        }

                        if (data.newContent.length > SECURITY.MAX_MESSAGE_LENGTH) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: `메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`
                            });
                            return;
                        }

                        // Update message
                        const editedMessage = {
                            ...originalMessage,
                            content: this.sanitizeInput(data.newContent),
                            editedAt: now
                        };

                        // Generate new server signature for edited message
                        editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);

                        // Update in messages array
                        this.messages[messageIndex] = editedMessage;

                        // Persist to Durable Object storage
                        this.state.storage.put('messages', this.messages);

                        // Broadcast edited message to all users
                        this.broadcast({
                            type: 'message_edited',
                            message: editedMessage
                        });

                        break;
                    }

                    case 'delete': {
                        if (!sessionId || !metadata) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션이 유효하지 않습니다.'
                            });
                            return;
                        }

                        // Verify session ID matches
                        if (data.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션 ID가 일치하지 않습니다.'
                            });
                            return;
                        }

                        // Find the message to delete
                        const messageIndex = this.messages.findIndex(msg => msg.messageId === data.messageId);
                        
                        if (messageIndex === -1) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '삭제할 메시지를 찾을 수 없습니다.'
                            });
                            return;
                        }

                        const messageToDelete = this.messages[messageIndex];

                        // Verify ownership
                        if (messageToDelete.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '자신의 메시지만 삭제할 수 있습니다.'
                            });
                            console.warn('Unauthorized delete attempt:', sessionId, 'tried to delete message from', messageToDelete.sessionId);
                            return;
                        }

                        // Verify 10-minute time limit
                        const now = Date.now();
                        const tenMinutes = 10 * 60 * 1000;
                        if (now - messageToDelete.timestamp > tenMinutes) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '메시지는 작성 후 10분 이내에만 삭제할 수 있습니다.'
                            });
                            return;
                        }

                        // Remove message from array
                        this.messages.splice(messageIndex, 1);

                        // Persist to Durable Object storage
                        this.state.storage.put('messages', this.messages);

                        // Broadcast deletion to all users
                        this.broadcast({
                            type: 'message_deleted',
                            messageId: data.messageId
                        });

                        break;
                    }

                    case 'typing':
                        if (!sessionId) return;

                        if (data.typing) {
                            this.typingUsers.add(sessionId);
                        } else {
                            this.typingUsers.delete(sessionId);
                        }

                        // Broadcast typing indicator to others
                        this.broadcast({
                            type: 'typing',
                            sessionId: sessionId,
                            typing: data.typing
                        }, sessionId);
                        break;

                    default:
                        console.log('Unknown message type:', data.type);
                }

            } catch (error) {
                metrics.errors++;
                console.error('Message handling error:', error);
                if (sessionId) {
                    this.sendToSession(sessionId, {
                        type: 'error',
                        content: '메시지 처리 중 오류가 발생했습니다.'
                    });
                }
            }
        });

        websocket.addEventListener('close', () => {
            if (sessionId) {
                this.sessions.delete(sessionId);
                this.userMetadata.delete(sessionId);
                this.typingUsers.delete(sessionId);
                
                // Update IP connection count
                const currentCount = this.ipConnections.get(clientIP) || 0;
                if (currentCount > 1) {
                    this.ipConnections.set(clientIP, currentCount - 1);
                } else {
                    this.ipConnections.delete(clientIP);
                }
                
                metrics.activeConnections--;
                this.broadcastUserCount();
            }
        });

        websocket.addEventListener('error', (error) => {
            metrics.errors++;
            console.error('WebSocket error:', error);
        });
    }

    validateMessage(data, metadata) {
        // Check message length - allow empty content if file is attached
        const hasFile = data.file && data.file.url;
        const hasContent = data.content && data.content.trim().length > 0;
        
        if (!hasContent && !hasFile) {
            return '메시지 내용이 비어있습니다.';
        }

        if (data.content && data.content.length > SECURITY.MAX_MESSAGE_LENGTH) {
            return `메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`;
        }

        // Rate limiting per user
        const now = Date.now();
        if (now - metadata.lastMessageTime < RATE_LIMIT.MESSAGE_COOLDOWN) {
            return '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.';
        }

        // Check messages per minute
        const oneMinuteAgo = now - 60000;
        if (metadata.messageCount > RATE_LIMIT.MAX_MESSAGES_PER_MINUTE && 
            metadata.joinTime > oneMinuteAgo) {
            return '분당 메시지 전송 한도를 초과했습니다.';
        }

        return null;
    }

    sanitizeInput(input) {
        // Basic sanitization - remove control characters
        // eslint-disable-next-line no-control-regex
        // Preserve common whitespace characters (LF, CR, TAB) so clients can send
        // and render multiline messages. Remove other control characters while
        // normalizing CRLF -> LF. Do NOT trim here to preserve intentional
        // leading/trailing newlines entered by the user.
        if (typeof input !== 'string') return '';
        // Remove control characters except \t (0x09), \n (0x0A), \r (0x0D)
        const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // Normalize CRLF to LF for consistency
        return cleaned.replace(/\r\n?/g, '\n');
    }

    generateSessionId() {
        // Generate cryptographically secure session ID with timestamp
        const randomPart = crypto.randomUUID().replace(/-/g, '');
        const timestampPart = Date.now().toString(36);
        return `user_${randomPart.substring(0, 16)}_${timestampPart}`;
    }

    async addAuditLog(action, details, metadata = {}) {
        const log = {
            timestamp: Date.now(),
            action,
            details,
            metadata
        };
        
        this.auditLogs.push(log);
        
        // Keep only last 500 logs
        if (this.auditLogs.length > 500) {
            this.auditLogs = this.auditLogs.slice(-500);
        }
        
        // Save to storage
        await this.state.storage.put('auditLogs', this.auditLogs);
        
        return log;
    }

    broadcast(message, excludeSessionId = null) {
        for (const [sessionId, websocket] of this.sessions) {
            if (sessionId !== excludeSessionId) {
                try {
                    websocket.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Broadcast error:', error);
                }
            }
        }
    }

    sendToSession(sessionId, message) {
        const websocket = this.sessions.get(sessionId);
        if (websocket) {
            try {
                websocket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Send error:', error);
            }
        }
    }

    broadcastUserCount() {
        this.broadcast({
            type: 'user_count',
            count: this.sessions.size
        });
    }

    cleanup() {
        // Clean up stale sessions and connections
        const now = Date.now();
        const sessionTimeout = 300000; // 5 minutes
        const messageRetention = 12 * 60 * 60 * 1000; // 12 hours

        // Clean up expired IP bans
        let bansChanged = false;
        for (const [ip, banInfo] of this.bannedIPs.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedIPs.delete(ip);
                bansChanged = true;
            }
        }
        if (bansChanged) {
            this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
        }

        // Clean up expired session bans
        let sessionBansChanged = false;
        for (const [sessionId, banInfo] of this.bannedSessions.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedSessions.delete(sessionId);
                sessionBansChanged = true;
            }
        }
        if (sessionBansChanged) {
            this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
        }

        // Clean up inactive sessions
        for (const [sessionId, metadata] of this.userMetadata) {
            if (now - metadata.lastMessageTime > sessionTimeout && now - metadata.joinTime > sessionTimeout) {
                const websocket = this.sessions.get(sessionId);
                if (websocket) {
                    try {
                        websocket.close(1000, 'Session timeout');
                    } catch (error) {
                        console.error('Cleanup error:', error);
                    }
                }
                this.sessions.delete(sessionId);
                this.userMetadata.delete(sessionId);
            }
        }
        
        // Clean up old messages (older than 12 hours)
        // Note: Announcements are kept separately and not cleaned up by time
        const twelveHoursAgo = now - messageRetention;
        const initialLength = this.messages.length;
        this.messages = this.messages.filter(msg => msg.timestamp > twelveHoursAgo);
        
        // If messages were cleaned, update storage
        if (this.messages.length !== initialLength) {
            this.state.storage.put('messages', this.messages);
        }
    }
}
