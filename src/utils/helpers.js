import { UPLOAD, SECURITY } from '../config/constants.js';
import { constantTimeCompare } from './security.js';

// HMAC signature generation for message integrity
export async function generateMessageSignature(message, secret) {
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

// Verify HMAC signature (constant-time) and reject stale replayed timestamps
export async function verifyMessageSignature(message, signature, secret, maxSkewMs = SECURITY.SIGNATURE_MAX_SKEW_MS) {
    const ts = Number(message.timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkewMs) {
        return false;
    }
    const expectedSignature = await generateMessageSignature(message, secret);
    return await constantTimeCompare(signature, expectedSignature);
}

// Helper function to convert ArrayBuffer to hex string
export function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Shared input sanitizer: strips control characters + normalizes line breaks
export function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\r\n?/g, '\n');
}

const BODY_TOO_LARGE = 'Request body too large';

export function isBodyTooLargeError(error) {
    return error instanceof Error && error.message === BODY_TOO_LARGE;
}

// Reads the request body while enforcing a real byte cap (Content-Length alone is spoofable/optional)
export async function readBodyCapped(request, maxBytes = UPLOAD.MAX_BODY_BYTES) {
    const declared = parseInt(request.headers.get('content-length') || '0', 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new Error(BODY_TOO_LARGE);
    }
    if (!request.body) {
        return '';
    }

    const reader = request.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
                throw new Error(BODY_TOO_LARGE);
            }
            chunks.push(value);
        }
    } finally {
        try { await reader.cancel(); } catch (_e) { /* stream already closed */ }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
}

export async function safeJson(request, maxBytes = UPLOAD.MAX_BODY_BYTES) {
    return JSON.parse(await readBodyCapped(request, maxBytes));
}

export function isValidFileUrl(url, allowedOrigins = []) {
    if (typeof url !== 'string' || !url) return false;
    if (url.startsWith('/api/file/')) return true;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        if (allowedOrigins.length > 0) {
            return allowedOrigins.some(origin => url.startsWith(origin));
        }
        return true;
    } catch (_e) { /* expected: invalid URL */
        return false;
    }
}
