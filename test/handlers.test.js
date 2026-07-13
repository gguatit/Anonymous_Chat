import { describe, it, expect, vi } from 'vitest';
import { handleAdminLogin, handleAdminVerify } from '../src/handlers/admin.js';
import { handleCheckBan } from '../src/handlers/websocket.js';
import { handleTurnstileVerify } from '../src/handlers/turnstile.js';
import { handleGetVapidKey } from '../src/handlers/push.js';

function cors() {
    return { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
}

describe('handleAdminLogin', () => {
    it('returns 503 when HMAC_SECRET is missing', async () => {
        const req = new Request('https://example.com/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ admin_id: 'test', admin_password: 'test' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await handleAdminLogin(req, {}, cors());
        expect(res.status).toBe(503);
    });

    it('returns 400 for invalid json body', async () => {
        const env = { HMAC_SECRET: 'secret' };
        const req = new Request('https://example.com/api/admin/login', {
            method: 'POST',
            body: 'not-json',
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await handleAdminLogin(req, env, cors());
        expect(res.status).toBe(400);
    });

    it('returns 503 when ADMIN_ID/PASSWORD not configured', async () => {
        const env = { HMAC_SECRET: 'secret' };
        const req = new Request('https://example.com/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ admin_id: 'test', admin_password: 'test' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await handleAdminLogin(req, env, cors());
        expect(res.status).toBe(503);
    });

    it('rejects wrong credentials', async () => {
        const env = {
            HMAC_SECRET: 'secret',
            ADMIN_ID: 'admin',
            ADMIN_PASSWORD: 'correct-password'
        };
        const req = new Request('https://example.com/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ admin_id: 'admin', admin_password: 'wrong' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await handleAdminLogin(req, env, cors());
        expect(res.status).toBe(401);
    });
});

describe('handleAdminVerify', () => {
    it('returns 401 without authorization header', async () => {
        const req = new Request('https://example.com/api/admin/verify');
        const res = await handleAdminVerify(req, {}, cors());
        expect(res.status).toBe(401);
    });

    it('returns 401 with malformed token', async () => {
        const req = new Request('https://example.com/api/admin/verify', {
            headers: { 'Authorization': 'Bearer invalid.token' }
        });
        const env = { HMAC_SECRET: 'test-secret' };
        const res = await handleAdminVerify(req, env, cors());
        expect(res.status).toBe(401);
    });
});

describe('handleCheckBan', () => {
    it('returns ban status for valid sessionId', async () => {
        const req = new Request('https://example.com/api/check-ban?sessionId=user_test123');
        const env = {
            HMAC_SECRET: 'secret',
            CHAT_ROOM: {
                idFromName: vi.fn(() => 'test-id'),
                get: vi.fn(() => ({
                    fetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ banned: false }))))
                }))
            }
        };
        const res = await handleCheckBan(req, env, cors());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.banned).toBe(false);
    });

    it('detects banned user', async () => {
        const req = new Request('https://example.com/api/check-ban?sessionId=user_banned');
        const env = {
            HMAC_SECRET: 'secret',
            CHAT_ROOM: {
                idFromName: vi.fn(() => 'test-id'),
                get: vi.fn(() => ({
                    fetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ banned: true, reason: 'spam' }))))
                }))
            }
        };
        const res = await handleCheckBan(req, env, cors());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.banned).toBe(true);
    });
});

describe('handleTurnstileVerify', () => {
    it('rejects non-POST requests', async () => {
        const req = new Request('https://example.com/api/turnstile/verify');
        const res = await handleTurnstileVerify(req, {}, cors());
        expect(res.status).toBe(405);
    });

    it('rejects missing token', async () => {
        const req = new Request('https://example.com/api/turnstile/verify', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await handleTurnstileVerify(req, {}, cors());
        expect(res.status).toBe(400);
    });

    it('returns 500 when TURNSTILE_SECRET_KEY is not configured', async () => {
        const req = new Request('https://example.com/api/turnstile/verify', {
            method: 'POST',
            body: JSON.stringify({ token: 'valid-looking-token-123' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const res = await handleTurnstileVerify(req, {}, cors());
        expect(res.status).toBe(500);
    });
});

describe('handleGetVapidKey', () => {
    it('returns 503 when VAPID_PUBLIC_KEY is missing', async () => {
        const req = new Request('https://example.com/api/push/vapid-key');
        const res = await handleGetVapidKey(req, {}, cors());
        expect([500, 503]).toContain(res.status);
    });

    it('returns the VAPID key when configured', async () => {
        const env = { VAPID_PUBLIC_KEY: 'test-vapid-public-key-12345' };
        const req = new Request('https://example.com/api/push/vapid-key');
        const res = await handleGetVapidKey(req, env, cors());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.publicKey).toBe('test-vapid-public-key-12345');
    });
});
