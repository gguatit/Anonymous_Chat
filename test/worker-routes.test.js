import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/worker.js';
import { API_RATE_LIMIT } from '../src/config/constants.js';
import { createRateLimiter } from '../src/utils/rate-limiter.js';

// Route table mirrors src/worker.js adminRoutes (31 entries)
const adminRouteNames = [
    'login', 'verify', 'metrics', 'sessions', 'messages',
    'delete-error-logs', 'logout', 'logs', 'delete-logs',
    'broadcast', 'edit-message', 'delete-message', 'delete-all-messages',
    'kick-user', 'announce', 'banned-ips', 'unban-ip', 'user-details',
    'audit-logs', 'delete-audit-logs', 'channels', 'channel-details', 'channel-delete',
    'security/events', 'security/stats', 'security/risk-ips',
    'security/events/export', 'security/events/clear',
    'security/badge', 'security/block-ip', 'observer-ticket',
];

// Real method per route; announce also accepts PUT/DELETE
const ROUTE_METHODS = {
    login: 'POST',
    verify: 'POST',
    metrics: 'GET',
    sessions: 'GET',
    messages: 'GET',
    'delete-error-logs': 'POST',
    logout: 'POST',
    logs: 'GET',
    'delete-logs': 'POST',
    broadcast: 'POST',
    'edit-message': 'POST',
    'delete-message': 'POST',
    'delete-all-messages': 'POST',
    'kick-user': 'POST',
    announce: 'POST',
    'banned-ips': 'GET',
    'unban-ip': 'POST',
    'user-details': 'GET',
    'audit-logs': 'GET',
    'delete-audit-logs': 'POST',
    channels: 'GET',
    'channel-details': 'GET',
    'channel-delete': 'POST',
    'security/events': 'GET',
    'security/stats': 'GET',
    'security/risk-ips': 'GET',
    'security/events/export': 'GET',
    'security/events/clear': 'POST',
    'security/badge': 'GET',
    'security/block-ip': 'POST',
    'observer-ticket': 'POST',
};

const POST_ROUTES = Object.entries(ROUTE_METHODS).filter(([, m]) => m === 'POST').map(([name]) => name);
const GET_ROUTES = Object.entries(ROUTE_METHODS).filter(([, m]) => m === 'GET').map(([name]) => name);

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
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({ run: vi.fn(async () => ({})) })),
                all: vi.fn(async () => ({ results: [] })),
            })),
        },
        TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        FILE_UPLOAD_URL: 'https://files.example.com/api/files',
        KALPHA_API_URL: 'https://api.example.com',
        HMAC_SECRET: 'test-hmac-secret',
        ENVIRONMENT: 'production',
        ...overrides,
    };
}

function makeRequest(path, method = 'GET', headers = {}) {
    return new Request(`https://kalpha.mmv.kr${path}`, {
        method,
        headers: {
            'CF-Connecting-IP': '203.0.113.5',
            Origin: 'https://kalpha.mmv.kr',
            ...headers,
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

    it('serves /api/announcements from D1', async () => {
        env.DB_ADMIN.prepare.mockImplementation(() => ({
            all: vi.fn(async () => ({
                results: [{ timestamp: 123, content: '공지 내용', is_emergency: 1 }]
            })),
        }));
        const res = await worker.fetch(makeRequest('/api/announcements'), env);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual([{ timestamp: 123, content: '공지 내용', isEmergency: true }]);
    });

    it('marks emergency announcements inactive after their expiry', async () => {
        env.DB_ADMIN.prepare.mockImplementation(() => ({
            all: vi.fn(async () => ({
                results: [
                    { timestamp: 3, content: '만료됨', is_emergency: 1, emergency_until: Date.now() - 1000 },
                    { timestamp: 2, content: '진행중', is_emergency: 1, emergency_until: Date.now() + 60000 },
                    { timestamp: 1, content: '계속', is_emergency: 1, emergency_until: null }
                ]
            })),
        }));
        const res = await worker.fetch(makeRequest('/api/announcements'), env);
        const body = await res.json();
        expect(body.map(a => a.isEmergency)).toEqual([false, true, true]);
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
            const res = await worker.fetch(makeRequest(`/api/admin/${name}`, ROUTE_METHODS[name]), env);
            expect(res.status).toBe(401);
        });

        it('metrics without token does not call D1', async () => {
            await worker.fetch(makeRequest('/api/admin/metrics'), env);
            expect(env.DB_ADMIN.prepare).not.toHaveBeenCalled();
        });
    });

    describe('method enforcement', () => {
        it.each(POST_ROUTES)('POST route %s rejects GET', async (name) => {
            const res = await worker.fetch(makeRequest(`/api/admin/${name}`, 'GET'), env);
            expect(res.status).toBe(404);
        });

        it.each(GET_ROUTES)('GET route %s rejects POST', async (name) => {
            const res = await worker.fetch(makeRequest(`/api/admin/${name}`, 'POST'), env);
            expect(res.status).toBe(404);
        });

        it('announce accepts POST, PUT and DELETE but not GET', async () => {
            for (const method of ['POST', 'PUT', 'DELETE']) {
                const res = await worker.fetch(makeRequest('/api/admin/announce', method), env);
                expect(res.status).toBe(401);
            }
            const getRes = await worker.fetch(makeRequest('/api/admin/announce', 'GET'), env);
            expect(getRes.status).toBe(404);
        });
    });
});

describe('public route rate limiting (M2)', () => {
    it('/api/check-ban returns 429 after CHECK_BAN.max requests in a window', async () => {
        const roomFetch = vi.fn(async () => new Response(JSON.stringify({ banned: false }), {
            headers: { 'Content-Type': 'application/json' }
        }));
        const env = makeEnv({
            CHAT_ROOM: {
                idFromName: vi.fn(() => 'room-id'),
                get: vi.fn(() => ({ fetch: roomFetch })),
            },
        });
        const ip = '198.51.100.9';
        const statuses = [];
        for (let i = 0; i <= API_RATE_LIMIT.CHECK_BAN.max; i++) {
            const res = await worker.fetch(makeRequest('/api/check-ban', 'GET', { 'CF-Connecting-IP': ip }), env);
            statuses.push(res.status);
        }
        expect(statuses.slice(0, API_RATE_LIMIT.CHECK_BAN.max).every((s) => s === 200)).toBe(true);
        expect(statuses[API_RATE_LIMIT.CHECK_BAN.max]).toBe(429);
        const limited = await worker.fetch(makeRequest('/api/check-ban', 'GET', { 'CF-Connecting-IP': ip }), env);
        expect(await limited.json()).toEqual({ error: 'Rate limit exceeded' });
    });
});

describe('/ws hardening (M2/M6a)', () => {
    function wsRequest(query, headers = {}) {
        return new Request(`https://kalpha.mmv.kr/ws?${query}`, {
            headers: {
                'Upgrade': 'websocket',
                'CF-Connecting-IP': '203.0.113.7',
                'Origin': 'https://kalpha.mmv.kr',
                ...headers,
            },
        });
    }

    it('rejects a connection without ticket or Origin with 403', async () => {
        const env = makeEnv();
        const req = new Request('https://kalpha.mmv.kr/ws?sessionId=user_test', {
            headers: {
                'Upgrade': 'websocket',
                'CF-Connecting-IP': '203.0.113.7',
            },
        });
        const res = await worker.fetch(req, env);
        expect(res.status).toBe(403);
    });

    it('returns 404 when the channel is missing from the registry', async () => {
        const registryFetch = vi.fn(async () => new Response(JSON.stringify({ found: false }), {
            headers: { 'Content-Type': 'application/json' }
        }));
        const env = makeEnv({
            CHANNEL_REGISTRY: {
                idFromName: vi.fn(() => 'registry-id'),
                get: vi.fn(() => ({ fetch: registryFetch })),
            },
        });
        const res = await worker.fetch(wsRequest('sessionId=user_test&channel=missing'), env);
        expect(res.status).toBe(404);
        expect(registryFetch).toHaveBeenCalled();
    });

    it('skips the registry check for the main-room sentinel channel=0', async () => {
        const registryFetch = vi.fn();
        const roomFetch = vi.fn(async () => new Response(JSON.stringify({ banned: false }), {
            headers: { 'Content-Type': 'application/json' }
        }));
        const env = makeEnv({
            CHANNEL_REGISTRY: {
                idFromName: vi.fn(() => 'registry-id'),
                get: vi.fn(() => ({ fetch: registryFetch })),
            },
            CHAT_ROOM: {
                idFromName: vi.fn(() => 'room-id'),
                get: vi.fn(() => ({ fetch: roomFetch })),
            },
        });
        const res = await worker.fetch(wsRequest('sessionId=user_test&channel=0'), env);
        expect(registryFetch).not.toHaveBeenCalled();
        expect(res.status).not.toBe(404);
    });

    it('fails open when the registry check throws', async () => {
        const registryFetch = vi.fn(async () => { throw new Error('registry down'); });
        const roomFetch = vi.fn(async () => new Response(JSON.stringify({ banned: false }), {
            headers: { 'Content-Type': 'application/json' }
        }));
        const env = makeEnv({
            CHANNEL_REGISTRY: {
                idFromName: vi.fn(() => 'registry-id'),
                get: vi.fn(() => ({ fetch: registryFetch })),
            },
            CHAT_ROOM: {
                idFromName: vi.fn(() => 'room-id'),
                get: vi.fn(() => ({ fetch: roomFetch })),
            },
        });
        const res = await worker.fetch(wsRequest('sessionId=user_test&channel=missing'), env);
        expect(res.status).not.toBe(404);
        expect(roomFetch).toHaveBeenCalled();
    });
});

describe('rate limiter pruning (M3)', () => {
    it('sheds new keys when the tracked map is at capacity', () => {
        const limiter = createRateLimiter(0);
        const config = { windowMs: 60000, max: 5 };
        for (let i = 0; i < 10000; i++) {
            limiter.checkRateLimit(`ip-${i}`, config);
        }
        expect(limiter.checkRateLimit('fresh-ip', config)).toBe(false);
        expect(limiter.checkRateLimit('ip-0', config)).toBe(true);
        limiter.destroy();
    });

    it('prunes expired entries to admit a new key', () => {
        vi.useFakeTimers();
        const limiter = createRateLimiter(0);
        const config = { windowMs: 1000, max: 5 };
        for (let i = 0; i < 10000; i++) {
            limiter.checkRateLimit(`ip-${i}`, config);
        }
        vi.setSystemTime(Date.now() + 5000);
        expect(limiter.checkRateLimit('fresh-ip', config)).toBe(true);
        limiter.destroy();
        vi.useRealTimers();
    });
});

describe('admin route rate limiting (M2)', () => {
    it('rejects admin requests past the per-minute cap', async () => {
        const env = makeEnv();
        const burstHeaders = { 'CF-Connecting-IP': '198.51.100.9' };

        let lastStatus = 0;
        for (let i = 0; i < 121; i++) {
            const res = await worker.fetch(makeRequest('/api/admin/metrics', 'GET', burstHeaders), env);
            lastStatus = res.status;
        }

        expect(lastStatus).toBe(429);
    });
});
