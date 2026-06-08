import { UPLOAD } from '../config/constants.js';

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

// Verify HMAC signature
export async function verifyMessageSignature(message, signature, secret) {
    const expectedSignature = await generateMessageSignature(message, secret);
    return signature === expectedSignature;
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

export async function safeJson(request) {
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > UPLOAD.MAX_BODY_BYTES) {
        throw new Error('Request body too large');
    }
    return request.json();
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
