// Cloudflare Worker with Durable Objects for Anonymous Chat

// Rate limiting configuration
const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 5,
    MESSAGE_COOLDOWN: 1000, // 1 second between messages
};

// Security configuration
const SECURITY = {
    MAX_MESSAGE_LENGTH: 1000,
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

            if (url.pathname === '/api/admin/send-message') {
                return await handleAdminSendMessage(request, env, corsHeaders);
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

            // Simple static file serving fallback
            // Note: For production, use Cloudflare Pages or R2 for static assets
            return new Response('API endpoint. For static files, configure separately.', { 
                status: 404,
                headers: corsHeaders 
            });

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

async function handleAdminSendMessage(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyAdminToken(token, env.HMAC_SECRET || crypto.randomUUID(), env);
    
    if (!isValid) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const { content } = await request.json();
        
        if (!content || content.trim().length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'Empty message' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        if (content.length > SECURITY.MAX_MESSAGE_LENGTH) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Message too long (max ${SECURITY.MAX_MESSAGE_LENGTH} characters)` 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Get the Durable Object for the chat room
        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);
        
        // Forward message to the room
        const roomResponse = await room.fetch(new Request('http://internal/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        }));
        
        if (!roomResponse.ok) {
            throw new Error('Failed to broadcast message');
        }
        
        // Log admin activity
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        await logAdminActivity(env, {
            type: 'message_sent',
            content: content.substring(0, 100), // Store first 100 chars for audit
            ip: clientIP,
            timestamp: Date.now()
        });
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Admin send message error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
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
        
        // Admin broadcast message endpoint
        if (url.pathname === '/admin/broadcast') {
            try {
                const { content } = await request.json();
                
                // Generate admin message
                const messageId = `msg_admin_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
                const message = {
                    type: 'message',
                    messageId: messageId,
                    content: this.sanitizeInput(content),
                    sessionId: 'ADMIN',
                    isAdmin: true,
                    timestamp: Date.now(),
                    editedAt: null
                };
                
                // Generate signature
                message.signature = await generateMessageSignature(message, HMAC_SECRET);
                
                // Add to messages array
                this.messages.push(message);
                
                // Clean up old messages
                const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
                this.messages = this.messages
                    .filter(msg => msg.timestamp > twelveHoursAgo)
                    .slice(-500);
                
                // Persist to storage
                this.state.storage.put('messages', this.messages);
                
                // Broadcast to all connected users
                this.broadcast(message);
                
                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('Admin broadcast error:', error);
                return new Response(JSON.stringify({ success: false }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // Initialize messages from storage on first request
        await this.initializeMessages();
        
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
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
                    case 'join': {
                        sessionId = data.sessionId || this.generateSessionId();
                        
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

                        // Send welcome message and recent messages
                        this.sendToSession(sessionId, {
                            type: 'system',
                            content: '채팅방에 입장했습니다.'
                        });
                        
                        // Send last 50 messages to new user
                        const recentMessages = this.messages.slice(-50);
                        for (const msg of recentMessages) {
                            this.sendToSession(sessionId, msg);
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
        // Check message length
        if (!data.content || data.content.trim().length === 0) {
            return '메시지 내용이 비어있습니다.';
        }

        if (data.content.length > SECURITY.MAX_MESSAGE_LENGTH) {
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
        return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
    }

    generateSessionId() {
        // Generate cryptographically secure session ID with timestamp
        const randomPart = crypto.randomUUID().replace(/-/g, '');
        const timestampPart = Date.now().toString(36);
        return `user_${randomPart.substring(0, 16)}_${timestampPart}`;
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
        const twelveHoursAgo = now - messageRetention;
        const initialLength = this.messages.length;
        this.messages = this.messages.filter(msg => msg.timestamp > twelveHoursAgo);
        
        // If messages were cleaned, update storage
        if (this.messages.length !== initialLength) {
            this.state.storage.put('messages', this.messages);
        }
    }
}
