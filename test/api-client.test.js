import { describe, it, expect, vi, afterEach } from 'vitest';
import ApiClient from '../public/js/api-client.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('ApiClient', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('get resolves parsed JSON on 200', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true })));
        await expect(ApiClient.get('/api/x')).resolves.toEqual({ ok: true });
    });

    it('get throws on non-ok response', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 500)));
        await expect(ApiClient.get('/api/x')).rejects.toThrow('GET /api/x failed: 500');
    });

    it('post resolves parsed JSON on 200', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: true })));
        await expect(ApiClient.post('/api/admin/action', { a: 1 })).resolves.toEqual({ success: true });
    });

    it('post returns null for empty bodies (204)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
        await expect(ApiClient.post('/api/admin/action')).resolves.toBeNull();
    });

    it('post throws on failure including the server error message', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 500)));
        await expect(ApiClient.post('/api/admin/action', {})).rejects.toThrow('POST /api/admin/action failed: 500 - boom');
    });

    it('put throws on failure', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'nope' }, 400)));
        await expect(ApiClient.put('/api/admin/action', {})).rejects.toThrow('PUT /api/admin/action failed: 400 - nope');
    });

    it('del throws on failure', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
        await expect(ApiClient.del('/api/admin/action', {})).rejects.toThrow('DELETE /api/admin/action failed: 401');
    });

    it('sends the bearer token when set', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({ success: true }));
        vi.stubGlobal('fetch', fetchMock);
        ApiClient.setToken('test-token');
        try {
            await ApiClient.post('/api/admin/action', {});
            expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
        } finally {
            ApiClient.setToken(null);
        }
    });

    it('invokes onUnauthorized on a 401 response and still throws', async () => {
        const onUnauthorized = vi.fn();
        ApiClient.onUnauthorized = onUnauthorized;
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
        try {
            await expect(ApiClient.post('/api/admin/metrics', {})).rejects.toThrow(
                'POST /api/admin/metrics failed: 401'
            );
            expect(onUnauthorized).toHaveBeenCalledTimes(1);
        } finally {
            ApiClient.onUnauthorized = null;
        }
    });

    it('invokes onUnauthorized on a 401 from get and getRaw', async () => {
        const onUnauthorized = vi.fn();
        ApiClient.onUnauthorized = onUnauthorized;
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
        try {
            await expect(ApiClient.get('/api/admin/metrics')).rejects.toThrow(
                'GET /api/admin/metrics failed: 401'
            );
            expect(onUnauthorized).toHaveBeenCalledTimes(1);
            const res = await ApiClient.getRaw('/api/admin/metrics');
            expect(res.status).toBe(401);
            expect(onUnauthorized).toHaveBeenCalledTimes(2);
        } finally {
            ApiClient.onUnauthorized = null;
        }
    });

    it('does not invoke onUnauthorized on non-401 failures', async () => {
        const onUnauthorized = vi.fn();
        ApiClient.onUnauthorized = onUnauthorized;
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 500)));
        try {
            await expect(ApiClient.post('/api/admin/action', {})).rejects.toThrow();
            expect(onUnauthorized).not.toHaveBeenCalled();
        } finally {
            ApiClient.onUnauthorized = null;
        }
    });
});
