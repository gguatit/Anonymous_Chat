import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/worker.js';

const FILE_ID = '123e4567-e89b-42d3-a456-426614174000';
const ALLOWED_ORIGIN = 'https://kalpha.mmv.kr';

function makeEnv(overrides = {}) {
    return {
        ASSETS: { fetch: vi.fn(async () => new Response('', { status: 404 })) },
        ADMIN_TOKENS: { get: vi.fn(async () => null), put: vi.fn(), delete: vi.fn() },
        DB_ADMIN: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(async () => ({})) })) })) },
        TURNSTILE_SITE_KEY: '0xTEST',
        FILE_UPLOAD_URL: 'https://files.example.com/api/files',
        FILE_API_KEY: 'test-file-key',
        KALPHA_API_URL: 'https://api.example.com',
        HMAC_SECRET: 'test-hmac-secret',
        ENVIRONMENT: 'production',
        ...overrides
    };
}

function upstreamResponse(contentType, disposition) {
    const headers = {};
    if (contentType) headers['content-type'] = contentType;
    if (disposition) headers['content-disposition'] = disposition;
    return new Response('<body/>', { status: 200, headers });
}

function fileRequest() {
    return new Request(`https://kalpha.mmv.kr/api/file/${FILE_ID}`, {
        method: 'GET',
        headers: { 'CF-Connecting-IP': '203.0.113.5', Origin: ALLOWED_ORIGIN }
    });
}

async function getProxiedFile(contentType, disposition) {
    vi.stubGlobal('fetch', vi.fn(async () => upstreamResponse(contentType, disposition)));
    const res = await worker.fetch(fileRequest(), makeEnv());
    return res;
}

describe('file proxy response headers (C1 hardening)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('forces attachment + nosniff + CSP for SVG uploads', async () => {
        const res = await getProxiedFile('image/svg+xml');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-disposition')).toMatch(/^attachment/);
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    });

    it('omits the upstream filename so the chat link name (Korean-safe) wins', async () => {
        const res = await getProxiedFile('image/svg+xml', 'inline; filename="payload.svg"');
        expect(res.headers.get('content-disposition')).toBe('attachment');
    });

    it('does not leak the service-sanitized filename (Korean becomes underscores)', async () => {
        const res = await getProxiedFile('application/pdf', 'attachment; filename="__________.pdf"');
        expect(res.headers.get('content-disposition')).toBe('attachment');
    });

    it('forces attachment for HTML responses', async () => {
        const res = await getProxiedFile('text/html');
        expect(res.headers.get('content-disposition')).toMatch(/^attachment/);
        expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    });

    it('forces attachment for PDF responses', async () => {
        const res = await getProxiedFile('application/pdf');
        expect(res.headers.get('content-disposition')).toMatch(/^attachment/);
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('forces attachment when the upstream sends no content-type', async () => {
        const res = await getProxiedFile(null);
        expect(res.headers.get('content-disposition')).toMatch(/^attachment/);
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('still renders raster images inline but adds nosniff', async () => {
        const res = await getProxiedFile('image/png');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-disposition')).toBeNull();
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('content-security-policy')).toBeNull();
    });

    it('renders jpeg and webp inline as well', async () => {
        const jpeg = await getProxiedFile('image/jpeg');
        expect(jpeg.headers.get('content-disposition')).toBeNull();
        const webp = await getProxiedFile('image/webp');
        expect(webp.headers.get('content-disposition')).toBeNull();
    });
});
