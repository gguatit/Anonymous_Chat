import { describe, it, expect, vi } from 'vitest';
import { dispatchAdminRoute, notifyAdmin } from '../src/durable-objects/chat-room/admin.js';

function mockChatRoom(overrides = {}) {
    return {
        sessions: new Map(),
        messages: [],
        observers: new Set(),
        startTime: Date.now(),
        errorLogs: [],
        channelSlug: '0',
        ensureLogsLoaded: vi.fn(() => Promise.resolve()),
        getSessionList: vi.fn(() => []),
        broadcastToObservers: vi.fn(),
        ...overrides
    };
}

describe('chat-room admin', () => {
    const HMAC = 'test-secret';
    const cors = { 'Content-Type': 'application/json' };

    describe('notifyAdmin', () => {
        it('sends admin_event to all observers', () => {
            const room = mockChatRoom();
            notifyAdmin(room, 'user_joined', { sessionId: 's1' });
            expect(room.broadcastToObservers).toHaveBeenCalledTimes(1);
            const msg = room.broadcastToObservers.mock.calls[0][0];
            expect(msg.type).toBe('admin_event');
            expect(msg.action).toBe('user_joined');
            expect(msg.payload.sessionId).toBe('s1');
        });
    });

    describe('dispatchAdminRoute', () => {
        it('returns metrics', async () => {
            const room = mockChatRoom({
                errorLogs: [{ type: 'error', message: 'test' }],
                messages: [{ id: 1 }, { id: 2 }]
            });
            room.sessions.set('s1', {});
            room.sessions.set('s2', {});

            const req = new Request('https://dummy/admin/metrics');
            const res = await dispatchAdminRoute(room, new URL(req.url), req, HMAC);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.activeConnections).toBe(2);
            expect(body.totalMessages).toBe(2);
            expect(body.errors).toBe(1);
            expect(body.uptime).toBeDefined();
        });

        it('returns info with sessions and messages', async () => {
            const room = mockChatRoom({
                getSessionList: vi.fn(() => [{ sessionId: 's1', nickname: 'test' }]),
                messages: [{ id: 1 }]
            });
            const req = new Request('https://dummy/admin/info');
            const res = await dispatchAdminRoute(room, new URL(req.url), req, HMAC);
            const body = await res.json();
            expect(body.sessions).toHaveLength(1);
            expect(body.messages).toHaveLength(1);
            expect(body.slug).toBe('0');
        });

        it('returns sessions', async () => {
            const room = mockChatRoom({
                getSessionList: vi.fn(() => [{ sessionId: 'a' }, { sessionId: 'b' }])
            });
            const req = new Request('https://dummy/admin/sessions');
            const res = await dispatchAdminRoute(room, new URL(req.url), req, HMAC);
            const body = await res.json();
            expect(body).toHaveLength(2);
        });

        it('returns messages with limit', async () => {
            const msgs = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
            const room = mockChatRoom({ messages: msgs });
            const req = new Request('https://dummy/admin/messages?limit=10');
            const res = await dispatchAdminRoute(room, new URL(req.url), req, HMAC);
            const body = await res.json();
            expect(body).toHaveLength(10);
            expect(body[0].id).toBe(91);
        });

        it('returns messages up to default 200 when no limit specified', async () => {
            const msgs = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
            const room = mockChatRoom({ messages: msgs });
            const req = new Request('https://dummy/admin/messages');
            const res = await dispatchAdminRoute(room, new URL(req.url), req, HMAC);
            const body = await res.json();
            expect(body).toHaveLength(50);
        });

        it('handles unknown route gracefully', async () => {
            const room = mockChatRoom();
            const req = new Request('https://dummy/admin/unknown');
            const res = await dispatchAdminRoute(room, new URL(req.url), req, HMAC);
            expect(res).toBeNull();
        });
    });
});
