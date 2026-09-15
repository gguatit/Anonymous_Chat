import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatRoom } from '../src/durable-objects/ChatRoom.js';

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

describe('ChatRoom cold-start initialization (H1)', () => {
    let state, env, room;

    beforeEach(() => {
        vi.useFakeTimers();
        state = mockState();
        env = mockEnv();
        room = new ChatRoom(state, env);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('admin/info reflects stored messages on a cold DO', async () => {
        const msg = { messageId: 'm1', content: 'hello', sessionId: 'user_a', timestamp: Date.now() };
        state._storage.set('messages', [msg]);

        const res = await room.fetch(new Request('https://do/admin/info', {
            headers: { 'X-HMAC-Secret': env.HMAC_SECRET }
        }));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.totalMessages).toBe(1);
        expect(body.messages.length).toBe(1);
    });

    it('check-ban reflects stored session bans on a cold DO', async () => {
        const sid = 'user_banned';
        state._storage.set('bannedSessions', [[sid, { bannedUntil: Date.now() + 60000 }]]);

        const res = await room.fetch(new Request(`https://do/check-ban?sessionId=${sid}`));

        const body = await res.json();
        expect(body.banned).toBe(true);
    });

    it('returns 503 fail-closed when storage read fails', async () => {
        state.storage.get = vi.fn(() => Promise.reject(new Error('storage down')));

        const res = await room.fetch(new Request('https://do/admin/info', {
            headers: { 'X-HMAC-Secret': env.HMAC_SECRET }
        }));

        expect(res.status).toBe(503);
    });

    it('shares a single init promise across concurrent requests', async () => {
        const [r1, r2] = await Promise.all([
            room.fetch(new Request('https://do/admin/info', { headers: { 'X-HMAC-Secret': env.HMAC_SECRET } })),
            room.fetch(new Request('https://do/check-ban?sessionId=user_x')),
        ]);

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        const messageGetCalls = state.storage.get.mock.calls.filter(c => c[0] === 'messages');
        expect(messageGetCalls.length).toBe(1);
    });

    it('initialization failure does not poison later requests', async () => {
        state.storage.get = vi.fn(() => Promise.reject(new Error('transient')));
        const r1 = await room.fetch(new Request('https://do/check-ban?sessionId=user_x'));
        expect(r1.status).toBe(503);

        const s = state._storage;
        state.storage.get = vi.fn((key) => {
            if (Array.isArray(key)) {
                const result = {};
                for (const k of key) {
                    if (s.has(k)) result[k] = s.get(k);
                }
                return Promise.resolve(Object.keys(result).length > 0 ? result : undefined);
            }
            return Promise.resolve(s.get(key));
        });

        const r2 = await room.fetch(new Request('https://do/check-ban?sessionId=user_x'));
        expect(r2.status).toBe(200);
    });
});
