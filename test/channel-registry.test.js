import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelRegistry } from '../src/durable-objects/ChannelRegistry.js';
import { CHANNEL } from '../src/config/constants.js';

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

    describe('get', () => {
        it('returns found:true for an existing channel without internal token', async () => {
            registry.channels.set('general', { name: 'general', createdBy: 'x', createdAt: 1000, lastActive: 2000 });

            const req = new Request('https://dummy/get', {
                method: 'POST',
                body: JSON.stringify({ slug: 'general' }),
                headers: jsonHeaders()
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.found).toBe(true);
            expect(body.channel.name).toBe('general');
        });

        it('returns found:false for an unknown channel', async () => {
            const req = new Request('https://dummy/get', {
                method: 'POST',
                body: JSON.stringify({ slug: 'ghost' }),
                headers: jsonHeaders()
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ found: false });
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

    describe('admin delete', () => {
        it('destroys the channel DO along with the registry entry', async () => {
            registry.channels.set('test', { name: 'test', createdBy: 'x', createdAt: 1000, lastActive: Date.now() });
            const roomFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            }));
            env.CHAT_ROOM.get = vi.fn(() => ({ fetch: roomFetch }));

            const req = new Request('https://dummy/admin/channel-delete', {
                method: 'POST',
                body: JSON.stringify({ slug: 'test' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            expect(env.CHAT_ROOM.idFromName).toHaveBeenCalledWith('channel:test');
            expect(roomFetch).toHaveBeenCalledTimes(1);
            const destroyReq = roomFetch.mock.calls[0][0];
            expect(new URL(destroyReq.url).pathname).toBe('/destroy');
            expect(destroyReq.headers.get('X-HMAC-Secret')).toBe('test-secret');
            expect(registry.channels.has('test')).toBe(false);
        });

        it('still succeeds when the channel DO destroy fails', async () => {
            registry.channels.set('test', { name: 'test', createdBy: 'x', createdAt: 1000, lastActive: 2000 });
            env.CHAT_ROOM.get = vi.fn(() => ({
                fetch: vi.fn(async () => { throw new Error('DO unavailable'); })
            }));

            const req = new Request('https://dummy/admin/channel-delete', {
                method: 'POST',
                body: JSON.stringify({ slug: 'test' }),
                headers: { ...authHeaders(), ...jsonHeaders() }
            });
            const res = await registry.fetch(req);
            expect(res.status).toBe(200);
            expect((await res.json()).success).toBe(true);
        });
    });

    describe('cleanup and alarms', () => {
        it('removes stale empty channels and destroys their DOs', async () => {
            registry.channels.set('stale', { name: 'stale', createdBy: 'x', createdAt: 1, lastActive: Date.now() - CHANNEL.EMPTY_TTL - 60000 });
            const roomFetch = vi.fn(async () => new Response(JSON.stringify({ activeConnections: 0 }), {
                headers: { 'Content-Type': 'application/json' }
            }));
            env.CHAT_ROOM.get = vi.fn(() => ({ fetch: roomFetch }));

            await registry.alarm();

            expect(registry.channels.has('stale')).toBe(false);
            const destroyReq = roomFetch.mock.calls
                .map(c => c[0])
                .find(r => new URL(r.url).pathname === '/destroy');
            expect(destroyReq).toBeTruthy();
            expect(destroyReq.headers.get('X-HMAC-Secret')).toBe('test-secret');
        });

        it('keeps rooms with active connections and refreshes lastActive', async () => {
            const old = Date.now() - CHANNEL.EMPTY_TTL - 60000;
            registry.channels.set('busy', { name: 'busy', createdBy: 'x', createdAt: 1, lastActive: old });
            env.CHAT_ROOM.get = vi.fn(() => ({
                fetch: vi.fn(async () => new Response(JSON.stringify({ activeConnections: 3 }), {
                    headers: { 'Content-Type': 'application/json' }
                }))
            }));

            await registry.alarm();

            expect(registry.channels.has('busy')).toBe(true);
            expect(registry.channels.get('busy').lastActive).toBeGreaterThan(old);
        });

        it('keeps channels when emptiness cannot be verified', async () => {
            registry.channels.set('ghost', { name: 'ghost', createdBy: 'x', createdAt: 1, lastActive: Date.now() - CHANNEL.EMPTY_TTL - 60000 });
            env.CHAT_ROOM.get = vi.fn(() => ({
                fetch: vi.fn(async () => { throw new Error('DO unavailable'); })
            }));

            await registry.alarm();

            expect(registry.channels.has('ghost')).toBe(true);
        });

        it('schedules an alarm for the earliest expiry and clears it when empty', async () => {
            state.storage.setAlarm = vi.fn(() => Promise.resolve());
            state.storage.deleteAlarm = vi.fn(() => Promise.resolve());
            const now = Date.now();
            registry.channels.set('a', { name: 'a', createdBy: 'x', createdAt: 1, lastActive: now });
            registry.channels.set('b', { name: 'b', createdBy: 'x', createdAt: 1, lastActive: now + 60000 });
            registry._scheduledAt = undefined;

            await registry.scheduleCleanupAlarm();
            expect(state.storage.setAlarm).toHaveBeenCalledWith(now + CHANNEL.EMPTY_TTL + 1000);

            registry.channels.clear();
            registry._scheduledAt = undefined;
            await registry.scheduleCleanupAlarm();
            expect(state.storage.deleteAlarm).toHaveBeenCalled();
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

describe('ChannelRegistry cleanup throttling (M3)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('does not sweep on regular fetches', async () => {
        const state = mockState();
        const env = {
            HMAC_SECRET: 'test-secret',
            CHAT_ROOM: {
                idFromName: vi.fn((name) => ({ name })),
                get: vi.fn(() => ({ fetch: vi.fn() }))
            }
        };
        const registry = new ChannelRegistry(state, env);
        registry.initialized = true;
        const roomFetch = vi.fn(async () => new Response(JSON.stringify({ activeConnections: 0 }), {
            headers: { 'Content-Type': 'application/json' }
        }));
        env.CHAT_ROOM.get = vi.fn(() => ({ fetch: roomFetch }));
        registry.channels.set('stale', { name: 'stale', createdBy: 'x', createdAt: 1, lastActive: Date.now() - CHANNEL.EMPTY_TTL - 60000 });

        const res = await registry.fetch(new Request('https://dummy/list', { headers: authHeaders() }));

        expect(res.status).toBe(200);
        expect(registry.channels.has('stale')).toBe(true);
        expect(roomFetch).not.toHaveBeenCalled();
    });

    it('clamps cleanup alarms that would fire immediately', async () => {
        const state = mockState();
        const env = {
            HMAC_SECRET: 'test-secret',
            CHAT_ROOM: {
                idFromName: vi.fn((name) => ({ name })),
                get: vi.fn(() => ({ fetch: vi.fn() }))
            }
        };
        const registry = new ChannelRegistry(state, env);
        registry.initialized = true;
        state.storage.setAlarm = vi.fn(() => Promise.resolve());
        state.storage.deleteAlarm = vi.fn(() => Promise.resolve());
        registry.channels.set('stale-old', { name: 'stale-old', createdBy: 'x', createdAt: 1, lastActive: Date.now() - CHANNEL.EMPTY_TTL - 60000 });

        await registry.scheduleCleanupAlarm();

        const [when] = state.storage.setAlarm.mock.calls[0];
        expect(when).toBeGreaterThanOrEqual(Date.now() + 4 * 60 * 1000);
    });
});
