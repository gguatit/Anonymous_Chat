import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/worker.js';

// Route table mirrors src/worker.js adminRoutes (30 entries)
const adminRouteNames = [
    'login', 'verify', 'metrics', 'sessions', 'messages',
    'delete-error-logs', 'logout', 'logs', 'delete-logs',
    'broadcast', 'edit-message', 'delete-message', 'delete-all-messages',
    'kick-user', 'announce', 'banned-ips', 'unban-ip', 'user-details',
    'audit-logs', 'delete-audit-logs', 'channels', 'channel-details', 'channel-delete',
    'security/events', 'security/stats', 'security/risk-ips',
    'security/events/export', 'security/events/clear',
    'security/badge', 'security/block-ip',
];

const POST_ONLY = new Set([
    'delete-logs', 'delete-audit-logs', 'channel-delete',
    'security/events/clear', 'security/block-ip',
]);

// login and verify are the only admin routes that do not require a bearer token
const UNAUTHENTICATED = new Set(['login', 'verify']);

function makeEnv(overrides = {}) {
    return {
        ASSETS: { fetch: vi.fn(async () => new Response('', { status: 404 })) },
        ADMIN_TOKENS: {
            get: vi.fn(async () => null),
            put: vi.fn(async () => {}),
            delete: vi.fn(async () => {}),
        },
        DB_ADMIN: {
            prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(async () => ({})) })) })),
        },
        TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        FILE_UPLOAD_URL: 'https://files.example.com/api/files',
        KALPHA_API_URL: 'https://api.example.com',
        HMAC_SECRET: 'test-hmac-secret',
        ENVIRONMENT: 'production',
        ...overrides,
    };
}

function makeRequest(path, method = 'GET') {
    return new Request(`https://kalpha.mmv.kr${path}`, {
        method,
        headers: {
            'CF-Connecting-IP': '203.0.113.5',
            Origin: 'https://kalpha.mmv.kr',
        },
    });
}

describe('worker router smoke (real worker.fetch)', () => {
    let env;
    beforeEach(() => {
        env = makeEnv();
    });

    it('serves /health with 200', async () => {
        const res = await worker.fetch(makeRequest('/health'), env);
        expect(res.status).toBe(200);
    });

    it('serves /metrics with 200', async () => {
        const res = await worker.fetch(makeRequest('/metrics'), env);
        expect(res.status).toBe(200);
    });

    it('serves /api/config from env values', async () => {
        const res = await worker.fetch(makeRequest('/api/config'), env);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.turnstileSiteKey).toBe('1x00000000000000000000AA');
        expect(body.fileUploadUrl).toBe('https://files.example.com/api/files');
        expect(body.kalphaApiUrl).toBe('https://api.example.com');
    });

    it('returns 404 for unknown paths and falls back to assets', async () => {
        const res = await worker.fetch(makeRequest('/definitely-not-a-route'), env);
        expect(res.status).toBe(404);
        expect(env.ASSETS.fetch).toHaveBeenCalled();
    });

    describe('admin routes require authentication', () => {
        const protectedRoutes = adminRouteNames.filter((name) => !UNAUTHENTICATED.has(name));

        it.each(protectedRoutes)('/api/admin/%s → 401 without token', async (name) => {
            const method = POST_ONLY.has(name) ? 'POST' : 'GET';
            const res = await worker.fetch(makeRequest(`/api/admin/${name}`, method), env);
            expect(res.status).toBe(401);
        });

        it('metrics without token does not call D1', async () => {
            await worker.fetch(makeRequest('/api/admin/metrics'), env);
            expect(env.DB_ADMIN.prepare).not.toHaveBeenCalled();
        });
    });

    describe('method enforcement', () => {
        it.each([...POST_ONLY])('POST-only route %s rejects GET', async (name) => {
            const res = await worker.fetch(makeRequest(`/api/admin/${name}`, 'GET'), env);
            expect(res.status).not.toBe(401);
            expect(res.status).toBe(404);
        });
    });
});
