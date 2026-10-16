import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatRoom } from '../src/durable-objects/ChatRoom.js';
import { SESSION_KEYS, REACTION_RATE_LIMIT_MS } from '../src/config/constants.js';
import { generateMessageSignature } from '../src/utils/helpers.js';

function mockState() {
    const storage = new Map();
    return {
        storage: {
            get: vi.fn((key) => {
                if (Array.isArray(key)) {
                    const result = {};
                    for (const k of key) { if (storage.has(k)) result[k] = storage.get(k); }
                    return Promise.resolve(Object.keys(result).length > 0 ? result : undefined);
                }
                return Promise.resolve(storage.get(key));
            }),
            put: vi.fn((key, value) => { storage.set(key, value); return Promise.resolve(); }),
            delete: vi.fn((key) => { storage.delete(key); return Promise.resolve(true); }),
        },
        _storage: storage,
    };
}

function mockEnv() {
    return {
        HMAC_SECRET: 'test-hmac-secret',
        DB_ADMIN: { prepare() { return this; }, bind() { return this; }, all() { return Promise.resolve({ results: [] }); }, first() { return Promise.resolve(null); }, run() { return Promise.resolve({ changes: 0 }); } },
        ADMIN_TOKENS: { get: vi.fn(() => Promise.resolve(null)), put: vi.fn(() => Promise.resolve()), delete: vi.fn(() => Promise.resolve()) },
        PUSH_SUBSCRIPTIONS: { get: vi.fn(() => Promise.resolve(null)), put: vi.fn(() => Promise.resolve()), delete: vi.fn(() => Promise.resolve()), list: vi.fn(() => Promise.resolve({ keys: [], list_complete: true })) },
        AI: { run: vi.fn(() => Promise.resolve({ response: 'test summary' })) },
        CHAT_ROOM: { idFromName: vi.fn((name) => ({ name })), get: vi.fn(() => ({ fetch: vi.fn(() => Promise.resolve(new Response('{}'))) })) },
        CHANNEL_REGISTRY: { idFromName: vi.fn(() => ({})), get: vi.fn(() => ({ fetch: vi.fn(() => Promise.resolve(new Response('{}'))) })) },
        DEAD_DROP_STORE: { idFromName: vi.fn(() => ({})), get: vi.fn(() => ({ fetch: vi.fn(() => Promise.resolve(new Response('{"id": "test"}', { status: 200 }))) })) }
    };
}

function createWebSocketMock() {
    return { send: vi.fn(), close: vi.fn(), accept: vi.fn(), addEventListener: vi.fn(), readyState: 1 };
}

function findSent(ws, type) {
    const call = ws.send.mock.calls.find(c => { try { return JSON.parse(c[0]).type === type; } catch (_e) { return false; } });
    return call ? JSON.parse(call[0]) : null;
}

describe('ChatRoom live privacy and key eviction (H1/M4)', () => {
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

    it('never evicts capability keys for sessions that are still connected', async () => {
        const now = Date.now();
        room.sessionKeys.set('connected-1', { key: 'k-connected', lastSeen: now });
        for (let i = 0; i < SESSION_KEYS.MAX_KEYS; i++) {
            room.sessionKeys.set(`gone-${i}`, { key: `k-${i}`, lastSeen: now - 100000 + i });
        }
        room.sessions.set('connected-1', createWebSocketMock());

        await room.cleanup();

        expect(room.sessionKeys.has('connected-1')).toBe(true);
        expect(room.sessionKeys.size).toBe(SESSION_KEYS.MAX_KEYS);
        expect(room.sessionKeys.has('gone-0')).toBe(false);
    });

    it('rejects more than 10 joins on a single socket', async () => {
        const ws = createWebSocketMock();

        for (let i = 1; i <= 10; i++) {
            await room.handleJoin({ sessionId: `user_cap_${i}` }, ws, '10.0.0.1', vi.fn(), `user_cap_${i}`);
        }
        expect(ws.close).not.toHaveBeenCalled();

        await room.handleJoin({ sessionId: 'user_cap_11' }, ws, '10.0.0.1', vi.fn(), 'user_cap_11');

        expect(ws.close).toHaveBeenCalledWith(1008, 'Too many joins');
        expect(findSent(ws, 'handshake')).not.toBeNull();
        expect(room.sessions.has('user_cap_11')).toBe(false);
    });

    it('strips sessionId from live message broadcasts while keeping authorId', async () => {
        const wsA = createWebSocketMock();
        const wsB = createWebSocketMock();
        room.sessions.set('user_a', wsA);
        room.sessions.set('user_b', wsB);
        room.sessionSecrets.set('user_a', 'secret-a');
        room.sessionSecrets.set('user_b', 'secret-b');
        room.userMetadata.set('user_a', { ip: '10.0.0.1', authorId: 'authoridaa0000001', nickname: 'A', messageCount: 0, lastMessageTime: 0, lastActivityTime: Date.now() });
        room.userMetadata.set('user_b', { ip: '10.0.0.2', authorId: 'authoridbb0000002', nickname: 'B', messageCount: 0, lastMessageTime: 0, lastActivityTime: Date.now() });

        const timestamp = Date.now();
        const signature = await generateMessageSignature({ content: 'hello', sessionId: 'user_a', timestamp }, 'secret-a');

        await room.handleMessage(
            { type: 'message', content: 'hello', sessionId: 'user_a', timestamp, signature, nickname: 'A' },
            'user_a',
            room.userMetadata.get('user_a'),
            env.HMAC_SECRET
        );

        const live = findSent(wsB, 'message');
        expect(live).not.toBeNull();
        expect(Object.hasOwn(live, 'sessionId')).toBe(false);
        expect(live.authorId).toBe('authoridaa0000001');
    });

    it('sends authorId instead of sessionId in typing broadcasts', () => {
        const wsA = createWebSocketMock();
        const wsB = createWebSocketMock();
        room.sessions.set('user_a', wsA);
        room.sessions.set('user_b', wsB);
        room.userMetadata.set('user_a', { ip: '10.0.0.1', authorId: 'authoridaa0000001', nickname: 'A' });

        room.handleTyping({ typing: true, nickname: 'A' }, 'user_a');

        const typing = findSent(wsB, 'typing');
        expect(typing).not.toBeNull();
        expect(typing.authorId).toBe('authoridaa0000001');
        expect(Object.hasOwn(typing, 'sessionId')).toBe(false);
    });

    it('rejects a join whose sessionId does not match the verified WS session (M1)', async () => {
        const ws = createWebSocketMock();
        await room.handleJoin(
            { sessionId: 'user_attacker', timestamp: Date.now() },
            ws,
            '10.0.0.1',
            vi.fn(),
            'user_victim'
        );
        expect(ws.close).toHaveBeenCalledWith(4401, 'Session mismatch');
        expect(findSent(ws, 'error')).not.toBeNull();
        expect(findSent(ws, 'handshake')).toBeNull();
    });

    it('accepts a join when the sessionId matches the verified WS session', async () => {
        const ws = createWebSocketMock();
        await room.handleJoin(
            { sessionId: 'user_match', timestamp: Date.now() },
            ws,
            '10.0.0.1',
            vi.fn(),
            'user_match'
        );
        expect(ws.close).not.toHaveBeenCalled();
        expect(findSent(ws, 'handshake')).not.toBeNull();
    });

    it('throttles rapid reactions from the same session (M6)', async () => {
        room.sessions.set('user_a', createWebSocketMock());
        room.messages.push({
            type: 'message', messageId: 'msg_1', content: 'hello',
            sessionId: 'user_b', nickname: 'B', timestamp: Date.now(), editedAt: null, signature: 'sig'
        });
        room.userMetadata.set('user_a', { ip: '10.0.0.1', authorId: 'authoridaa0000001', lastReactionTime: Date.now() });

        await room.handleReaction(
            { type: 'reaction', messageId: 'msg_1', emoji: '👍', action: 'add', sessionId: 'user_a' },
            'user_a',
            env.HMAC_SECRET
        );

        const msg = room.messages.find(m => m.messageId === 'msg_1');
        expect(msg.reactionSessions).toBeUndefined();
    });

    it('allows reactions again once the cooldown has passed (M6)', async () => {
        room.sessions.set('user_a', createWebSocketMock());
        room.messages.push({
            type: 'message', messageId: 'msg_1', content: 'hello',
            sessionId: 'user_b', nickname: 'B', timestamp: Date.now(), editedAt: null, signature: 'sig'
        });
        room.userMetadata.set('user_a', { ip: '10.0.0.1', authorId: 'authoridaa0000001', lastReactionTime: Date.now() - REACTION_RATE_LIMIT_MS - 1000 });

        await room.handleReaction(
            { type: 'reaction', messageId: 'msg_1', emoji: '👍', action: 'add', sessionId: 'user_a' },
            'user_a',
            env.HMAC_SECRET
        );

        const msg = room.messages.find(m => m.messageId === 'msg_1');
        expect(msg.reactionSessions['👍']).toContain('user_a');
    });

    it('throttles start-typing broadcasts but always sends stop-typing (M6)', () => {
        const wsA = createWebSocketMock();
        const wsB = createWebSocketMock();
        room.sessions.set('user_a', wsA);
        room.sessions.set('user_b', wsB);
        room.userMetadata.set('user_a', { ip: '10.0.0.1', authorId: 'authoridaa0000001', nickname: 'A' });

        room.handleTyping({ typing: true, nickname: 'A' }, 'user_a');
        const firstCount = wsB.send.mock.calls.length;
        expect(firstCount).toBeGreaterThan(0);

        room.handleTyping({ typing: true, nickname: 'A' }, 'user_a');
        expect(wsB.send.mock.calls.length).toBe(firstCount);

        room.handleTyping({ typing: false, nickname: 'A' }, 'user_a');
        const lastCall = JSON.parse(wsB.send.mock.calls.at(-1)[0]);
        expect(lastCall.type).toBe('typing');
        expect(lastCall.typing).toBe(false);
    });

    it('keeps announcements after their expiresAt passes — manual deletion only', async () => {
        room.currentAnnouncement = {
            content: 'persistent notice',
            timestamp: Date.now(),
            isEmergency: false,
            expiresAt: Date.now() - 1000
        };

        await room.cleanup();

        expect(room.currentAnnouncement).not.toBeNull();
        expect(room.currentAnnouncement.content).toBe('persistent notice');
    });

    it('sends the handshake before history so own-message detection works after refresh', async () => {
        const ws = createWebSocketMock();
        room.messages = [{
            messageId: 'msg_seed',
            content: 'seed',
            sessionId: 'user_seed',
            authorId: 'authorseed000001',
            nickname: 'seed',
            timestamp: Date.now(),
            editedAt: null
        }];

        await room.handleJoin({ sessionId: 'user_order', timestamp: Date.now() }, ws, '10.0.0.1', vi.fn(), 'user_order');

        const types = ws.send.mock.calls.map((call) => {
            try { return JSON.parse(call[0]).type; } catch (_e) { return null; }
        });
        expect(types).toContain('handshake');
        expect(types).toContain('history');
        expect(types.indexOf('handshake')).toBeLessThan(types.indexOf('history'));
    });

    it('only sends the secret-note capability id to the intended recipient (M4)', async () => {
        const wsA = createWebSocketMock();
        const wsB = createWebSocketMock();
        const wsC = createWebSocketMock();
        room.sessions.set('user_a', wsA);
        room.sessions.set('user_b', wsB);
        room.sessions.set('user_c', wsC);
        room.sessionSecrets.set('user_a', 'secret-a');
        room.userMetadata.set('user_a', { ip: '10.0.0.1', authorId: 'authoridaa0000001', nickname: 'A', messageCount: 0, lastMessageTime: 0, lastActivityTime: Date.now() });

        const timestamp = Date.now();
        const signature = await generateMessageSignature({ content: 'secret note: hi', sessionId: 'user_a', timestamp }, 'secret-a');

        await room.handleMessage(
            {
                type: 'message',
                content: 'secret note: hi',
                sessionId: 'user_a',
                timestamp,
                signature,
                nickname: 'A',
                replyTo: { messageId: null, content: '', isSecret: true, secretId: 'sd_capability_123', targetSessionId: 'user_b' }
            },
            'user_a',
            room.userMetadata.get('user_a'),
            env.HMAC_SECRET
        );

        const recipientFrames = wsB.send.mock.calls.filter(c => { try { return JSON.parse(c[0]).type === 'message'; } catch (_e) { return false; } });
        expect(recipientFrames.length).toBe(1);
        const recipientFrame = JSON.parse(recipientFrames[0][0]);
        expect(recipientFrame.replyTo.secretId).toBe('sd_capability_123');

        const thirdPartyFrame = findSent(wsC, 'message');
        expect(thirdPartyFrame).not.toBeNull();
        expect(thirdPartyFrame.replyTo.isSecret).toBe(true);
        expect(Object.hasOwn(thirdPartyFrame.replyTo, 'secretId')).toBe(false);
        expect(Object.hasOwn(thirdPartyFrame.replyTo, 'targetSessionId')).toBe(false);
    });

    it('redacts the secret-note capability id in history except for the recipient (M4)', async () => {
        room.messages = [{
            messageId: 'msg_secret',
            content: 'secret note',
            sessionId: 'user_a',
            authorId: 'authoridaa0000001',
            nickname: 'A',
            timestamp: Date.now(),
            editedAt: null,
            replyTo: { messageId: null, content: '', isOwnMessage: false, isSecret: true, secretId: 'sd_capability_123', targetSessionId: 'user_b' }
        }];

        const wsThird = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_c', timestamp: Date.now() }, wsThird, '10.0.0.3', vi.fn(), 'user_c');
        const thirdHistory = findSent(wsThird, 'history');
        expect(thirdHistory).not.toBeNull();
        const thirdMsg = thirdHistory.messages.find(m => m.messageId === 'msg_secret');
        expect(thirdMsg.replyTo.isSecret).toBe(true);
        expect(Object.hasOwn(thirdMsg.replyTo, 'secretId')).toBe(false);
        expect(Object.hasOwn(thirdMsg.replyTo, 'targetSessionId')).toBe(false);

        const wsRecipient = createWebSocketMock();
        await room.handleJoin({ sessionId: 'user_b', timestamp: Date.now() }, wsRecipient, '10.0.0.2', vi.fn(), 'user_b');
        const recipientHistory = findSent(wsRecipient, 'history');
        const recipientMsg = recipientHistory.messages.find(m => m.messageId === 'msg_secret');
        expect(recipientMsg.replyTo.secretId).toBe('sd_capability_123');
    });

    it('redacts the secret-note capability id in message_edited broadcasts (M4)', async () => {
        const wsB = createWebSocketMock();
        const wsC = createWebSocketMock();
        room.sessions.set('user_b', wsB);
        room.sessions.set('user_c', wsC);
        room.sessionSecrets.set('user_a', 'secret-a');
        room.messages = [{
            messageId: 'msg_secret',
            content: 'secret note',
            sessionId: 'user_a',
            authorId: 'authoridaa0000001',
            nickname: 'A',
            timestamp: Date.now(),
            editedAt: null,
            signature: 'sig',
            replyTo: { messageId: null, content: '', isOwnMessage: false, isSecret: true, secretId: 'sd_capability_123', targetSessionId: 'user_b' }
        }];

        const timestamp = Date.now();
        const signature = await generateMessageSignature({ content: 'secret note v2', sessionId: 'user_a', timestamp }, 'secret-a');

        await room.handleEdit(
            { type: 'edit', messageId: 'msg_secret', newContent: 'secret note v2', sessionId: 'user_a', timestamp, signature },
            'user_a',
            { ip: '10.0.0.1', authorId: 'authoridaa0000001', lastActivityTime: Date.now() },
            env.HMAC_SECRET
        );

        const recipientFrame = findSent(wsB, 'message_edited');
        expect(recipientFrame).not.toBeNull();
        expect(recipientFrame.message.replyTo.secretId).toBe('sd_capability_123');

        const thirdFrame = findSent(wsC, 'message_edited');
        expect(thirdFrame).not.toBeNull();
        expect(thirdFrame.message.replyTo.isSecret).toBe(true);
        expect(Object.hasOwn(thirdFrame.message.replyTo, 'secretId')).toBe(false);
    });
});
