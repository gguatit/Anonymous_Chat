import { sleep, constantTimeCompare } from '../utils/security.js';
import { logAdminActivity } from '../utils/logger.js';
import { checkRateLimit, incrementRateLimit, generateAdminToken, verifyAdminToken } from '../middleware/auth.js';

// Admin Authentication Handlers
export async function handleAdminLogin(request, env, corsHeaders) {
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
                error: 'Service temporarily unavailable'
            }), {
                status: 503,
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

export async function handleAdminVerify(request, env, corsHeaders) {
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

export async function handleAdminMetrics(request, env, corsHeaders) {
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
    
    // 내부 통신용 인증 헤더 추가
    const checkRequest = new Request('https://dummy/admin/metrics', {
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    const response = await room.fetch(checkRequest);

    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

export async function handleAdminSessions(request, env, corsHeaders) {
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
    
    // 내부 통신용 인증 헤더 추가
    const checkRequest = new Request('https://dummy/admin/sessions', {
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    const response = await room.fetch(checkRequest);

    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

export async function handleAdminMessages(request, env, corsHeaders) {
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
    
    const forward = new Request('https://dummy/admin/messages', {
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    const response = await room.fetch(forward);

    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// 에러 로그 초기화
export async function handleAdminDeleteErrorLogs(request, env, corsHeaders) {
    if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: corsHeaders });
    }

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
    
    const forward = new Request('https://dummy/admin/delete-error-logs', {
        method: 'POST',
        headers: { 'X-Admin-Internal-Token': env.HMAC_SECRET }
    });
    const response = await room.fetch(forward);

    return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// 로그아웃 (토큰 무효화)
export async function handleAdminLogout(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(null, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // 토큰을 블랙리스트에 추가 (2시간 만료)
    if (env?.ADMIN_TOKENS) {
        await env.ADMIN_TOKENS.put(`revoked:${token}`, 'true', {
            expirationTtl: 2 * 60 * 60
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
export async function handleAdminLogs(request, env, corsHeaders) {
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

export async function handleAdminBroadcast(request, env, corsHeaders) {
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

export async function handleAdminEditMessage(request, env, corsHeaders) {
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

export async function handleAdminDeleteMessage(request, env, corsHeaders) {
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

export async function handleAdminDeleteAllMessages(request, env, corsHeaders) {
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
        const confirmation = body.confirmation;

        if (confirmation !== 'DELETE_ALL_MESSAGES') {
            return new Response(JSON.stringify({ error: 'Invalid confirmation' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        const forward = new Request('https://dummy/admin/delete-all-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify({ confirmation })
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('handleAdminDeleteAllMessages error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

export async function handleAdminKickUser(request, env, corsHeaders) {
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
        const banDuration = body.banDuration || 0;

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
            body: JSON.stringify({ sessionId, banDuration })
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

export async function handleAdminAnnounce(request, env, corsHeaders) {
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
        const timestamp = body.timestamp; // Required for PUT/DELETE

        if (request.method === 'POST' && !content) {
            return new Response(JSON.stringify({ error: 'Missing content' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        if ((request.method === 'PUT' || request.method === 'DELETE') && !timestamp) {
            return new Response(JSON.stringify({ error: 'Missing timestamp' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const roomId = env.CHAT_ROOM.idFromName('main-room');
        const room = env.CHAT_ROOM.get(roomId);

        let forwardBody = { content };
        if (request.method === 'PUT' || request.method === 'DELETE') {
            forwardBody.timestamp = timestamp;
        }

        const forward = new Request('https://dummy/admin/announce', {
            method: request.method, // Forward POST, PUT, or DELETE
            headers: {
                'Content-Type': 'application/json',
                'X-HMAC-Secret': env.HMAC_SECRET || crypto.randomUUID()
            },
            body: JSON.stringify(forwardBody)
        });

        const response = await room.fetch(forward);
        return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status
        });
    } catch (error) {
        console.error('handleAdminAnnounce error:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

export async function handleAdminBannedIPs(request, env, corsHeaders) {
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

export async function handleAdminUnbanIP(request, env, corsHeaders) {
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

export async function handleAdminUserDetails(request, env, corsHeaders) {
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

export async function handleAdminAuditLogs(request, env, corsHeaders) {
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
