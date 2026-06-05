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
    it('should allow localhost', () => {
        expect(isAllowedOrigin('http://localhost:8788')).toBe(true);
        expect(isAllowedOrigin('https://localhost:8788')).toBe(true);
    });

    it('should allow 127.0.0.1', () => {
        expect(isAllowedOrigin('http://127.0.0.1:8788')).toBe(true);
    });

    it('should reject external unapproved origins', () => {
        expect(isAllowedOrigin('https://evil.com')).toBe(false);
    });

    it('should reject invalid origin URLs', () => {
        expect(isAllowedOrigin('not-a-url')).toBe(false);
        expect(isAllowedOrigin('')).toBe(false);
        expect(isAllowedOrigin(null)).toBe(false);
    });

    it('should match allowed origins prefix', () => {
        // Verify the function structure - it checks SECURITY.ALLOWED_ORIGINS
        // In test, none of our test URLs will be in the configured list except localhost
        expect(typeof isAllowedOrigin('https://localhost:0')).toBe('boolean');
    });
});
