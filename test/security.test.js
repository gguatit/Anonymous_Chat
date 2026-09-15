import { describe, it, expect } from 'vitest';
import { constantTimeCompare, isAllowedOrigin } from '../src/utils/security.js';

describe('constantTimeCompare', () => {
    it('should return true for equal strings', async () => {
        expect(await constantTimeCompare('hello', 'hello')).toBe(true);
        expect(await constantTimeCompare('abc123', 'abc123')).toBe(true);
    });

    it('should return false for different strings', async () => {
        expect(await constantTimeCompare('hello', 'world')).toBe(false);
        expect(await constantTimeCompare('abc', 'abcd')).toBe(false);
    });

    it('should return false for different lengths', async () => {
        expect(await constantTimeCompare('short', 'longerstring')).toBe(false);
        expect(await constantTimeCompare('longerstring', 'short')).toBe(false);
    });

    it('should return false for non-string inputs', async () => {
        expect(await constantTimeCompare(null, 'hello')).toBe(false);
        expect(await constantTimeCompare('hello', null)).toBe(false);
        expect(await constantTimeCompare(123, 'hello')).toBe(false);
        expect(await constantTimeCompare(undefined, 'hello')).toBe(false);
    });

    it('should be case-sensitive', async () => {
        expect(await constantTimeCompare('Hello', 'hello')).toBe(false);
    });

    it('should handle empty strings', async () => {
        expect(await constantTimeCompare('', '')).toBe(true);
    });

    it('should handle unicode', async () => {
        expect(await constantTimeCompare('안녕', '안녕')).toBe(true);
        expect(await constantTimeCompare('안녕', '하세요')).toBe(false);
    });
});

describe('isAllowedOrigin', () => {
    const dev = { ENVIRONMENT: 'development' };
    const prod = { ENVIRONMENT: 'production' };

    it('allows localhost only in development', () => {
        expect(isAllowedOrigin('http://localhost:8788', dev)).toBe(true);
        expect(isAllowedOrigin('http://127.0.0.1:8788', dev)).toBe(true);
        expect(isAllowedOrigin('http://localhost:8788', prod)).toBe(false);
        expect(isAllowedOrigin('http://127.0.0.1:8788', prod)).toBe(false);
    });

    it('allows the configured production origin exactly', () => {
        expect(isAllowedOrigin('https://kalpha.mmv.kr', prod)).toBe(true);
    });

    it('rejects origin prefix and userinfo tricks', () => {
        expect(isAllowedOrigin('https://kalpha.mmv.kr.evil.com', prod)).toBe(false);
        expect(isAllowedOrigin('https://kalpha.mmv.kr@evil.com', prod)).toBe(false);
        expect(isAllowedOrigin('https://evil.com', prod)).toBe(false);
    });

    it('rejects invalid origin URLs', () => {
        expect(isAllowedOrigin('not-a-url', prod)).toBe(false);
        expect(isAllowedOrigin('', prod)).toBe(false);
        expect(isAllowedOrigin(null, prod)).toBe(false);
    });
});
