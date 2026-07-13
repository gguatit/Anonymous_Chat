import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeadDropStore } from '../src/durable-objects/DeadDropStore.js';

function mockState() {
    const storage = new Map();
    return {
        storage: {
            get: vi.fn((key) => Promise.resolve(storage.get(key))),
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

describe('DeadDropStore', () => {
    let state, env, store;

    beforeEach(() => {
        state = mockState();
        env = { HMAC_SECRET: 'test-secret' };
        store = new DeadDropStore(state, env);
    });

    describe('initialize', () => {
        it('loads secrets from storage', async () => {
            const secrets = {
                'test-id': { message: 'hello', expiresAt: Date.now() + 100000 }
            };
            state._storage.set('secrets', JSON.stringify(secrets));
            await store.initialize();
            expect(store.secrets).toEqual(secrets);
            expect(store.initialized).toBe(true);
        });

        it('skips if already initialized', async () => {
            store.initialized = true;
            await store.initialize();
            expect(state.storage.get).not.toHaveBeenCalled();
        });

        it('handles null storage gracefully', async () => {
            state._storage.set('secrets', null);
            await store.initialize();
            expect(store.secrets).toEqual({});
        });

        it('cleans expired secrets on init', async () => {
            const expiredId = 'expired-id';
            const activeId = 'active-id';
            const secrets = {
                [expiredId]: { message: 'old', expiresAt: Date.now() - 1000 },
                [activeId]: { message: 'fresh', expiresAt: Date.now() + 100000 }
            };
            state._storage.set('secrets', JSON.stringify(secrets));
            await store.initialize();
            expect(store.secrets[expiredId]).toBeUndefined();
            expect(store.secrets[activeId]).toBeDefined();
        });
    });

    describe('store', () => {
        it('stores a message and returns an id', async () => {
            await store.initialize();
            const req = new Request('https://dummy/store', {
                method: 'POST',
                body: JSON.stringify({ message: 'hello world' }),
                headers: { 'Content-Type': 'application/json' }
            });
            const res = await store.fetch(req);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.id).toBeDefined();
            expect(typeof body.id).toBe('string');
            expect(store.secrets[body.id]).toBeDefined();
            expect(store.secrets[body.id].message).toBe('hello world');
            expect(store.secrets[body.id].expiresAt).toBeGreaterThan(Date.now());
        });

        it('rejects empty message', async () => {
            await store.initialize();
            const req = new Request('https://dummy/store', {
                method: 'POST',
                body: JSON.stringify({}),
                headers: { 'Content-Type': 'application/json' }
            });
            const res = await store.fetch(req);
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Missing message');
        });

        it('rejects message exceeding max length', async () => {
            await store.initialize();
            const longMsg = 'x'.repeat(20000);
            const req = new Request('https://dummy/store', {
                method: 'POST',
                body: JSON.stringify({ message: longMsg }),
                headers: { 'Content-Type': 'application/json' }
            });
            const res = await store.fetch(req);
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBeDefined();
        });
    });

    describe('read', () => {
        it('reads a message once and deletes it', async () => {
            await store.initialize();
            const storeReq = new Request('https://dummy/store', {
                method: 'POST',
                body: JSON.stringify({ message: 'secret' }),
                headers: { 'Content-Type': 'application/json' }
            });
            const storeRes = await store.fetch(storeReq);
            const { id } = await storeRes.json();

            const readReq = new Request(`https://dummy/read?id=${id}`);
            const readRes = await store.fetch(readReq);
            expect(readRes.status).toBe(200);
            const body = await readRes.json();
            expect(body.message).toBe('secret');

            expect(store.secrets[id]).toBeUndefined();

            const rereadReq = new Request(`https://dummy/read?id=${id}`);
            const rereadRes = await store.fetch(rereadReq);
            expect(rereadRes.status).toBe(404);
        });

        it('returns 400 if id is missing', async () => {
            await store.initialize();
            const req = new Request('https://dummy/read');
            const res = await store.fetch(req);
            expect(res.status).toBe(400);
        });

        it('returns 404 if id is not found', async () => {
            await store.initialize();
            const req = new Request('https://dummy/read?id=nonexistent');
            const res = await store.fetch(req);
            expect(res.status).toBe(404);
        });

        it('returns 410 if message has expired', async () => {
            await store.initialize();
            const expiredId = 'expired-test';
            store.secrets[expiredId] = {
                message: 'expired message',
                expiresAt: Date.now() - 10000
            };
            const req = new Request(`https://dummy/read?id=${expiredId}`);
            const res = await store.fetch(req);
            expect(res.status).toBe(410);
        });
    });

    describe('routing', () => {
        it('returns 404 for unknown paths', async () => {
            await store.initialize();
            const req = new Request('https://dummy/unknown');
            const res = await store.fetch(req);
            expect(res.status).toBe(404);
        });
    });
});
