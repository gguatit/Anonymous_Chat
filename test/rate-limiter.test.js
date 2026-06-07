import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRateLimiter } from '../src/utils/rate-limiter.js';

describe('createRateLimiter', () => {
    let limiter;

    afterEach(() => {
        if (limiter) limiter.destroy();
    });

    it('should allow first request', () => {
        limiter = createRateLimiter(0);
        const config = { windowMs: 60000, max: 5 };
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);
    });

    it('should block after max reached', () => {
        limiter = createRateLimiter(0);
        const config = { windowMs: 60000, max: 3 };
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(false);
    });

    it('should distinguish IPs', () => {
        limiter = createRateLimiter(0);
        const config = { windowMs: 60000, max: 1 };
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(false);
        expect(limiter.checkRateLimit('192.168.1.1', config)).toBe(true);
    });

    it('should distinguish tags', () => {
        limiter = createRateLimiter(0);
        const config = { windowMs: 60000, max: 1 };
        expect(limiter.checkRateLimit('127.0.0.1', config, 'api')).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config, 'ws')).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config, 'api')).toBe(false);
    });

    it('should not error when destroyed', () => {
        limiter = createRateLimiter(0);
        const config = { windowMs: 60000, max: 5 };
        limiter.destroy();
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(false);
    });

    it('should cleanup expired entries', () => {
        vi.useFakeTimers();
        const now = Date.now();

        limiter = createRateLimiter(0);
        const config = { windowMs: 1000, max: 1 };

        // First request creates entry
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(false);

        // Advance time past window
        vi.setSystemTime(now + 2000);

        // Should allow again (window expired)
        expect(limiter.checkRateLimit('127.0.0.1', config)).toBe(true);

        vi.useRealTimers();
    });

    it('should not error on cleanup when empty', () => {
        limiter = createRateLimiter(0);
        limiter.cleanup();
        // no error = pass
    });

    it('should clear interval on destroy', () => {
        limiter = createRateLimiter(300000);
        expect(typeof limiter.destroy).toBe('function');
        limiter.destroy();
        // No errors on destroy = pass
    });

    it('should have all expected methods', () => {
        limiter = createRateLimiter(0);
        expect(typeof limiter.checkRateLimit).toBe('function');
        expect(typeof limiter.cleanup).toBe('function');
        expect(typeof limiter.destroy).toBe('function');
    });
});
