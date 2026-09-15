import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatRoom } from '../src/durable-objects/ChatRoom.js';
import { searchMessages, generateSessionKey } from '../src/durable-objects/chat-room/messages.js';

function mockState() {
    const storage = new Map();
    return {
        storage: {
            get: vi.fn((key) => {
                if (Array.isArray(key)) {
                    const result = {};
                    for (const k of key) {
                        if (storage.has(k)) result[k] = storage.get(k);
                    }
                    return Promise.resolve(Object.keys(result).length > 0 ? result : undefined);
                }
                return Promise.resolve(storage.get(key));
            }),
            put: vi.fn((key, value) => {
                storage.set(key, value);
                return Promise.resolve();
            }),
            delete: vi.fn((key) => {
                storage.delete(key);
                return Promise.resolve(true);
            }),
        },
        _storage: storage,
    };
}

function mockEnv() {
    return {
        HMAC_SECRET: 'test-hmac-secret',
        DB_ADMIN: {
            prepare() { return this; },
            bind() { return this; },
            all() { return Promise.resolve({ results: [] }); },
            first() { return Promise.resolve(null); },
            run() { return Promise.resolve({ changes: 0 }); },
        },
        ADMIN_TOKENS: {
            get: vi.fn(() => Promise.resolve(null)),
            put: vi.fn(() => Promise.resolve()),
            delete: vi.fn(() => Promise.resolve()),
        },
        PUSH_SUBSCRIPTIONS: {
            get: vi.fn(() => Promise.resolve(null)),
            put: vi.fn(() => Promise.resolve()),
            delete: vi.fn(() => Promise.resolve()),
            list: vi.fn(() => Promise.resolve({ keys: [], list_complete: true })),
        },
        AI: {
            run: vi.fn(() => Promise.resolve({ response: 'test summary' })),
        },
        CHAT_ROOM: {
            idFromName: vi.fn((name) => ({ name })),
            get: vi.fn(() => ({
                fetch: vi.fn(() => Promise.resolve(new Response('{}')))
            }))
        },
        CHANNEL_REGISTRY: {
            idFromName: vi.fn(() => ({})),
            get: vi.fn(() => ({
                fetch: vi.fn(() => Promise.resolve(new Response('{}')))
            }))
        },
        DEAD_DROP_STORE: {
            idFromName: vi.fn(() => ({})),
            get: vi.fn(() => ({
                fetch: vi.fn(() => Promise.resolve(new Response('{"id": "test"}', { status: 200 })))
            }))
        }
    };
}

function createWebSocketMock() {
    return {
        send: vi.fn(),
        close: vi.fn(),
        accept: vi.fn(),
        addEventListener: vi.fn(),
        readyState: 1,
    };
}

function findSent(ws, type) {
    const call = ws.send.mock.calls.find(c => {
        try { return JSON.parse(c[0]).type === type; } catch (_e) { return false; }
    });
    return call ? JSON.parse(call[0]) : null;
}

describe('ChatRoom session capability keys', () => {
    let state, env, room;

    beforeEach(() => {
        vi.useFakeTimers();
        state = mockState();
        env = mockEnv();
        room = new ChatRoom(state, env);
        room.initialized = true;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('issues secret, key and authorId on first join', async () => {
        const ws = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_first' }, ws, '10.0.0.1', vi.fn());

        const handshake = findSent(ws, 'handshake');
        expect(handshake).not.toBeNull();
        expect(handshake.secret).toBeDefined();
        expect(typeof handshake.key).toBe('string');
        expect(handshake.key.length).toBeGreaterThanOrEqual(32);
        expect(typeof handshake.authorId).toBe('string');
        expect(handshake.authorId.length).toBe(16);

        const stored = state._storage.get('sessionKeys');
        expect(stored).toBeDefined();
        const entry = stored.find(([sid]) => sid === 'user_first');
        expect(entry).toBeDefined();
        expect(entry[1].key).toBe(handshake.key);
    });

    it('rejects a rejoin without the key (4401) and sends no history', async () => {
        const ws1 = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_reclaim' }, ws1, '10.0.0.1', vi.fn());

        const ws2 = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_reclaim' }, ws2, '10.0.0.2', vi.fn());

        expect(ws2.close).toHaveBeenCalledWith(4401, expect.any(String));
        expect(findSent(ws2, 'handshake')).toBeNull();
        expect(findSent(ws2, 'history')).toBeNull();
    });

    it('rejects a rejoin with a wrong key (4401)', async () => {
        const ws1 = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_wrong' }, ws1, '10.0.0.1', vi.fn());

        const ws2 = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_wrong', key: 'deadbeef'.repeat(8) }, ws2, '10.0.0.2', vi.fn());

        expect(ws2.close).toHaveBeenCalledWith(4401, expect.any(String));
    });

    it('accepts a rejoin with the correct key and rotates the key', async () => {
        const ws1 = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_rotate' }, ws1, '10.0.0.1', vi.fn());
        const firstKey = findSent(ws1, 'handshake').key;

        const ws2 = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_rotate', key: firstKey }, ws2, '10.0.0.1', vi.fn());

        expect(ws2.close).not.toHaveBeenCalled();
        const handshake = findSent(ws2, 'handshake');
        expect(handshake).not.toBeNull();
        expect(handshake.key).not.toBe(firstKey);
        expect(handshake.authorId).toBe(findSent(ws1, 'handshake').authorId);

        const stored = state._storage.get('sessionKeys');
        const entry = stored.find(([sid]) => sid === 'user_rotate');
        expect(entry[1].key).toBe(handshake.key);
    });

    it('rejects joins with admin_ prefixed session ids', async () => {
        const ws = createWebSocketMock();
        await room.handleJoin({ sessionId: 'admin_kalpha' }, ws, '10.0.0.1', vi.fn());

        expect(ws.close).toHaveBeenCalledWith(1008, expect.any(String));
        expect(findSent(ws, 'handshake')).toBeNull();
    });

    it('strips sessionId from history but keeps authorId (admin/legacy messages exempt)', async () => {
        room.messages.push(
            { type: 'message', messageId: 'msg_1', content: 'new', sessionId: 'user_a', authorId: 'aaaa1111aaaa1111', nickname: 'A', timestamp: Date.now() },
            { type: 'message', messageId: 'msg_2', content: 'legacy', sessionId: 'user_b', nickname: 'B', timestamp: Date.now() },
            { type: 'message', messageId: 'msg_3', content: 'notice', sessionId: 'admin_kalpha', nickname: '관리자', timestamp: Date.now() }
        );

        const ws = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_viewer' }, ws, '10.0.0.1', vi.fn());

        const history = findSent(ws, 'history');
        expect(history).not.toBeNull();
        const [msg1, msg2, msg3] = history.messages;
        expect(msg1.sessionId).toBeUndefined();
        expect(msg1.authorId).toBe('aaaa1111aaaa1111');
        expect(msg2.sessionId).toBe('user_b');
        expect(msg3.sessionId).toBe('admin_kalpha');
    });

    it('search results expose authorId instead of sessionId', () => {
        const { results } = searchMessages(
            [{ type: 'message', messageId: 'msg_x', content: 'hello world', sessionId: 'user_a', authorId: 'bbbb2222bbbb2222', nickname: 'A', timestamp: Date.now() }],
            'hello',
            10
        );
        expect(results).toHaveLength(1);
        expect(results[0].authorId).toBe('bbbb2222bbbb2222');
        expect(results[0].sessionId).toBeUndefined();
    });

    it('generateSessionKey returns unique 64-char hex keys', () => {
        const a = generateSessionKey();
        const b = generateSessionKey();
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(a).not.toBe(b);
    });
});
