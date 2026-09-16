import { describe, it, expect, vi } from 'vitest';
import { handleAdminObserverTicket } from '../src/handlers/admin.js';
import { generateAdminToken } from '../src/middleware/auth.js';
import { verifyObserverTicket } from '../src/handlers/turnstile.js';

function makeEnv() {
    const store = new Map();
    return {
        HMAC_SECRET: 'test-secret-for-observer-tickets',
        DB_ADMIN: {
            prepare() { return this; },
            bind() { return this; },
            all() { return Promise.resolve({ results: [] }); },
            first() { return Promise.resolve(null); },
            run() { return Promise.resolve({ changes: 0 }); }
        },
        ADMIN_TOKENS: {
            get: vi.fn(async (key) => store.get(key) ?? null),
            put: vi.fn(async (key, value) => { store.set(key, value); }),
            delete: vi.fn(async (key) => { store.delete(key); })
        }
    };
}

function cors() {
    return { 'Access-Control-Allow-Origin': '*' };
}

function makeRequest(token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return new Request('https://example.com/api/admin/observer-ticket', { method: 'POST', headers });
}

describe('POST /api/admin/observer-ticket', () => {
    it('requires admin authentication', async () => {
        const env = makeEnv();
        const res = await handleAdminObserverTicket(makeRequest(null), env, cors());
        expect(res.status).toBe(401);
    });

    it('issues an observer session id and a verifiable 5-minute ticket', async () => {
        const env = makeEnv();
        const token = await generateAdminToken(env);

        const res = await handleAdminObserverTicket(makeRequest(token), env, cors());
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.sessionId).toMatch(/^admin_obs_[a-f0-9]{16}$/);
        expect(typeof body.ticket).toBe('string');
        expect(body.expiresIn).toBe(300);

        expect(await verifyObserverTicket(env, body.ticket, body.sessionId)).toBe(true);
        expect(await verifyObserverTicket(env, body.ticket, 'admin_obs_other')).toBe(false);
    });

    it('issues unique tickets per request', async () => {
        const env = makeEnv();
        const token = await generateAdminToken(env);

        const first = await (await handleAdminObserverTicket(makeRequest(token), env, cors())).json();
        const second = await (await handleAdminObserverTicket(makeRequest(token), env, cors())).json();

        expect(first.sessionId).not.toBe(second.sessionId);
        expect(first.ticket).not.toBe(second.ticket);
    });
});
