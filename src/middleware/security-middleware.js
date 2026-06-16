import { logSecurityEvent } from '../utils/security-logger.js';

export function createSecurityContext(request) {
    const url = new URL(request.url);
    return {
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        path: url.pathname,
        method: request.method,
        userAgent: request.headers.get('User-Agent') || null,
        country: request.headers.get('CF-IPCountry') || null,
    };
}

export async function logAuthFailure(env, ctx, eventType, details) {
    await logSecurityEvent(env, eventType, {
        ip: ctx.ip,
        path: ctx.path,
        method: ctx.method,
        userAgent: ctx.userAgent,
        country: ctx.country,
        details,
    });
}

export async function logEndpointEvent(env, ctx, eventType, details) {
    await logSecurityEvent(env, eventType, {
        ip: ctx.ip,
        path: ctx.path,
        method: ctx.method,
        userAgent: ctx.userAgent,
        country: ctx.country,
        details,
    });
}

export async function logWSEvent(env, eventType, ip, details, sessionId) {
    await logSecurityEvent(env, eventType, {
        ip,
        sessionId,
        details,
    });
}

export async function logSystemEvent(env, eventType, details) {
    await logSecurityEvent(env, eventType, { details });
}
