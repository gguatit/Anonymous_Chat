import { CHANNEL } from '../config/constants.js';

export class ChannelRegistry {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.channels = new Map(); // number -> { name, createdBy, createdAt, lastActive }
        this.nextNumber = 1;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        const storedChannels = await this.state.storage.get('channels');
        if (storedChannels) {
            this.channels = new Map(storedChannels);
        }

        const storedNext = await this.state.storage.get('nextNumber');
        if (storedNext) {
            this.nextNumber = storedNext;
        }

        this.initialized = true;
    }

    async persist() {
        await this.state.storage.put('channels', Array.from(this.channels.entries()));
        await this.state.storage.put('nextNumber', this.nextNumber);
    }

    async fetch(request) {
        await this.initialize();
        const url = new URL(request.url);

        // Internal security check
        const internalToken = request.headers.get('X-Admin-Internal-Token');
        if (internalToken && internalToken !== this.env.HMAC_SECRET) {
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

        return new Response('Not Found', { status: 404 });
    }

    async handleCreate(request) {
        try {
            const data = await request.json();
            const name = typeof data.name === 'string' ? data.name.trim() : '';
            const createdBy = data.sessionId || 'anonymous';

            if (!name) {
                return new Response(JSON.stringify({ error: 'Channel name is required' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }

            if (name.length > CHANNEL.MAX_NAME_LENGTH) {
                return new Response(JSON.stringify({ error: `Channel name too long (max ${CHANNEL.MAX_NAME_LENGTH})` }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }

            // Check for duplicate name
            const normalizedName = name.toLowerCase().trim();
            for (const [, ch] of this.channels) {
                if (ch.name.toLowerCase().trim() === normalizedName) {
                    return new Response(JSON.stringify({ error: 'A channel with this name already exists' }), {
                        status: 409, headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            const number = this.nextNumber++;
            const now = Date.now();

            this.channels.set(number, {
                name: this.sanitizeInput(name),
                createdBy,
                createdAt: now,
                lastActive: now
            });

            await this.persist();

            return new Response(JSON.stringify({ number, name: this.sanitizeInput(name) }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry create error:', error);
            return new Response(JSON.stringify({ error: 'Failed to create channel' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleJoin(request) {
        try {
            const data = await request.json();
            const number = parseInt(data.number, 10);

            if (!Number.isFinite(number) || number < 1) {
                return new Response(JSON.stringify({ error: 'Invalid channel number' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }

            const channel = this.channels.get(number);
            if (!channel) {
                return new Response(JSON.stringify({ error: 'Channel not found' }), {
                    status: 404, headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ ok: true, number, name: channel.name }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('ChannelRegistry join error:', error);
            return new Response(JSON.stringify({ error: 'Failed to join channel' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleTouch(request) {
        try {
            const data = await request.json();
            const number = parseInt(data.number, 10);

            const channel = this.channels.get(number);
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
            const data = await request.json();
            const number = parseInt(data.number, 10);

            this.channels.delete(number);
            await this.persist();

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
        const list = Array.from(this.channels.entries()).map(([number, info]) => ({
            number,
            name: info.name,
            createdAt: info.createdAt,
            lastActive: info.lastActive,
            age: now - info.createdAt
        }));

        return new Response(JSON.stringify(list), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        // Remove control characters except newlines
        // eslint-disable-next-line no-control-regex
        return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
}
