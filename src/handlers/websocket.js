import { ROOM_NAME, CHANNEL_PREFIX, MAX_SESSION_ID_LENGTH } from '../config/constants.js';
import { isAllowedOrigin } from '../utils/security.js';
import { verifyObserverTicket } from './turnstile.js';

export async function handleWebSocket(request, env, HMAC_SECRET) {
    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Origin is required (fail-closed) to prevent cross-site WebSocket hijacking
    const origin = request.headers.get('Origin');
    if (!origin || !isAllowedOrigin(origin, env)) {
        console.warn('Blocked WebSocket from unauthorized origin:', origin);
        return new Response('Unauthorized Origin', { status: 403 });
    }

    // Get client IP for rate limiting and access control
    const clientIP = request.headers.get('CF-Connecting-IP');
    if (!clientIP) {
        console.warn('CF-Connecting-IP header missing');
        return new Response('Invalid request', { status: 400 });
    }

    // Extract sessionId from URL query parameters
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId && (sessionId.length > MAX_SESSION_ID_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(sessionId))) {
        return new Response('Invalid sessionId', { status: 400 });
    }

    // Observer sessions (admin dashboard) authenticate with a short-lived one-time ticket (M8)
    if (sessionId && sessionId.startsWith('admin_obs_')) {
        const observerTicket = url.searchParams.get('ticket');
        const isValidObserver = await verifyObserverTicket(env, observerTicket, sessionId);
        if (!isValidObserver) {
            console.warn('Blocked unauthenticated observer session');
            return new Response('Unauthorized observer', { status: 401 });
        }
    }

    // Check ban status BEFORE allowing WebSocket connection
    if (sessionId || clientIP !== 'unknown') {
        const roomId = env.CHAT_ROOM.idFromName(ROOM_NAME);
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
                return new Response('Access Denied - You are banned', { 
                    status: 403,
                    statusText: `Banned for ${banStatus.remainingSeconds} seconds`
                });
            }
        } catch (error) {
            console.error('Ban check failed — allowing connection (fail-open):', error.message);
            // Continue with connection on error to avoid blocking legitimate users
        }
    }

    // Get or create the Durable Object for the chat room
    const channelParam = url.searchParams.get('channel') || '0';
    const roomName = channelParam === '0' ? ROOM_NAME : CHANNEL_PREFIX + channelParam;
    const roomId = env.CHAT_ROOM.idFromName(roomName);
    const room = env.CHAT_ROOM.get(roomId);

    // Forward the request to the Durable Object with HMAC_SECRET in headers
        const modifiedRequest = new Request(request, {
            headers: {
                ...Object.fromEntries(request.headers),
                'X-HMAC-Secret': HMAC_SECRET,
                'X-Channel-Slug': channelParam,
                'X-Ws-Session-Id': sessionId || ''
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
        const roomId = env.CHAT_ROOM.idFromName(ROOM_NAME);
        const room = env.CHAT_ROOM.get(roomId);
        
        // Build check URL with both IP and sessionId
        let checkUrl = `https://dummy/check-ban?ip=${encodeURIComponent(clientIP)}`;
        if (sessionId) {
            checkUrl += `&sessionId=${encodeURIComponent(sessionId)}`;
        }
        
        // Check ban status
        const checkRequest = new Request(checkUrl, {
            headers: {
                'X-HMAC-Secret': env.HMAC_SECRET,
                'CF-Connecting-IP': clientIP
            }
        });
        const response = await room.fetch(checkRequest);
        const result = await response.json();
        
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.warn('Check-ban failed — reporting banned:false (fail-open):', error.message);
        return new Response(JSON.stringify({ banned: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
}
