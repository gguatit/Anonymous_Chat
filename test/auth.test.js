import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateAdminToken, verifyAdminToken, revokeToken,
    checkRateLimit, incrementRateLimit
} from '../src/middleware/auth.js';

function mockKv(store = new Map()) {
    return {
        get: vi.fn((key) => {
            const val = store.get(key);
            if (val === undefined) return Promise.resolve(null);
            return Promise.resolve(val);
        }),
        put: vi.fn((key, value) => {
            store.set(key, value);
            return Promise.resolve();
        }),
        delete: vi.fn((key) => {
            store.delete(key);
            return Promise.resolve(true);
        }),
        _store: store,
    };
}

describe('auth', () => {
    const SECRET = 'test-hmac-secret-32bytes-long!!';
    const PASSWORD = 'admin-password-123';

    describe('generateAdminToken', () => {
        it('generates a token with data and signature parts', async () => {
            const token = await generateAdminToken(PASSWORD, SECRET);
            const parts = token.split('.');
            expect(parts).toHaveLength(2);

            const data = atob(parts[0]);
            expect(data).toContain(PASSWORD);
            expect(data).toContain(':');
        });

        it('generates different tokens for different timestamps', async () => {
            const token1 = await generateAdminToken(PASSWORD, SECRET);
            await new Promise(r => setTimeout(r, 5));
            const token2 = await generateAdminToken(PASSWORD, SECRET);
            expect(token1).not.toBe(token2);
        });

        it('generates different tokens for different passwords', async () => {
            const t1 = await generateAdminToken('pass1', SECRET);
            const t2 = await generateAdminToken('pass2', SECRET);
            expect(t1).not.toBe(t2);
        });
    });

    describe('verifyAdminToken', () => {
        it('verifies a valid token', async () => {
            const token = await generateAdminToken(PASSWORD, SECRET);
            const result = await verifyAdminToken(token, SECRET, {});
            expect(result).toBe(true);
        });

        it('rejects a token with wrong secret', async () => {
            const token = await generateAdminToken(PASSWORD, SECRET);
            const result = await verifyAdminToken(token, 'wrong-secret', {});
            expect(result).toBe(false);
        });

        it('rejects a malformed token', async () => {
            const result = await verifyAdminToken('not-a-valid-token', SECRET, {});
            expect(result).toBe(false);
        });

        it('rejects a token with tampered data', async () => {
            const token = await generateAdminToken(PASSWORD, SECRET);
            const [dataPart, sigPart] = token.split('.');
            const tampered = btoa('hacker:password:' + Date.now());
            const faked = `${tampered}.${sigPart}`;
            const result = await verifyAdminToken(faked, SECRET, {});
            expect(result).toBe(false);
        });

        it('rejects a token with tampered signature', async () => {
            const token = await generateAdminToken(PASSWORD, SECRET);
            const [dataPart] = token.split('.');
            const faked = `${dataPart}.ZmFrZVNpZ25hdHVyZQ==`;
            const result = await verifyAdminToken(faked, SECRET, {});
            expect(result).toBe(false);
        });

        it('rejects a revoked token', async () => {
            const token = await generateAdminToken(PASSWORD, SECRET);
            const kv = new Map();
            kv.set(`revoked:${token}`, 'true');
            const env = { ADMIN_TOKENS: mockKv(kv) };
            const result = await verifyAdminToken(token, SECRET, env);
            expect(result).toBe(false);
        });

        it('rejects an expired token', async () => {
            const fakeOldToken = (() => {
                const oldData = `${PASSWORD}:${Date.now() - 3 * 60 * 60 * 1000}`;
                return `${btoa(oldData)}.old-signature`;
            })();
            const result = await verifyAdminToken(fakeOldToken, SECRET, {});
            expect(result).toBe(false);
        });
    });

    describe('revokeToken', () => {
        it('does nothing without ADMIN_TOKENS binding', async () => {
            await revokeToken({}, 'some-token');
        });

        it('stores revoked token in KV with TTL', async () => {
            const kv = new Map();
            const env = { ADMIN_TOKENS: mockKv(kv) };
            await revokeToken(env, 'test-token');
            expect(kv.has('revoked:test-token')).toBe(true);
        });
    });

    describe('checkRateLimit', () => {
        it('returns false without ADMIN_TOKENS binding', async () => {
            const result = await checkRateLimit({}, 'admin:auth:1.2.3.4');
            expect(result).toBe(false);
        });

        it('returns false when no data exists', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const result = await checkRateLimit(env, 'admin:auth:1.2.3.4');
            expect(result).toBe(false);
        });

        it('returns true when rate limit exceeded', async () => {
            const now = Date.now();
            const attempts = [];
            for (let i = 0; i < 5; i++) {
                attempts.push(now - i * 1000);
            }
            const kv = new Map();
            kv.set('admin:auth:1.2.3.4', JSON.stringify(attempts));
            const env = { ADMIN_TOKENS: mockKv(kv) };
            const result = await checkRateLimit(env, 'admin:auth:1.2.3.4');
            expect(result).toBe(true);
        });

        it('returns false when attempts are expired', async () => {
            const oldTime = Date.now() - 10 * 60 * 1000;
            const attempts = [oldTime, oldTime - 1000, oldTime - 2000, oldTime - 3000, oldTime - 4000];
            const kv = new Map();
            kv.set('admin:auth:1.2.3.4', JSON.stringify(attempts));
            const env = { ADMIN_TOKENS: mockKv(kv) };
            const result = await checkRateLimit(env, 'admin:auth:1.2.3.4');
            expect(result).toBe(false);
        });
    });

    describe('incrementRateLimit', () => {
        it('does nothing without ADMIN_TOKENS binding', async () => {
            await incrementRateLimit({}, 'admin:auth:1.2.3.4');
        });

        it('stores new attempt timestamp', async () => {
            const kv = new Map();
            const env = { ADMIN_TOKENS: mockKv(kv) };
            await incrementRateLimit(env, 'admin:auth:1.2.3.4');
            const stored = JSON.parse(kv.get('admin:auth:1.2.3.4'));
            expect(Array.isArray(stored)).toBe(true);
            expect(stored).toHaveLength(1);
        });

        it('appends to existing attempts', async () => {
            const now = Date.now();
            const kv = new Map();
            kv.set('admin:auth:1.2.3.4', JSON.stringify([now - 5000]));
            const env = { ADMIN_TOKENS: mockKv(kv) };
            await incrementRateLimit(env, 'admin:auth:1.2.3.4');
            const stored = JSON.parse(kv.get('admin:auth:1.2.3.4'));
            expect(stored).toHaveLength(2);
        });

        it('filters out old attempts beyond expiry', async () => {
            const oldTime = Date.now() - 10 * 60 * 1000;
            const kv = new Map();
            const attempts = [];
            for (let i = 0; i < 10; i++) {
                attempts.push(oldTime - i * 1000);
            }
            kv.set('admin:auth:1.2.3.4', JSON.stringify(attempts));
            const env = { ADMIN_TOKENS: mockKv(kv) };
            await incrementRateLimit(env, 'admin:auth:1.2.3.4');
            const stored = JSON.parse(kv.get('admin:auth:1.2.3.4'));
            expect(stored).toHaveLength(1);
        });
    });
});
