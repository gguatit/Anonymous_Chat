import { CHANNEL } from '../config/constants.js';
import { sanitizeInput, safeJson } from '../utils/helpers.js';
import { validateChannelName } from '../utils/validate.js';

/**
 * @class ChannelRegistry
 * @classdesc Singleton Durable Object that manages channel CRUD operations.
 * Handles channel creation, listing, deletion, slug generation (Korean-safe),
 * and auto-cleanup of stale channels.
 *
 * @property {Map<string,ChannelInfo>} channels - All channels keyed by slug
 */
export class ChannelRegistry {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.channels = new Map(); // slug -> { name, createdBy, createdAt, lastActive }
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        const stored = await this.state.storage.get('channels');
        if (stored) {
            const entries = Array.isArray(stored) ? stored : Object.entries(stored);
            // Filter out old numeric-keyed entries (from previous number-based system)
            const validEntries = entries.filter(([key]) => {
                const strKey = String(key);
                return !/^\d+$/.test(strKey); // Skip pure numeric keys
            });
            this.channels = new Map(validEntries);
            // If we filtered out old entries, save the cleaned data
            if (validEntries.length !== entries.length) {
                await this.persist();
            }
        }

        this.initialized = true;
    }

    async persist() {
        await this.state.storage.put('channels', Array.from(this.channels.entries()));
    }

    toSlug(name) {
        return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣_-]/g, '').substring(0, CHANNEL.MAX_NAME_LENGTH);
    }

    async fetch(request) {
        await this.initialize();
        const url = new URL(request.url);

        const internalToken = request.headers.get('X-Admin-Internal-Token');
        if (!internalToken || internalToken !== this.env.HMAC_SECRET) {
            return new Response('Forbidden', { status: 403 });
        }

        if (url.pathname === '/create' && request.method === 'POST') {
            return this.handleCreate(request);
        }

        if (url.pathname === '/join' && request.method === 'POST') {
            return this.handleJoin(request);
        }

        if (url.pathname === '/touch' && request.method === 'POST') {
            return this.handleTouch(request);
        }

        if (url.pathname === '/delete' && request.method === 'POST') {
            return this.handleDelete(request);
        }

        if (url.pathname === '/list' && request.method === 'GET') {
            return this.handleList();
        }

        if (url.pathname === '/admin/channels' && request.method === 'GET') {
            return this.handleAdminChannels();
        }

        if (url.pathname === '/admin/channel-delete' && request.method === 'POST') {
            return this.handleAdminDelete(request);
        }

        return new Response('Not Found', { status: 404 });
    }

    handleAdminChannels() {
        const now = Date.now();
        const list = Array.from(this.channels.entries())
            .filter(([slug]) => !/^\d+$/.test(String(slug))) // Defensive: skip numeric keys
            .map(([slug, info]) => ({
                slug,
                name: info.name,
                createdBy: info.createdBy,
                createdAt: info.createdAt,
                lastActive: info.lastActive,
                age: now - info.createdAt
            }));
        return new Response(JSON.stringify({ channels: list }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async handleAdminDelete(request) {
        try {
            const data = await safeJson(request);
            const slug = this.toSlug(data.slug || '');
            if (!slug) {
                return new Response(JSON.stringify({ error: 'Invalid channel slug' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }
            const existed = this.channels.delete(slug);
            if (existed) {
                await this.persist();
            }
            return new Response(JSON.stringify({ success: true, existed }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry admin delete error:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete channel' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleCreate(request) {
        try {
            const data = await safeJson(request);
            const rawName = typeof data.name === 'string' ? data.name.trim() : '';
            const createdBy = data.sessionId || 'anonymous';

            const nameCheck = validateChannelName(rawName);
            if (!nameCheck.valid) {
                return new Response(JSON.stringify({ error: nameCheck.error }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }

            const slug = this.toSlug(nameCheck.value);
            if (!slug) {
                return new Response(JSON.stringify({ error: '사용할 수 없는 채널 이름입니다.' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }

            // Check by slug key
            if (this.channels.has(slug)) {
                return new Response(JSON.stringify({ error: '이미 존재하는 채널 이름입니다.' }), {
                    status: 409, headers: { 'Content-Type': 'application/json' }
                });
            }

            // Also check by normalized name (defense against stale/corrupt data)
            const normalizedName = nameCheck.value.toLowerCase();
            for (const [, ch] of this.channels) {
                if (ch.name.toLowerCase().trim() === normalizedName) {
                    return new Response(JSON.stringify({ error: '이미 존재하는 채널 이름입니다.' }), {
                        status: 409, headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            const now = Date.now();
            this.channels.set(slug, {
                name: sanitizeInput(nameCheck.value),
                createdBy,
                createdAt: now,
                lastActive: now
            });

            await this.persist();

            return new Response(JSON.stringify({ slug, name: sanitizeInput(nameCheck.value) }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry create error:', error);
            return new Response(JSON.stringify({ error: '채널 생성에 실패했습니다.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleJoin(request) {
        try {
            const data = await safeJson(request);
            const rawName = typeof data.name === 'string' ? data.name.trim() : '';

            if (!rawName) {
                return new Response(JSON.stringify({ error: '채널 이름을 입력해주세요.' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }

            const slug = this.toSlug(rawName);
            const channel = this.channels.get(slug);

            if (!channel) {
                return new Response(JSON.stringify({ error: '채널을 찾을 수 없습니다.' }), {
                    status: 404, headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ ok: true, slug, name: channel.name }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry join error:', error);
            return new Response(JSON.stringify({ error: '채널 참가에 실패했습니다.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleTouch(request) {
        try {
            const data = await safeJson(request);
            const slug = this.toSlug(data.slug || '');

            const channel = this.channels.get(slug);
            if (channel) {
                channel.lastActive = Date.now();
                await this.persist();
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry touch error:', error);
            return new Response(JSON.stringify({ error: 'Failed to touch channel' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleDelete(request) {
        try {
            const data = await safeJson(request);
            const slug = this.toSlug(data.slug || '');

            if (this.channels.delete(slug)) {
                await this.persist();
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry delete error:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete channel' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    handleList() {
        const now = Date.now();
        const list = Array.from(this.channels.entries())
            .filter(([slug]) => !/^\d+$/.test(String(slug)))
            .map(([slug, info]) => ({
                slug,
                name: info.name,
                createdAt: info.createdAt,
                lastActive: info.lastActive,
                age: now - info.createdAt
            }));

        return new Response(JSON.stringify(list), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

}
