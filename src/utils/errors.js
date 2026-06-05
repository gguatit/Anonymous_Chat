import { getCorsHeaders } from '../config/cors.js';

export function jsonError(message, status = 400, origin) {
    const headers = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' };
    return new Response(JSON.stringify({ error: message }), { status, headers });
}

export function jsonSuccess(data, status = 200, origin) {
    const headers = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' };
    return new Response(JSON.stringify(data), { status, headers });
}

export function textError(message, status = 429) {
    return new Response(message, { status });
}

export function emptyResponse(status = 204, origin) {
    const headers = getCorsHeaders(origin);
    return new Response(null, { status, headers });
}

export function extractErrorMessage(response) {
    if (response.headers.get('Content-Type')?.includes('application/json')) {
        return response.json().then(d => d.error || d.message || JSON.stringify(d)).catch(() => response.statusText);
    }
    return Promise.resolve(response.statusText || `HTTP ${response.status}`);
}
