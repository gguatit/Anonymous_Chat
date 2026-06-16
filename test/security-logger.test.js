import { describe, it, expect, beforeEach } from 'vitest';
import { logSecurityEvent, clearDedupCache } from '../src/utils/security-logger.js';
import { SECURITY_EVENTS } from '../src/constants/security-events.js';

function createMockEnv() {
    const called = [];
    const db = {
        prepare(sql) {
            const stmt = {
                _boundValues: [],
                bind(...values) {
                    this._boundValues = values;
                    return this;
                },
                async run() {
                    return { success: true };
                },
            };
            called.push({ sql, start: sql.substring(0, 30), stmt });
            return stmt;
        },
    };
    return { DB_ADMIN: db, _called: called };
}

function lastInsertBindings(env) {
    const insertCall = env._called.findLast((c) => c.start.includes('INSERT'));
    return insertCall?.stmt?._boundValues || [];
}

describe('security-logger', () => {
    beforeEach(() => {
        clearDedupCache();
    });

    it('should insert a security event into D1', async () => {
        const env = createMockEnv();

        await logSecurityEvent(env, 'LOGIN_FAIL', {
            ip: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            path: '/api/admin/login',
            method: 'POST',
            details: 'Invalid credentials',
        });

        expect(env._called.length).toBeGreaterThanOrEqual(1);
        const insertCall = env._called.find((c) => c.start.includes('INSERT'));
        expect(insertCall).toBeDefined();

        const bound = lastInsertBindings(env);
        expect(bound[0]).toBe(SECURITY_EVENTS.LOGIN_FAIL.type);
        expect(bound[1]).toBe(SECURITY_EVENTS.LOGIN_FAIL.category);
        expect(bound[2]).toBe(SECURITY_EVENTS.LOGIN_FAIL.severity);
        expect(bound[3]).toBe(SECURITY_EVENTS.LOGIN_FAIL.score);
        expect(bound[4]).toBe('192.168.1.1');
        expect(bound[5]).toBe('Mozilla/5.0');
        expect(bound[6]).toBeNull();
        expect(bound[7]).toBe('/api/admin/login');
        expect(bound[8]).toBe('POST');
    });

    it('should deduplicate same ip + event_type within 1 minute', async () => {
        const env = createMockEnv();

        await logSecurityEvent(env, 'LOGIN_FAIL', { ip: '192.168.1.1' });
        await logSecurityEvent(env, 'LOGIN_FAIL', { ip: '192.168.1.1' });

        const insertCalls = env._called.filter((c) => c.start.includes('INSERT'));
        expect(insertCalls.length).toBe(1);
    });

    it('should allow different event_types for same IP', async () => {
        const env = createMockEnv();

        await logSecurityEvent(env, 'LOGIN_FAIL', { ip: '192.168.1.1' });
        await logSecurityEvent(env, 'XSS_PAYLOAD', { ip: '192.168.1.1' });

        const insertCalls = env._called.filter((c) => c.start.includes('INSERT'));
        expect(insertCalls.length).toBe(2);
    });

    it('should allow same event_type for different IPs', async () => {
        const env = createMockEnv();

        await logSecurityEvent(env, 'LOGIN_FAIL', { ip: '192.168.1.1' });
        await logSecurityEvent(env, 'LOGIN_FAIL', { ip: '10.0.0.1' });

        const insertCalls = env._called.filter((c) => c.start.includes('INSERT'));
        expect(insertCalls.length).toBe(2);
    });

    it('should return early if DB_ADMIN is not available', async () => {
        await expect(logSecurityEvent({}, 'LOGIN_FAIL', { ip: '192.168.1.1' })).resolves.toBeUndefined();
    });

    it('should return early for unknown event types', async () => {
        const env = createMockEnv();
        await logSecurityEvent(env, 'UNKNOWN_TYPE', { ip: '192.168.1.1' });
        await logSecurityEvent(env, null, { ip: '192.168.1.1' });

        const insertCalls = env._called.filter((c) => c.start.includes('INSERT'));
        expect(insertCalls.length).toBe(0);
    });

    it('should include optional fields when provided', async () => {
        const env = createMockEnv();

        await logSecurityEvent(env, 'SQL_INJECTION', {
            ip: '10.0.0.1',
            country: 'RU',
            sessionId: 'abc123',
            details: "'; DROP TABLE users;",
            metadata: { field: 'message', pattern: 'DROP' },
        });

        const bound = lastInsertBindings(env);
        expect(bound[6]).toBe('RU');
        expect(bound[9]).toBe('abc123');
        expect(bound[10]).toBe("'; DROP TABLE users;");
        expect(bound[11]).toBe('{"field":"message","pattern":"DROP"}');
    });

    it('should trigger cleanup probabilistically', async () => {
        const env = createMockEnv();
        let cleanupTriggered = false;

        for (let i = 0; i < 200; i++) {
            const db = {
                prepare(sql) {
                    if (sql.includes('DELETE')) {
                        cleanupTriggered = true;
                    }
                    return { bind() { return this; }, async run() { return { success: true }; } };
                },
            };
            await logSecurityEvent({ DB_ADMIN: db }, 'LOGIN_FAIL', { ip: `192.168.1.${i}` });
        }

        expect(cleanupTriggered).toBe(true);
    });
});
