import { AUTH } from '../config/constants.js';
import { logSecurityEvent } from '../utils/logger.js';

// Rate Limit 체크 (IP당 5회 실패 시 5분간 차단)
export async function checkRateLimit(env, key) {
    if (!env?.ADMIN_TOKENS) {
        console.warn('[Auth] ADMIN_TOKENS binding missing — login rate limiting disabled (fail-open)');
        return false;
    }
    
    const data = await env.ADMIN_TOKENS.get(key);
    if (!data) return false;
    
    try {
        const attempts = JSON.parse(data);
        const now = Date.now();
        
        const recentAttempts = attempts.filter(t => now - t < AUTH.RATE_LIMIT_EXPIRE);
        return recentAttempts.length >= AUTH.MAX_FAILED_ATTEMPTS;
    } catch (_e) { /* expected: corrupt KV data */
        console.warn('[Auth] Corrupt rate limit KV entry — ignoring it (fail-open)');
        return false;
    }
}

// Rate Limit 증가
export async function incrementRateLimit(env, key) {
    if (!env?.ADMIN_TOKENS) return;
    
    try {
        const data = await env.ADMIN_TOKENS.get(key);
        const attempts = data ? JSON.parse(data) : [];
        const now = Date.now();
        
        // 5분 이내의 시도만 유지
        const recentAttempts = attempts.filter(t => now - t < AUTH.RATE_LIMIT_EXPIRE);
        recentAttempts.push(now);
        
        await env.ADMIN_TOKENS.put(key, JSON.stringify(recentAttempts), {
            expirationTtl: AUTH.KV_TTL_SECONDS
        });
    } catch (error) {
        console.error('Rate limit error:', error);
    }
}

// Revoke token (logout): delete its server-side state
export async function revokeToken(env, token) {
    if (!env?.ADMIN_TOKENS || !token) return;
    await env.ADMIN_TOKENS.delete(`${TOKEN_PREFIX}${token}`);
}

const TOKEN_PREFIX = 'token:';

function generateRandomTokenValue() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate an opaque admin token; only its hash-free random value is kept server-side in KV
export async function generateAdminToken(env) {
    const token = generateRandomTokenValue();
    if (env?.ADMIN_TOKENS) {
        const now = Date.now();
        await env.ADMIN_TOKENS.put(`${TOKEN_PREFIX}${token}`, JSON.stringify({ iat: now, exp: now + AUTH.TOKEN_EXPIRY_MS }), {
            expirationTtl: AUTH.TOKEN_EXPIRY_MS / 1000
        });
    }
    return token;
}

// Verify opaque admin token against KV state (no credentials in payload, no local signature check)
export async function verifyAdminToken(env, token, ip = null) {
    if (!token || typeof token !== 'string' || !env?.ADMIN_TOKENS) {
        await logSecurityEvent(env, 'TOKEN_INVALID', {
            ip,
            details: 'Token verification unavailable or malformed',
        });
        return false;
    }

    try {
        const data = await env.ADMIN_TOKENS.get(`${TOKEN_PREFIX}${token}`);
        if (!data) {
            await logSecurityEvent(env, 'TOKEN_INVALID', {
                ip,
                details: 'Token not found, revoked or expired',
            });
            return false;
        }

        const { exp } = JSON.parse(data);
        if (!exp || Date.now() > exp) {
            await logSecurityEvent(env, 'TOKEN_EXPIRED', {
                ip,
                details: 'Token expired',
            });
            return false;
        }

        // Sliding session: extend KV TTL when the token is close to expiring
        if (exp - Date.now() < AUTH.TOKEN_REFRESH_THRESHOLD_MS) {
            try {
                const now = Date.now();
                await env.ADMIN_TOKENS.put(`${TOKEN_PREFIX}${token}`, JSON.stringify({ iat: now, exp: now + AUTH.TOKEN_EXPIRY_MS }), {
                    expirationTtl: AUTH.TOKEN_EXPIRY_MS / 1000
                });
            } catch (error) {
                // Refresh is best-effort; the token is still valid for its remaining lifetime
                console.error('[Auth] Failed to refresh admin token TTL:', error);
            }
        }

        return true;
    } catch (_e) {
        await logSecurityEvent(env, 'TOKEN_INVALID', {
            details: 'Token verification error',
        });
        return false;
    }
}
