import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatRoom } from '../src/durable-objects/ChatRoom.js';
import { generateMessageSignature } from '../src/utils/helpers.js';
import { MESSAGES_MAX_BYTES } from '../src/config/constants.js';

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
            deleteAll: vi.fn(() => {
                storage.clear();
                return Promise.resolve();
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
        AI: { run: vi.fn(() => Promise.resolve({ response: 'test summary' })) },
        CHAT_ROOM: {
            idFromName: vi.fn((name) => ({ name })),
            get: vi.fn(() => ({ fetch: vi.fn(() => Promise.resolve(new Response('{}'))) }))
        },
        CHANNEL_REGISTRY: {
            idFromName: vi.fn(() => ({})),
            get: vi.fn(() => ({ fetch: vi.fn(() => Promise.resolve(new Response('{}'))) }))
        },
        DEAD_DROP_STORE: {
            idFromName: vi.fn(() => ({})),
            get: vi.fn(() => ({ fetch: vi.fn(() => Promise.resolve(new Response('{"id": "test"}', { status: 200 }))) }))
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

function byteSize(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

async function sendSignedMessage(room, env, ws, sessionId, content) {
    const secret = 'session-secret';
    room.sessionSecrets.set(sessionId, secret);
    room.sessions.set(sessionId, ws);
    room.userMetadata.set(sessionId, {
        ip: '10.0.0.1', joinTime: Date.now(), messageCount: 0,
        lastMessageTime: 0, lastActivityTime: Date.now()
    });

    const timestamp = Date.now();
    const signature = await generateMessageSignature({ content, sessionId, timestamp }, secret);
    await room.handleMessage(
        { type: 'message', content, sessionId, signature, timestamp },
        sessionId,
        room.userMetadata.get(sessionId),
        env.HMAC_SECRET
    );
    return timestamp;
}

describe('ChatRoom message size cap (H3)', () => {
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

    it('prunes oldest messages so the stored value stays within MESSAGES_MAX_BYTES', async () => {
        const bigContent = 'x'.repeat(2000);
        for (let i = 0; i < 100; i++) {
            room.messages.push({
                messageId: `old_${i}`,
                content: bigContent,
                sessionId: 'user_old',
                timestamp: Date.now() - 1000,
                editedAt: null,
                signature: 'sig',
            });
        }
        expect(byteSize(room.messages)).toBeGreaterThan(MESSAGES_MAX_BYTES);

        const ws = createWebSocketMock();
        const timestamp = await sendSignedMessage(room, env, ws, 'user_1', 'newest message');

        const putCall = state.storage.put.mock.calls.find(c => c[0] === 'messages');
        expect(putCall).toBeDefined();
        const stored = putCall[1];
        expect(byteSize(stored)).toBeLessThanOrEqual(MESSAGES_MAX_BYTES);
        expect(stored[stored.length - 1].content).toBe('newest message');
        expect(stored[stored.length - 1].timestamp).toBe(timestamp);
        expect(stored.some(m => m.messageId === 'old_0')).toBe(false);
    });

    it('still broadcasts the message when persistence fails', async () => {
        state.storage.put = vi.fn((key) => {
            if (key === 'messages') return Promise.reject(new Error('KV value too large'));
            return Promise.resolve();
        });

        const ws = createWebSocketMock();
        await sendSignedMessage(room, env, ws, 'user_1', 'survives persist failure');

        const broadcastCall = ws.send.mock.calls.find(call => {
            try { return JSON.parse(call[0]).type === 'message'; } catch (_e) { return false; }
        });
        expect(broadcastCall).toBeDefined();
        expect(JSON.parse(broadcastCall[0]).content).toBe('survives persist failure');
    });
});
