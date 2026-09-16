import { safeJson } from '../utils/helpers.js';
import { DEAD_DROP } from '../config/constants.js';
import { validateDeadDropMessage } from '../utils/validate.js';

const TTL_MS = DEAD_DROP.TTL_MS;

/**
 * @class DeadDropStore
 * @classdesc Singleton Durable Object for one-time secret messages.
 * Messages are read-once and auto-expire after a configurable TTL.
 * Persisted to DO storage for durability across worker restarts.
 *
 * @property {Object<string,{message:string,expiresAt:number}>} secrets - Active secret messages
 */
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
        await this.scheduleExpiryAlarm();
    }

    async persist() {
        await this.state.storage.put('secrets', JSON.stringify(this.secrets));
        await this.scheduleExpiryAlarm();
    }

    // Keep an alarm pointed at the earliest expiry so entries are reaped even while the DO is idle (M5)
    async scheduleExpiryAlarm() {
        try {
            let next = Infinity;
            for (const entry of Object.values(this.secrets)) {
                if (entry.expiresAt) next = Math.min(next, entry.expiresAt);
            }
            if (next === Infinity) {
                await this.state.storage.deleteAlarm();
            } else {
                await this.state.storage.setAlarm(next);
            }
        } catch (error) {
            // Best-effort: expired entries are still pruned on initialize/read
            console.error('DeadDropStore failed to schedule expiry alarm:', error);
        }
    }

    async alarm() {
        await this.initialize();
        const now = Date.now();
        let changed = false;
        for (const id of Object.keys(this.secrets)) {
            const entry = this.secrets[id];
            if (entry.expiresAt && entry.expiresAt <= now) {
                delete this.secrets[id];
                changed = true;
            }
        }
        if (changed) {
            await this.persist();
        } else {
            await this.scheduleExpiryAlarm();
        }
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

        const msgCheck = validateDeadDropMessage(String(body.message));
        if (!msgCheck.valid) {
            return new Response(JSON.stringify({ error: msgCheck.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const id = crypto.randomUUID();
        this.secrets[id] = {
            message: String(body.message).substring(0, DEAD_DROP.MAX_MESSAGE_LENGTH),
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
            // ponytail: ID 자체가 열람 자격증명 — ID/목록을 로그에 남기지 않는다
            console.error('DeadDropStore: secret not found or already read');
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
