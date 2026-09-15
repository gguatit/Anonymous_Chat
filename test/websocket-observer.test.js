import { describe, it, expect, vi } from 'vitest';
import { handleWebSocket } from '../src/handlers/websocket.js';
import { generateAdminToken } from '../src/middleware/auth.js';

function makeEnv() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ banned: false }), {
        headers: { 'Content-Type': 'application/json' }
    }));
    return {
        HMAC_SECRET: 'test-secret',
        ADMIN_TOKENS: {
            get: vi.fn(async () => null),
            put: vi.fn(async () => {})
        },
        CHAT_ROOM: {
            idFromName: vi.fn(() => 'test-id'),
            get: vi.fn(() => ({ fetch: fetchMock }))
        },
        _fetchMock: fetchMock
    };
}

function makeRequest(query) {
    return new Request(`https://example.com/ws?${query}`, {
        headers: {
            'Upgrade': 'websocket',
            'CF-Connecting-IP': '203.0.113.7'
        }
    });
}

describe('handleWebSocket observer authentication', () => {
    it('rejects observer session without token', async () => {
        const env = makeEnv();
        const res = await handleWebSocket(makeRequest('sessionId=admin_obs_abc'), env, 'test-secret');
        expect(res.status).toBe(401);
        expect(env._fetchMock).not.toHaveBeenCalled();
    });

    it('rejects observer session with invalid token', async () => {
        const env = makeEnv();
        const res = await handleWebSocket(makeRequest('sessionId=admin_obs_abc&token=bogus.token'), env, 'test-secret');
        expect(res.status).toBe(401);
        expect(env._fetchMock).not.toHaveBeenCalled();
    });

    it('allows observer session with valid admin token', async () => {
        const env = makeEnv();
        const token = await generateAdminToken('ignored-password', 'test-secret');
        const res = await handleWebSocket(
            makeRequest(`sessionId=admin_obs_abc&token=${encodeURIComponent(token)}`),
            env,
            'test-secret'
        );
        expect(res.status).not.toBe(401);
        expect(env._fetchMock).toHaveBeenCalled();
    });

    it('allows regular session without token', async () => {
        const env = makeEnv();
        const res = await handleWebSocket(makeRequest('sessionId=user_regular'), env, 'test-secret');
        expect(res.status).not.toBe(401);
        expect(env._fetchMock).toHaveBeenCalled();
    });
});
