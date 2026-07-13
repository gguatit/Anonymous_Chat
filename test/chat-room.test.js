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
    const ws = {
        send: vi.fn(),
        close: vi.fn(),
        accept: vi.fn(),
        addEventListener: vi.fn(),
        readyState: 1,
    };
    return ws;
}

describe('ChatRoom', () => {
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

    describe('sendToSession', () => {
        it('sends JSON to a connected websocket', () => {
            const ws = createWebSocketMock();
            room.sessions.set('session_1', ws);

            room.sendToSession('session_1', { type: 'pong', timestamp: 1 });

            expect(ws.send).toHaveBeenCalledTimes(1);
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.type).toBe('pong');
        });

        it('cleans up dead websocket on send failure', () => {
            const ws = createWebSocketMock();
            ws.send.mockImplementation(() => { throw new Error('dead'); });
            room.sessions.set('session_1', ws);
            room.userMetadata.set('session_1', { ip: '1.2.3.4', messageCount: 5 });

            room.sendToSession('session_1', { type: 'test' });

            expect(room.sessions.has('session_1')).toBe(false);
        });
    });

    describe('broadcast', () => {
        it('broadcasts to all connected sessions except self', () => {
            const ws1 = createWebSocketMock();
            const ws2 = createWebSocketMock();
            room.sessions.set('s1', ws1);
            room.sessions.set('s2', ws2);

            room.broadcast({ type: 'message', content: 'hello' }, 's1');

            expect(ws1.send).not.toHaveBeenCalled();
            expect(ws2.send).toHaveBeenCalledTimes(1);
        });

        it('broadcasts to all when no excludeId', () => {
            const ws1 = createWebSocketMock();
            const ws2 = createWebSocketMock();
            room.sessions.set('s1', ws1);
            room.sessions.set('s2', ws2);

            room.broadcast({ type: 'system', content: 'announcement' });

            expect(ws1.send).toHaveBeenCalledTimes(1);
            expect(ws2.send).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleJoin', () => {
        it('creates a new session and sends handshake with secret', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);
            room.ipConnections.set('10.0.0.1', 0);

            const setSession = vi.fn();
            await room.handleJoin(
                { sessionId: 'user_1' },
                ws,
                '10.0.0.1',
                setSession
            );

            expect(room.sessions.has('user_1')).toBe(true);
            expect(room.sessionSecrets.has('user_1')).toBe(true);

            const secret = room.sessionSecrets.get('user_1');
            expect(secret).toBeDefined();
            expect(secret.length).toBe(64);

            const handshakeCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'handshake'
            );
            expect(handshakeCall).toBeDefined();
        });

        it('sends history to reconnecting user', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);
            room.userMetadata.set('user_1', { ip: '10.0.0.1', joinTime: Date.now() - 1000, messageCount: 1, lastMessageTime: 0, lastActivityTime: Date.now() });
            room.messages.push({
                type: 'message', messageId: 'msg_old', content: 'previous',
                sessionId: 'user_other', nickname: 'Someone',
                timestamp: Date.now() - 1000, editedAt: null, signature: 'sig_old'
            });

            const setSession = vi.fn();
            await room.handleJoin(
                { sessionId: 'user_1' },
                ws,
                '10.0.0.1',
                setSession
            );

            const historyCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'history'
            );
            expect(historyCall).toBeDefined();
        });

        it('generates unique secrets per session', async () => {
            const ws1 = createWebSocketMock();
            const ws2 = createWebSocketMock();
            room.sessions.set('user_1', ws1);
            room.sessions.set('user_2', ws2);

            const cb = vi.fn();
            await room.handleJoin({ sessionId: 'user_1' }, ws1, '10.0.0.1', cb);
            await room.handleJoin({ sessionId: 'user_2' }, ws2, '10.0.0.2', cb);

            expect(room.sessionSecrets.get('user_1')).not.toBe(
                room.sessionSecrets.get('user_2')
            );
        });
    });

    describe('handleMessage', () => {
        it('rejects message without session', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);

            await room.handleMessage(
                { type: 'message', content: 'test' },
                'user_1',
                null,
                'secret'
            );

            expect(ws.send).toHaveBeenCalled();
            const errorMsg = JSON.parse(ws.send.mock.calls[0][0]);
            expect(errorMsg.type).toBe('error');
        });

        it('rejects message without signature', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);
            room.userMetadata.set('user_1', {
                ip: '10.0.0.1', joinTime: Date.now(), messageCount: 0,
                lastMessageTime: 0, lastActivityTime: Date.now()
            });

            await room.handleMessage(
                { type: 'message', content: 'test' },
                'user_1',
                room.userMetadata.get('user_1'),
                'secret'
            );

            const errorCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'error'
            );
            expect(errorCall).toBeDefined();
        });

        it('rejects message without ephemeral secret', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);
            room.userMetadata.set('user_1', {
                ip: '10.0.0.1', joinTime: Date.now(), messageCount: 0,
                lastMessageTime: 0, lastActivityTime: Date.now()
            });

            await room.handleMessage(
                { type: 'message', content: 'test', signature: 'fake_sig' },
                'user_1',
                room.userMetadata.get('user_1'),
                'secret'
            );

            const errorCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'error'
            );
            expect(errorCall).toBeDefined();
        });

        it('rejects message with session ID mismatch', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);
            room.userMetadata.set('user_1', {
                ip: '10.0.0.1', joinTime: Date.now(), messageCount: 0,
                lastMessageTime: 0, lastActivityTime: Date.now()
            });

            const secret = 'a'.repeat(64);
            room.sessionSecrets.set('user_1', secret);

            await room.handleMessage(
                { type: 'message', content: 'test', signature: 'fake_sig', sessionId: 'user_hacker' },
                'user_1',
                room.userMetadata.get('user_1'),
                'secret'
            );

            const errorCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'error'
            );
            expect(errorCall).toBeDefined();
        });
    });

    describe('handleReaction', () => {
        it('adds a reaction to a message', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);

            const msg = {
                type: 'message', messageId: 'msg_1', content: 'hello',
                sessionId: 'user_2', nickname: 'Someone',
                timestamp: Date.now(), editedAt: null, signature: 'sig'
            };
            room.messages.push(msg);

            await room.handleReaction(
                { type: 'reaction', messageId: 'msg_1', emoji: '👍', action: 'add', sessionId: 'user_1' },
                'user_1',
                'secret'
            );

            const updated = room.messages.find(m => m.messageId === 'msg_1');
            expect(updated.reactionSessions).toBeDefined();
            expect(updated.reactionSessions['👍']).toContain('user_1');
        });

        it('toggles reaction off on second call', async () => {
            room.sessions.set('user_1', createWebSocketMock());

            const msg = {
                type: 'message', messageId: 'msg_1', content: 'hello',
                sessionId: 'user_2', nickname: 'Someone',
                timestamp: Date.now(), editedAt: null, signature: 'sig',
                reactionSessions: { '👍': ['user_1'] },
                reactions: { '👍': 1 }
            };
            room.messages.push(msg);

            await room.handleReaction(
                { type: 'reaction', messageId: 'msg_1', emoji: '👍', action: 'remove', sessionId: 'user_1' },
                'user_1',
                'secret'
            );

            const updated = room.messages.find(m => m.messageId === 'msg_1');
            expect(updated.reactions['👍']).toBeUndefined();
            expect(updated.reactionSessions['👍']).toBeUndefined();
        });

        it('handles non-existent message gracefully', async () => {
            room.sessions.set('user_1', createWebSocketMock());

            await room.handleReaction(
                { type: 'reaction', messageId: 'nonexistent', emoji: '👍', action: 'add', sessionId: 'user_1' },
                'user_1',
                'secret'
            );

            // Should not throw, should silently return
            expect(true).toBe(true);
        });
    });

    describe('handleEdit', () => {
        it('rejects edit without signature', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);

            await room.handleEdit(
                { type: 'edit', messageId: 'msg_1', content: 'edited' },
                'user_1',
                { ip: '10.0.0.1' },
                'secret'
            );

            const errorCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'error'
            );
            expect(errorCall).toBeDefined();
        });

        it('rejects edit without ephemeral secret', async () => {
            const ws = createWebSocketMock();
            room.sessions.set('user_1', ws);

            await room.handleEdit(
                { type: 'edit', messageId: 'msg_1', content: 'edited', signature: 'fake_sig' },
                'user_1',
                { ip: '10.0.0.1' },
                'secret'
            );

            const errorCall = ws.send.mock.calls.find(
                call => JSON.parse(call[0]).type === 'error'
            );
            expect(errorCall).toBeDefined();
        });
    });

    describe('cleanup', () => {
        it('removes messages older than retention period', async () => {
            const now = Date.now();
            const oldMessage = {
                type: 'message', messageId: 'msg_old', content: 'stale',
                sessionId: 'user_1', nickname: 'A', timestamp: now - 13 * 60 * 60 * 1000,
                editedAt: null, signature: 'sig'
            };
            const freshMessage = {
                type: 'message', messageId: 'msg_new', content: 'fresh',
                sessionId: 'user_2', nickname: 'B', timestamp: now,
                editedAt: null, signature: 'sig'
            };
            room.messages = [oldMessage, freshMessage];

            await room.cleanup();

            expect(room.messages).toHaveLength(1);
            expect(room.messages[0].messageId).toBe('msg_new');
        });

        it('removes stale sessions', async () => {
            const ws = createWebSocketMock();
            const now = Date.now();
            room.sessions.set('active', ws);
            room.sessions.set('stale', null);
            room.userMetadata.set('active', { ip: '10.0.0.1', joinTime: now - 60 * 1000, lastActivityTime: now });
            room.userMetadata.set('stale', { ip: '10.0.0.2', joinTime: now - 60 * 60 * 1000, lastActivityTime: now - 50 * 60 * 1000 });

            await room.cleanup();

            expect(room.sessions.has('active')).toBe(true);
            expect(room.sessions.has('stale')).toBe(false);
        });

        it('removes expired bans', async () => {
            const now = Date.now();
            room.bannedIPs.set('10.0.0.1', { bannedAt: now - 20000, bannedUntil: now - 5000, banDuration: 10000, bannedBy: 'admin' });
            room.bannedIPs.set('10.0.0.2', { bannedAt: now, bannedUntil: now + 10000000, banDuration: 0, bannedBy: 'admin' });

            await room.cleanup();

            expect(room.bannedIPs.has('10.0.0.1')).toBe(false);
            expect(room.bannedIPs.has('10.0.0.2')).toBe(true);
        });
    });

    describe('session lifecycle', () => {
        it('removes dead websocket sessions on send failure', async () => {
            const ws = createWebSocketMock();
            ws.send.mockImplementation(() => { throw new Error('dead'); });
            room.sessions.set('user_1', ws);
            room.userMetadata.set('user_1', { ip: '10.0.0.1', messageCount: 5 });

            room.sendToSession('user_1', { type: 'test' });

            expect(room.sessions.has('user_1')).toBe(false);
        });
    });
});
