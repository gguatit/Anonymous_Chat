import { describe, it, expect, vi } from 'vitest';
import { dispatchAdminRoute } from '../src/durable-objects/chat-room/admin.js';
import { blockRecommendedIP } from '../src/handlers/security.js';

function mockChatRoom(overrides = {}) {
    return {
        sessions: new Map(),
        messages: [],
        observers: new Set(),
        bannedIPs: new Map(),
        bannedSessions: new Map(),
        bannedTokens: new Map(),
        startTime: Date.now(),
        errorLogs: [],
        channelSlug: '0',
        state: { storage: { put: vi.fn(() => Promise.resolve()) } },
        ensureLogsLoaded: vi.fn(() => Promise.resolve()),
        getSessionList: vi.fn(() => []),
        broadcastToObservers: vi.fn(),
        addAuditLog: vi.fn(() => Promise.resolve()),
        ...overrides
    };
}

const cors = { 'Content-Type': 'application/json' };

describe('/admin/ban-ip (DO route)', () => {
    it('bans the IP, persists it and returns success', async () => {
        const room = mockChatRoom();
        const req = new Request('https://dummy/admin/ban-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: '203.0.113.5', reason: 'abuse' })
        });

        const res = await dispatchAdminRoute(room, new URL(req.url), req, 'test-secret');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.ip).toBe('203.0.113.5');
        expect(body.duration).toBe(86400);

        const entry = room.bannedIPs.get('203.0.113.5');
        expect(entry).toBeDefined();
        expect(entry.bannedUntil).toBeGreaterThan(Date.now());
        expect(room.state.storage.put).toHaveBeenCalledWith('bannedIPs', expect.any(Array));
        expect(room.addAuditLog).toHaveBeenCalledWith('BAN_IP', expect.stringContaining('203.0.113.5'));
        expect(room.broadcastToObservers).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'ip_banned' })
        );
    });

    it('rejects a missing IP with 400', async () => {
        const room = mockChatRoom();
        const req = new Request('https://dummy/admin/ban-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'no ip' })
        });

        const res = await dispatchAdminRoute(room, new URL(req.url), req, 'test-secret');
        expect(res.status).toBe(400);
        expect(room.bannedIPs.size).toBe(0);
    });

    it('caps an oversized duration at 7 days', async () => {
        const room = mockChatRoom();
        const req = new Request('https://dummy/admin/ban-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: '203.0.113.6', duration: 999999999 })
        });

        const res = await dispatchAdminRoute(room, new URL(req.url), req, 'test-secret');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.duration).toBe(604800);
        const entry = room.bannedIPs.get('203.0.113.6');
        expect(entry.bannedUntil - Date.now()).toBeLessThanOrEqual(604800 * 1000 + 1000);
    });
});

describe('blockRecommendedIP (worker handler)', () => {
    function mockEnv(fetchMock) {
        return {
            HMAC_SECRET: 'test-secret',
            CHAT_ROOM: {
                idFromName: vi.fn(() => 'room-id'),
                get: vi.fn(() => ({ fetch: fetchMock }))
            }
        };
    }

    it('forwards the ban to the DO and reports success', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));
        const env = mockEnv(fetchMock);
        const req = new Request('https://dummy/api/admin/security/block-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'https://kalpha.mmv.kr' },
            body: JSON.stringify({ ip: '203.0.113.5' })
        });

        const res = await blockRecommendedIP(req, env, cors);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const forwarded = fetchMock.mock.calls[0][0];
        expect(new URL(forwarded.url).pathname).toBe('/admin/ban-ip');
        expect(forwarded.headers.get('X-HMAC-Secret')).toBe('test-secret');
    });

    it('reports failure when the DO rejects the request', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'nope' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
        const env = mockEnv(fetchMock);
        const req = new Request('https://dummy/api/admin/security/block-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'https://kalpha.mmv.kr' },
            body: JSON.stringify({ ip: '203.0.113.5' })
        });

        const res = await blockRecommendedIP(req, env, cors);
        expect(res.status).toBeGreaterThanOrEqual(500);
        const body = await res.json();
        expect(body.success).not.toBe(true);
    });
});
