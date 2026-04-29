import { SECURITY } from '../config/constants.js';
import { isAllowedOrigin } from '../utils/security.js';

export async function handleWebSocket(request, env, HMAC_SECRET) {
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
    const clientIP = request.headers.get('CF-Connecting-IP');
    if (!clientIP) {
        console.warn('CF-Connecting-IP header missing');
        return new Response('Invalid request', { status: 400 });
    }
    
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
    const channelParam = url.searchParams.get('channel') || '0';
    const roomName = channelParam === '0' ? 'main-room' : 'channel:' + channelParam;
    const roomId = env.CHAT_ROOM.idFromName(roomName);
    const room = env.CHAT_ROOM.get(roomId);

    // Forward the request to the Durable Object with HMAC_SECRET in headers
    const modifiedRequest = new Request(request, {
        headers: {
            ...Object.fromEntries(request.headers),
            'X-HMAC-Secret': HMAC_SECRET,
            'X-Channel-Number': channelParam
        }
    });
    return room.fetch(modifiedRequest);
}

export async function handleCheckBan(request, env, corsHeaders) {
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
