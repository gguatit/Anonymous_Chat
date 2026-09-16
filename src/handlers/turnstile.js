import { safeJson, arrayBufferToHex } from '../utils/helpers.js';
import { constantTimeCompare } from '../utils/security.js';

const TICKET_TTL_MS = 2 * 60 * 60 * 1000;
const TICKET_FUTURE_SKEW_MS = 60 * 1000;

async function hmacHex(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return arrayBufferToHex(signature);
}

async function issueTicket(secret, sessionId, ts) {
    const signature = await hmacHex(secret, `turnstile:${sessionId}:${ts}`);
    return `${ts}.${signature}`;
}

export async function verifyTurnstileTicket(env, ticket, sessionId) {
    if (!ticket || typeof ticket !== 'string') {
        console.warn('Turnstile ticket rejected: missing');
        return false;
    }
    if (!env?.HMAC_SECRET) {
        console.warn('Turnstile ticket rejected: config');
        return false;
    }

    const parts = ticket.split('.');
    if (parts.length !== 2 || !parts[0]) {
        console.warn('Turnstile ticket rejected: malformed');
        return false;
    }

    const ts = Number(parts[0]);
    if (!Number.isFinite(ts)) {
        console.warn('Turnstile ticket rejected: malformed');
        return false;
    }

    const now = Date.now();
    if (ts > now + TICKET_FUTURE_SKEW_MS) {
        console.warn('Turnstile ticket rejected: future');
        return false;
    }
    if (now - ts >= TICKET_TTL_MS) {
        console.warn('Turnstile ticket rejected: expired');
        return false;
    }

    const expected = await hmacHex(env.HMAC_SECRET, `turnstile:${sessionId}:${ts}`);
    const valid = await constantTimeCompare(expected, parts[1]);
    if (!valid) {
        console.warn('Turnstile ticket rejected: mismatch');
    }
    return valid;
}

export async function handleTurnstileVerify(request, env, corsHeaders) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await safeJson(request);
        const token = body.token;
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';

        if (!token || typeof token !== 'string') {
            return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (token.length > 2048) {
            return new Response(JSON.stringify({ success: false, error: 'Token too long' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const secretKey = env.TURNSTILE_SECRET_KEY;
        if (!secretKey) {
            console.error('TURNSTILE_SECRET_KEY is not configured');
            return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const clientIP = request.headers.get('CF-Connecting-IP') || '';

        const formData = new FormData();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (clientIP) {
            formData.append('remoteip', clientIP);
        }

        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const result = await verifyResponse.json();

        if (result.success) {
            const payload = { success: true };
            if (env.HMAC_SECRET) {
                payload.ticket = await issueTicket(env.HMAC_SECRET, sessionId, Date.now());
            }
            return new Response(JSON.stringify(payload), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            console.warn('Turnstile verification failed:', result['error-codes']);
            return new Response(JSON.stringify({
                success: false,
                error: 'Verification failed',
                errorCodes: result['error-codes'] || []
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Turnstile verify error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
// Observer tickets: short-lived credentials for the admin dashboard WebSocket (M8 hardening)
export const OBSERVER_TICKET_TTL_MS = 5 * 60 * 1000;
const OBSERVER_TICKET_FUTURE_SKEW_MS = 60 * 1000;

export async function issueObserverTicket(secret, sessionId, ts = Date.now()) {
    const signature = await hmacHex(secret, `observer:${sessionId}:${ts}`);
    return `${ts}.${signature}`;
}

export async function verifyObserverTicket(env, ticket, sessionId) {
    if (!ticket || typeof ticket !== 'string') {
        console.warn('[ObserverTicket] missing ticket');
        return false;
    }
    if (!env?.HMAC_SECRET) {
        console.warn('[ObserverTicket] HMAC_SECRET not configured');
        return false;
    }
    const parts = ticket.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.warn('[ObserverTicket] malformed ticket');
        return false;
    }
    const ts = Number(parts[0]);
    if (!Number.isFinite(ts)) {
        console.warn('[ObserverTicket] malformed timestamp');
        return false;
    }
    const now = Date.now();
    if (ts - now > OBSERVER_TICKET_FUTURE_SKEW_MS) {
        console.warn('[ObserverTicket] future ticket');
        return false;
    }
    if (now - ts >= OBSERVER_TICKET_TTL_MS) {
        console.warn('[ObserverTicket] expired ticket');
        return false;
    }
    const expected = await hmacHex(env.HMAC_SECRET, `observer:${sessionId}:${ts}`);
    return await constantTimeCompare(expected, parts[1]);
}
