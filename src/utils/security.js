import { SECURITY } from '../config/constants.js';

// Sleep 함수 (타이밍 공격 방지용)
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 상수 시간 비교 (타이밍 공격 방지)
export async function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    
    // 길이가 다르면 항상 false지만, 타이밍 공격 방지를 위해 전체 비교
    const maxLen = Math.max(aBytes.length, bBytes.length);
    let result = aBytes.length === bBytes.length ? 0 : 1;
    
    for (let i = 0; i < maxLen; i++) {
        const aByte = i < aBytes.length ? aBytes[i] : 0;
        const bByte = i < bBytes.length ? bBytes[i] : 0;
        result |= aByte ^ bByte;
    }
    
    return result === 0;
}

// Check if origin is allowed
export function isAllowedOrigin(origin) {
    try {
        const url = new URL(origin);
        // In development, allow localhost
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return true;
        }
        // In production, check against allowed origins
        return SECURITY.ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    } catch (_e) { /* expected: invalid origin URL */
        return false;
    }
}
