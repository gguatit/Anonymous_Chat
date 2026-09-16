import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAdminLogout, handleAdminAnnounce, handleAdminLogin, handleAdminKickUser } from '../src/handlers/admin.js';
import { generateAdminToken } from '../src/middleware/auth.js';
import { BAN_DURATIONS } from '../src/config/constants.js';

function mockKv() {
    const store = new Map();
    return {
        get: vi.fn(async (key) => store.get(key) ?? null),
        put: vi.fn(async (key, value) => { store.set(key, value); }),
        delete: vi.fn(async (key) => { store.delete(key); }),
        _store: store,
    };
}

function mockDb() {
    return {
        prepare: vi.fn(function () { return this; }),
        bind: vi.fn(function () { return this; }),
        run: vi.fn(async () => ({ changes: 0, meta: { changes: 0 } })),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
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
        const validToken = await generateAdminToken(env);
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        const stored = await env.ADMIN_TOKENS.get(`token:${validToken}`);
        expect(stored).toBe(null);
    });

    it('returns 401 when ADMIN_TOKENS is missing (fail-closed)', async () => {
        const validToken = await generateAdminToken(env);
        delete env.ADMIN_TOKENS;
        const req = new Request('https://example.com/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const res = await handleAdminLogout(req, env, cors());
        expect(res.status).toBe(401);
    });
});

describe('handleAdminAnnounce emergency field mapping', () => {
    let env;
    let forwarded;

    beforeEach(async () => {
        env = mockEnv();
        forwarded = [];
        env.CHAT_ROOM = {
            idFromName: vi.fn(() => 'do-id'),
            get: vi.fn(() => ({
                fetch: vi.fn(async (request) => {
                    forwarded.push(await request.clone().json());
                    return new Response(JSON.stringify({ success: true }), { status: 200 });
                }),
            })),
        };
        env._token = await generateAdminToken(env);
    });

    async function sendAnnounce(body, method = 'POST') {
        const req = new Request('https://example.com/api/admin/announce', {
            method,
            headers: {
                'Authorization': `Bearer ${env._token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        return await handleAdminAnnounce(req, env, cors());
    }

    it('maps the legacy "emergency" field to isEmergency for the DO', async () => {
        const future = Date.now() + 3600000;
        const res = await sendAnnounce({ content: '긴급 공지', emergency: true, emergencyUntil: future });
        expect(res.status).toBe(200);
        expect(forwarded.length).toBe(1);
        expect(forwarded[0].isEmergency).toBe(true);
        expect(forwarded[0].emergencyUntil).toBe(future);
    });

    it('stores the emergency expiry in D1', async () => {
        const future = Date.now() + 3600000;
        const res = await sendAnnounce({ content: '긴급 공지', isEmergency: true, emergencyUntil: future });
        expect(res.status).toBe(200);
        const bindArgs = env.DB_ADMIN.bind.mock.calls[0];
        expect(bindArgs[2]).toBe(1);
        expect(bindArgs[3]).toBe(future);
    });

    it('passes through the canonical isEmergency field', async () => {
        const res = await sendAnnounce({ content: '일반 공지', isEmergency: false });
        expect(res.status).toBe(200);
        expect(forwarded[0].isEmergency).toBe(false);
    });

    it('does not invent isEmergency when neither field is present', async () => {
        const res = await sendAnnounce({ content: '공지' });
        expect(res.status).toBe(200);
        expect(Object.hasOwn(forwarded[0], 'isEmergency')).toBe(false);
    });

    it('does not forward expiresAt — announcements persist until manual deletion', async () => {
        const res = await sendAnnounce({ content: '영구 공지', expiresAt: Date.now() + 3600000 });
        expect(res.status).toBe(200);
        expect(Object.hasOwn(forwarded[0], 'expiresAt')).toBe(false);
    });

    it('returns 404 when updating a missing announcement', async () => {
        const res = await sendAnnounce({ content: '수정', timestamp: 12345 }, 'PUT');
        expect(res.status).toBe(404);
        expect(forwarded.length).toBe(0);
    });

    it('updates the D1 row and forwards the merged values (PUT)', async () => {
        env.DB_ADMIN.first.mockResolvedValue({ content: 'old content', is_emergency: 0 });
        const res = await sendAnnounce({ content: 'new content', timestamp: 12345 }, 'PUT');
        expect(res.status).toBe(200);
        expect(forwarded[0]).toMatchObject({ content: 'new content', timestamp: 12345 });
    });

    it('returns 404 when deleting a missing announcement', async () => {
        const res = await sendAnnounce({ timestamp: 12345 }, 'DELETE');
        expect(res.status).toBe(404);
        expect(forwarded.length).toBe(0);
    });

    it('forwards the latest remaining announcement as nextAnnouncement on delete', async () => {
        env.DB_ADMIN.run.mockResolvedValue({ changes: 1, meta: { changes: 1 } });
        env.DB_ADMIN.first.mockResolvedValue({ timestamp: 555, content: '남은 공지', is_emergency: 0 });
        const res = await sendAnnounce({ timestamp: 12345 }, 'DELETE');
        expect(res.status).toBe(200);
        expect(forwarded[0].nextAnnouncement).toEqual({ timestamp: 555, content: '남은 공지', isEmergency: false });
    });
});

describe('handleAdminKickUser ban duration normalization', () => {
    let env;
    let forwarded;

    beforeEach(async () => {
        env = mockEnv();
        forwarded = [];
        env.CHAT_ROOM = {
            idFromName: vi.fn(() => 'do-id'),
            get: vi.fn(() => ({
                fetch: vi.fn(async (request) => {
                    forwarded.push(await request.clone().json());
                    return new Response(JSON.stringify({ success: true }), { status: 200 });
                }),
            })),
        };
        env._token = await generateAdminToken(env);
    });

    async function kick(banDuration) {
        const req = new Request('https://example.com/api/admin/kick-user', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env._token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: 'user_1', banDuration }),
        });
        return await handleAdminKickUser(req, env, cors());
    }

    it.each([
        [NaN, 0],
        [Infinity, 0],
        ['Infinity', 0],
        [-60, 0],
        ['not-a-number', 0],
        [0, 0],
        ['300', 300],
        [12.9, 12],
        [BAN_DURATIONS.MAX_IP_BAN_SECONDS + 1000, BAN_DURATIONS.MAX_IP_BAN_SECONDS],
    ])('normalizes banDuration %s to %s', async (input, expected) => {
        const res = await kick(input);
        expect(res.status).toBe(200);
        expect(forwarded[0].banDuration).toBe(expected);
    });
});

describe('admin login lockout counting (M2)', () => {
    it('counts malformed login bodies toward the lockout', async () => {
        const env = mockEnv();
        const sendMalformed = () => handleAdminLogin(
            new Request('https://example.com/api/admin/login', {
                method: 'POST',
                headers: { 'CF-Connecting-IP': '203.0.113.99', 'Content-Type': 'application/json' },
                body: 'not-json'
            }),
            env,
            cors()
        );

        for (let i = 0; i < 5; i++) {
            const res = await sendMalformed();
            expect(res.status).toBe(400);
        }

        const blocked = await sendMalformed();
        expect(blocked.status).toBe(429);
    });
});
