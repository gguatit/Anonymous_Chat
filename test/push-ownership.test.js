import { describe, it, expect, vi } from 'vitest';
import { handlePushSubscribe, handlePushUnsubscribe, sendPushToOfflineUsers } from '../src/handlers/push.js';
import { dispatchAdminRoute } from '../src/durable-objects/chat-room/admin.js';

async function sha256Hex(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeKv() {
    const store = new Map();
    return {
        store,
        get: vi.fn(async (k) => store.get(k) ?? null),
        put: vi.fn(async (k, v) => { store.set(k, v); }),
        delete: vi.fn(async (k) => { store.delete(k); }),
        list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: null }))
    };
}

function makeEnv(kv, doFetch) {
    return {
        HMAC_SECRET: 'test-secret',
        PUSH_SUBSCRIPTIONS: kv,
        CHAT_ROOM: {
            idFromName: vi.fn(() => 'id'),
            get: vi.fn(() => ({ fetch: doFetch }))
        }
    };
}

const webSubscription = {
    endpoint: 'https://push.example/sub/1',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' }
};

describe('/admin/verify-session (DO route)', () => {
    function mockChatRoom(overrides = {}) {
        return {
            sessionKeys: new Map([['user_a', { key: 'valid-key', lastSeen: Date.now() }]]),
            ...overrides
        };
    }

    it('accepts a matching session key', async () => {
        const room = mockChatRoom();
        const req = new Request('https://dummy/admin/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: 'user_a', key: 'valid-key' })
        });
        const res = await dispatchAdminRoute(room, new URL(req.url), req, 'test-secret');
        expect(res.status).toBe(200);
        expect((await res.json()).valid).toBe(true);
    });

    it('rejects a wrong or unknown session key', async () => {
        const room = mockChatRoom();
        const req = new Request('https://dummy/admin/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: 'user_a', key: 'wrong-key' })
        });
        const res = await dispatchAdminRoute(room, new URL(req.url), req, 'test-secret');
        expect(res.status).toBe(401);
        expect((await res.json()).valid).toBe(false);
    });

    it('rejects missing fields with 400', async () => {
        const room = mockChatRoom();
        const req = new Request('https://dummy/admin/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: 'user_a' })
        });
        const res = await dispatchAdminRoute(room, new URL(req.url), req, 'test-secret');
        expect(res.status).toBe(400);
    });
});

describe('push subscription ownership', () => {
    it('rejects subscribe without a session key', async () => {
        const kv = makeKv();
        const doFetch = vi.fn();
        const env = makeEnv(kv, doFetch);
        const req = new Request('https://dummy/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: webSubscription, sessionId: 'user_victim', isFcmToken: false })
        });

        const res = await handlePushSubscribe(req, env, {});
        expect(res.status).toBe(401);
        expect(doFetch).not.toHaveBeenCalled();
        expect(kv.put).not.toHaveBeenCalled();
    });

    it('rejects subscribe when the DO rejects the key', async () => {
        const kv = makeKv();
        const doFetch = vi.fn(async () => new Response(JSON.stringify({ valid: false }), { status: 401 }));
        const env = makeEnv(kv, doFetch);
        const req = new Request('https://dummy/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: webSubscription, sessionId: 'user_victim', key: 'stolen', isFcmToken: false })
        });

        const res = await handlePushSubscribe(req, env, {});
        expect(res.status).toBe(401);
        expect(kv.put).not.toHaveBeenCalled();
    });

    it('stores the subscription under a hashed key with the sessionId in the value', async () => {
        const kv = makeKv();
        const doFetch = vi.fn(async () => new Response(JSON.stringify({ valid: true }), { status: 200 }));
        const env = makeEnv(kv, doFetch);
        const req = new Request('https://dummy/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: webSubscription, sessionId: 'user_own', key: 'own-key', isFcmToken: false })
        });

        const res = await handlePushSubscribe(req, env, {});
        expect(res.status).toBe(200);

        const forwarded = doFetch.mock.calls[0][0];
        expect(new URL(forwarded.url).pathname).toBe('/admin/verify-session');

        const expectedKey = `sub:${await sha256Hex('user_own')}`;
        expect(kv.put).toHaveBeenCalledTimes(1);
        const [putKey, putValue] = kv.put.mock.calls[0];
        expect(putKey).toBe(expectedKey);
        const parsed = JSON.parse(putValue);
        expect(parsed.sessionId).toBe('user_own');
        expect(parsed.data.endpoint).toBe(webSubscription.endpoint);
    });

    it('rejects unsubscribe without a session key', async () => {
        const kv = makeKv();
        const doFetch = vi.fn();
        const env = makeEnv(kv, doFetch);
        const req = new Request('https://dummy/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: 'user_victim' })
        });

        const res = await handlePushUnsubscribe(req, env, {});
        expect(res.status).toBe(401);
        expect(kv.delete).not.toHaveBeenCalled();
    });

    it('deletes the hashed entry on unsubscribe with a valid key', async () => {
        const kv = makeKv();
        const doFetch = vi.fn(async () => new Response(JSON.stringify({ valid: true }), { status: 200 }));
        const env = makeEnv(kv, doFetch);
        const req = new Request('https://dummy/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: 'user_own', key: 'own-key' })
        });

        const res = await handlePushUnsubscribe(req, env, {});
        expect(res.status).toBe(200);
        expect(kv.delete).toHaveBeenCalledWith(`sub:${await sha256Hex('user_own')}`);
    });
});

describe('sendPushToOfflineUsers session matching', () => {
    it('matches a hashed key entry to its sessionId from the value', async () => {
        const kv = makeKv();
        const hashed = `sub:${await sha256Hex('user_on')}`;
        kv.store.set(hashed, JSON.stringify({
            type: 'web',
            data: webSubscription,
            sessionId: 'user_on'
        }));
        kv.list = vi.fn(async () => ({
            keys: [{ name: hashed }],
            list_complete: true,
            cursor: null
        }));

        const env = {
            PUSH_SUBSCRIPTIONS: kv,
            VAPID_PUBLIC_KEY: 'BBBB',
            VAPID_PRIVATE_KEY: 'AAAA'
        };
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        await sendPushToOfflineUsers(env, new Set(['user_on']), { content: 'hello' });

        expect(fetchSpy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
