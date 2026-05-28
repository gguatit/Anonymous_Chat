import { safeJson } from '../utils/helpers.js';

const TTL_MS = 30 * 60 * 1000; // 30 minutes

export class DeadDropStore {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.secrets = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const raw = await this.state.storage.get('secrets');
            if (raw) {
                this.secrets = typeof raw === 'string' ? JSON.parse(raw) : raw;
            }
            const now = Date.now();
            let cleaned = false;
            for (const id of Object.keys(this.secrets)) {
                const entry = this.secrets[id];
                if (entry.expiresAt && entry.expiresAt < now) {
                    delete this.secrets[id];
                    cleaned = true;
                }
            }
            if (cleaned) {
                await this.persist();
            }
        } catch (e) {
            console.error('DeadDropStore initialize error:', e);
            this.secrets = {};
        }

        this.initialized = true;
    }

    async persist() {
        await this.state.storage.put('secrets', JSON.stringify(this.secrets));
    }

    async fetch(request) {
        await this.initialize();
        const url = new URL(request.url);

        try {
            if (request.method === 'POST' && url.pathname === '/store') {
                return await this.handleStore(request);
            }
            if (request.method === 'GET' && url.pathname === '/read') {
                return await this.handleRead(url);
            }
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('DeadDropStore fetch error:', error);
            return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleStore(request) {
        const body = await safeJson(request);
        if (!body || !body.message) {
            return new Response(JSON.stringify({ error: 'Missing message' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const id = crypto.randomUUID();
        this.secrets[id] = {
            message: String(body.message).substring(0, 10000),
            expiresAt: Date.now() + TTL_MS
        };
        await this.persist();

        return new Response(JSON.stringify({ id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async handleRead(url) {
        const id = url.searchParams.get('id');
        if (!id) {
            return new Response(JSON.stringify({ error: 'Missing id' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const entry = this.secrets[id];
        if (!entry) {
            console.error(`DeadDropStore: id '${id}' not found. Stored ids:`, Object.keys(this.secrets));
            return new Response(JSON.stringify({ error: '메시지를 찾을 수 없거나 이미 읽혔습니다.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            delete this.secrets[id];
            await this.persist();
            return new Response(JSON.stringify({ error: '메시지가 만료되었습니다.' }), {
                status: 410,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        delete this.secrets[id];
        await this.persist();

        return new Response(JSON.stringify({ message: entry.message }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
