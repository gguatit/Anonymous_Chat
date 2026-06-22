import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAdminLogout } from '../src/handlers/admin.js';
import { generateAdminToken } from '../src/middleware/auth.js';

function mockKv() {
    const store = new Map();
    return {
        get: vi.fn(async (key) => store.get(key) ?? null),
        put: vi.fn(async (key, value) => { store.set(key, value); }),
        _store: store,
    };
}

function mockDb() {
    return {
        prepare: vi.fn(function () { return this; }),
        bind: vi.fn(function () { return this; }),
        run: vi.fn(async () => ({ changes: 0, meta: { changes: 0 } })),
    };
}

function mockEnv() {
    return {
        DB_ADMIN: mockDb(),
        HMAC_SECRET: 'test-secret-key-for-admin-tokens',
        ADMIN_TOKENS: mockKv(),
    };
}

function cors() {
    return { 'Access-Control-Allow-Origin': '*' };
}

describe('handleAdminLogout', () => {
    let env;
    beforeEach(() => {
        env = mockEnv();
    });

    it('returns 401 when Authorization header is missing', async () => {
        const req = new Request('https://example.com/api/admin/logout', { method: 'POST' });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization header is not Bearer scheme', async () => {
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(401);
    });

    it('returns 401 when Bearer token is malformed', async () => {
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer not-a-real-token' }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(401);
    });

    it('returns 401 when Bearer token signature is invalid', async () => {
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer header.sig' }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(401);
    });

    it('returns 200 and does NOT revoke token when token is invalid', async () => {
        const fakeToken = 'fake.fake';
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${fakeToken}` }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(401);
        expect(env.ADMIN_TOKENS.put).not.toHaveBeenCalled();
    });

    it('returns 200 and revokes token for a valid token', async () => {
        const validToken = await generateAdminToken('testpassword', env.HMAC_SECRET);
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        const revoked = await env.ADMIN_TOKENS.get(`revoked:${validToken}`);
        expect(revoked).toBe('true');
    });

    it('returns 200 even when ADMIN_TOKENS is missing', async () => {
        const validToken = await generateAdminToken('testpassword', env.HMAC_SECRET);
        delete env.ADMIN_TOKENS;
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(200);
    });
});
