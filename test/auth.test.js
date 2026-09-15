import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateAdminToken, verifyAdminToken, revokeToken,
    checkRateLimit, incrementRateLimit
} from '../src/middleware/auth.js';
import { AUTH } from '../src/config/constants.js';

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
    describe('generateAdminToken', () => {
        it('generates an opaque base64url token with no password material', async () => {
            const kv = mockKv();
            const token = await generateAdminToken({ ADMIN_TOKENS: kv });
            expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(token.split('.')).toHaveLength(1);
        });

        it('stores iat/exp state in KV with the token TTL', async () => {
            const kv = mockKv();
            const before = Date.now();
            const token = await generateAdminToken({ ADMIN_TOKENS: kv });
            const stored = JSON.parse(kv._store.get(`token:${token}`));
            expect(stored.iat).toBeGreaterThanOrEqual(before);
            expect(stored.exp - stored.iat).toBe(AUTH.TOKEN_EXPIRY_MS);
        });

        it('generates unique tokens', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const t1 = await generateAdminToken(env);
            const t2 = await generateAdminToken(env);
            expect(t1).not.toBe(t2);
        });

        it('still returns a token without ADMIN_TOKENS binding', async () => {
            const token = await generateAdminToken({});
            expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        });
    });

    describe('verifyAdminToken', () => {
        it('verifies a valid token', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const token = await generateAdminToken(env);
            expect(await verifyAdminToken(env, token)).toBe(true);
        });

        it('rejects an unknown token', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            expect(await verifyAdminToken(env, 'A'.repeat(43))).toBe(false);
        });

        it('rejects malformed tokens', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            expect(await verifyAdminToken(env, '')).toBe(false);
            expect(await verifyAdminToken(env, null)).toBe(false);
            expect(await verifyAdminToken(env, 12345)).toBe(false);
            expect(await verifyAdminToken(env, 'not-a-valid-token')).toBe(false);
        });

        it('fails closed without ADMIN_TOKENS binding', async () => {
            expect(await verifyAdminToken({}, 'some-token')).toBe(false);
        });

        it('rejects an expired token', async () => {
            const kv = mockKv();
            kv._store.set('token:expired-token', JSON.stringify({ iat: 1, exp: Date.now() - 1000 }));
            expect(await verifyAdminToken({ ADMIN_TOKENS: kv }, 'expired-token')).toBe(false);
        });

        it('rejects corrupt KV state', async () => {
            const kv = mockKv();
            kv._store.set('token:weird', 'not-json');
            expect(await verifyAdminToken({ ADMIN_TOKENS: kv }, 'weird')).toBe(false);
        });

        it('rejects a revoked token', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const token = await generateAdminToken(env);
            await revokeToken(env, token);
            expect(await verifyAdminToken(env, token)).toBe(false);
        });

        it('refreshes the KV TTL when the token is close to expiring', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const token = 'soon-expiring';
            env.ADMIN_TOKENS._store.set(`token:${token}`, JSON.stringify({
                iat: Date.now() - AUTH.TOKEN_EXPIRY_MS,
                exp: Date.now() + 30 * 60 * 1000
            }));
            const putCallsBefore = env.ADMIN_TOKENS.put.mock.calls.length;

            expect(await verifyAdminToken(env, token)).toBe(true);

            const putCalls = env.ADMIN_TOKENS.put.mock.calls.slice(putCallsBefore);
            expect(putCalls.length).toBe(1);
            const stored = JSON.parse(env.ADMIN_TOKENS._store.get(`token:${token}`));
            expect(stored.exp - stored.iat).toBe(AUTH.TOKEN_EXPIRY_MS);
            expect(stored.exp).toBeGreaterThan(Date.now() + AUTH.TOKEN_REFRESH_THRESHOLD_MS);
        });

        it('does not refresh while the token still has plenty of time left', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const token = 'fresh-token';
            env.ADMIN_TOKENS._store.set(`token:${token}`, JSON.stringify({
                iat: Date.now(),
                exp: Date.now() + AUTH.TOKEN_EXPIRY_MS
            }));
            const putCallsBefore = env.ADMIN_TOKENS.put.mock.calls.length;

            expect(await verifyAdminToken(env, token)).toBe(true);
            expect(env.ADMIN_TOKENS.put.mock.calls.length).toBe(putCallsBefore);
        });
    });

    describe('revokeToken', () => {
        it('does nothing without ADMIN_TOKENS binding', async () => {
            await revokeToken({}, 'some-token');
        });

        it('deletes token state from KV', async () => {
            const env = { ADMIN_TOKENS: mockKv() };
            const token = await generateAdminToken(env);
            await revokeToken(env, token);
            expect(env.ADMIN_TOKENS._store.has(`token:${token}`)).toBe(false);
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
