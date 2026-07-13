import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelRegistry } from '../src/durable-objects/ChannelRegistry.js';

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

function authHeaders() {
    return { 'X-Admin-Internal-Token': 'test-secret' };
}

function jsonHeaders() {
    return { 'Content-Type': 'application/json' };
}

describe('ChannelRegistry', () => {
    let state, env, registry;

    beforeEach(() => {
        state = mockState();
        env = {
            HMAC_SECRET: 'test-secret',
            CHAT_ROOM: {
                idFromName: vi.fn((name) => ({ name })),
                get: vi.fn((id) => ({
                    fetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({
                        activeConnections: 2,
                        totalMessages: 42
                    }))))
                }))
            }
        };
        registry = new ChannelRegistry(state, env);
    });

    describe('toSlug', () => {
        it('converts names to slugs', () => {
            expect(registry.toSlug('테스트 채널')).toBe('테스트-채널');
            expect(registry.toSlug('Hello World')).toBe('hello-world');
            expect(registry.toSlug('  Trim  Me  ')).toBe('trim-me');
        });

        it('truncates to max name length', () => {
            const long = 'a'.repeat(50);
            expect(registry.toSlug(long).length).toBeLessThanOrEqual(20);
        });

        it('removes special characters', () => {
            expect(registry.toSlug('hello!@#world')).toBe('helloworld');
        });
    });

    describe('create', () => {
        it('creates a new channel', async () => {
            const req = new Request('https://dummy/create', {
                method: 'POST',
                body: JSON.stringify({ name: 'general', sessionId: 'user_abc' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.slug).toBe('general');
            expect(body.name).toBeDefined();
            expect(registry.channels.has('general')).toBe(true);
        });

        it('rejects duplicate channel names', async () => {
            registry.channels.set('general', { name: 'general', createdBy: 'x', createdAt: 0, lastActive: 0 });

            const req = new Request('https://dummy/create', {
                method: 'POST',
                body: JSON.stringify({ name: 'general' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(409);
        });

        it('rejects empty channel name', async () => {
            const req = new Request('https://dummy/create', {
                method: 'POST',
                body: JSON.stringify({ name: '' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(400);
        });

        it('rejects channel name exceeding max length', async () => {
            const longName = 'x'.repeat(30);
            const req = new Request('https://dummy/create', {
                method: 'POST',
                body: JSON.stringify({ name: longName }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(400);
        });
    });

    describe('touch', () => {
        it('touches lastActive on an existing channel', async () => {
            registry.channels.set('lobby', {
                name: 'lobby', createdBy: 'a', createdAt: 1000, lastActive: 1000
            });

            const req = new Request('https://dummy/touch', {
                method: 'POST',
                body: JSON.stringify({ slug: 'lobby' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            expect(registry.channels.get('lobby').lastActive).toBeGreaterThan(1000);
        });
    });

    describe('join', () => {
        it('returns 404 for non-existent channel', async () => {
            const req = new Request('https://dummy/join', {
                method: 'POST',
                body: JSON.stringify({ name: 'ghost' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(404);
        });
    });

    describe('list', () => {
        it('returns empty list when no channels exist', async () => {
            const req = new Request('https://dummy/list', {
                headers: authHeaders()
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
            expect(body).toEqual([]);
        });

        it('returns all channels', async () => {
            registry.channels.set('a', { name: 'A', createdBy: 'x', createdAt: 1000, lastActive: 2000 });
            registry.channels.set('b', { name: 'B', createdBy: 'y', createdAt: 1500, lastActive: 2500 });

            const req = new Request('https://dummy/list', {
                headers: authHeaders()
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
            expect(body).toHaveLength(2);
        });
    });

    describe('delete', () => {
        it('deletes an existing channel', async () => {
            registry.channels.set('test', { name: 'test', createdBy: 'x', createdAt: 1000, lastActive: 2000 });

            const req = new Request('https://dummy/delete', {
                method: 'POST',
                body: JSON.stringify({ slug: 'test' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            expect(registry.channels.has('test')).toBe(false);
        });
    });

    describe('auth', () => {
        it('rejects requests without internal token', async () => {
            const req = new Request('https://dummy/list');
            const res = await registry.fetch(req);
            expect(res.status).toBe(403);
        });

        it('rejects requests with wrong internal token', async () => {
            const req = new Request('https://dummy/list', {
                headers: { 'X-Admin-Internal-Token': 'wrong-secret' }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(403);
        });
    });

    describe('initialize', () => {
        it('skips numeric keys on load', async () => {
            state._storage.set('channels', [
                ['123', { name: 'old-numeric' }],
                ['good', { name: 'good', createdBy: 'x', createdAt: 1000, lastActive: 2000 }]
            ]);
            await registry.initialize();
            expect(registry.channels.has('123')).toBe(false);
            expect(registry.channels.has('good')).toBe(true);
        });
    });
});
