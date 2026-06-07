import { AUTH } from '../config/constants.js';

// Rate Limit 체크 (IP당 5회 실패 시 5분간 차단)
export async function checkRateLimit(env, key) {
    if (!env?.ADMIN_TOKENS) return false;
    
    const data = await env.ADMIN_TOKENS.get(key);
    if (!data) return false;
    
    try {
        const attempts = JSON.parse(data);
        const now = Date.now();
        
        const recentAttempts = attempts.filter(t => now - t < AUTH.RATE_LIMIT_EXPIRE);
        return recentAttempts.length >= AUTH.MAX_FAILED_ATTEMPTS;
    } catch (_e) { /* expected: corrupt KV data */
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

// Revoke token with matching TTL to token expiration
export async function revokeToken(env, token) {
    if (!env?.ADMIN_TOKENS) return;
    await env.ADMIN_TOKENS.put(`revoked:${token}`, 'true', {
        expirationTtl: AUTH.TOKEN_EXPIRY_MS / 1000
    });
}

// Generate admin token
export async function generateAdminToken(password, secret) {
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

// Verify admin token
export async function verifyAdminToken(token, secret, env) {
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
        const parts = data.split(':');
        const timestamp = parts[parts.length - 1];
        
        // Token expires
        if (Date.now() - parseInt(timestamp) > AUTH.TOKEN_EXPIRY_MS) {
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
    } catch (_e) { /* expected: malformed token */
        return false;
    }
}
