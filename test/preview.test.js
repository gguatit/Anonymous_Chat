import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlePreview, isPrivateHost, _clearPreviewRateLimit } from '../src/handlers/preview.js';

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

function makeRequest(url, ip = '203.0.113.1') {
    return new Request('https://chat.example.com/api/preview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': ip
        },
        body: JSON.stringify({ url })
    });
}

function htmlResponse(html, status = 200) {
    return new Response(html, {
        status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

function redirectResponse(location, status = 302) {
    return new Response(null, { status, headers: { Location: location } });
}

async function preview(url, ip) {
    const response = await handlePreview(makeRequest(url, ip), {}, CORS_HEADERS);
    return { status: response.status, body: await response.json() };
}

beforeEach(() => {
    _clearPreviewRateLimit();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('isPrivateHost', () => {
    it.each([
        '127.0.0.1',
        '10.0.0.5',
        '172.20.1.1',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        'localhost',
        'metadata.google.internal',
        'foo.internal',
        'something.local',
        '::1',
        '[::1]',
        'fd00::1',
        'fc00::1',
        'fe80::1',
        'fe90::1',
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        '0.1.2.3',
        '192.0.0.1',
        '192.0.2.1',
        '198.18.0.1',
        '198.19.255.255',
        '198.51.100.1',
        '203.0.113.1',
        '224.0.0.1',
        '240.0.0.1',
        '255.255.255.255'
    ])('blocks %s', (host) => {
        expect(isPrivateHost(host)).toBe(true);
    });

    it.each([
        'example.com',
        'sub.example.com',
        '93.184.216.34',
        '172.32.0.1',
        '192.169.0.1',
        '192.0.1.1',
        '198.20.0.1',
        '223.255.255.255'
    ])('allows %s', (host) => {
        expect(isPrivateHost(host)).toBe(false);
    });
});

describe('handlePreview URL validation', () => {
    it.each([
        'http://127.0.0.1/',
        'http://10.0.0.5/',
        'http://172.20.1.1/',
        'http://192.168.1.1/',
        'http://169.254.169.254/latest/meta-data/',
        'http://localhost/',
        'http://foo.internal/',
        'http://[::1]/',
        'http://[::ffff:127.0.0.1]/',
        'http://192.0.0.1/',
        'http://224.0.0.1/',
        'ftp://example.com/file',
        'file:///etc/passwd'
    ])('rejects %s without fetching', async (url) => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { status, body } = await preview(url);

        expect(status).toBe(400);
        expect(body.error).toBe('Invalid URL');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('handlePreview OG parsing', () => {
    it('parses meta tags regardless of attribute order, quote style, and entities', async () => {
        const html = `<!doctype html><html><head>
            <meta content='Tom &amp; Jerry &#39;Quoted&#39;' property='og:title'>
            <meta property="og:description" content="A &quot;great&quot; show &lt;yes&gt;">
            <meta content="/images/cover.png" property="og:image">
            <meta name='og:url' content='https://example.com/article'>
            <meta name="og:site_name" content="Example Site">
            <title>Fallback title</title>
        </head></html>`;

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse(html)));

        const { status, body } = await preview('https://example.com/article');

        expect(status).toBe(200);
        expect(body.og).toEqual({
            title: "Tom & Jerry 'Quoted'",
            description: 'A "great" show <yes>',
            image: 'https://example.com/images/cover.png',
            url: 'https://example.com/article',
            siteName: 'Example Site'
        });
    });

    it('falls back to <title> when og:title is missing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse(
            '<html><head><title>Just a Title</title></head></html>'
        )));

        const { body } = await preview('https://example.com/');

        expect(body.og.title).toBe('Just a Title');
    });
});

describe('handlePreview redirects', () => {
    it('blocks a redirect to a private host', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            redirectResponse('http://169.254.169.254/latest/meta-data/')
        );
        vi.stubGlobal('fetch', fetchMock);

        const { status, body } = await preview('https://example.com/start');

        expect(status).toBe(200);
        expect(body.og).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('blocks a redirect to a non-http protocol', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(
            redirectResponse('ftp://example.com/file')
        );
        vi.stubGlobal('fetch', fetchMock);

        const { body } = await preview('https://example.com/start');

        expect(body.og).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('follows a redirect to a public host and parses the final page', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(redirectResponse('/moved'))
            .mockResolvedValueOnce(htmlResponse(
                '<meta property="og:title" content="Final Page">'
            ));
        vi.stubGlobal('fetch', fetchMock);

        const { status, body } = await preview('https://example.com/start');

        expect(status).toBe(200);
        expect(body.og.title).toBe('Final Page');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/moved');
        expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    });

    it('rejects after more than two redirect hops', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(redirectResponse('https://example.com/2'))
            .mockResolvedValueOnce(redirectResponse('https://example.com/3'))
            .mockResolvedValueOnce(redirectResponse('https://example.com/4'))
            .mockResolvedValueOnce(htmlResponse(
                '<meta property="og:title" content="Too Deep">'
            ));
        vi.stubGlobal('fetch', fetchMock);

        const { status, body } = await preview('https://example.com/1');

        expect(status).toBe(200);
        expect(body.og).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('handlePreview body cap', () => {
    it('never decodes past MAX_BODY_BYTES even when a chunk overflows the budget', async () => {
        const encoder = new TextEncoder();
        const chunks = [
            '<meta property="og:image" content="https://example.com/first.png">' + 'x'.repeat(20000),
            'y'.repeat(20000) + '<meta property="og:title" content="past-cap">',
            '<meta property="og:description" content="never-read">'
        ];
        const stream = new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            }
        });

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        })));

        const { status, body } = await preview('https://example.com/big');

        expect(status).toBe(200);
        expect(body.og.image).toBe('https://example.com/first.png');
        expect(body.og.title).toBe('');
        expect(body.og.description).toBe('');
    });
});

describe('handlePreview rate limiting', () => {
    it('returns 429 after exceeding the per-IP max and recovers after reset', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
            htmlResponse('<meta property="og:title" content="ok">')
        )));
        const ip = '198.51.100.7';

        for (let i = 0; i < 8; i++) {
            const allowed = await preview('https://example.com/', ip);
            expect(allowed.status).toBe(200);
        }

        const blocked = await preview('https://example.com/', ip);
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe('Rate limit exceeded');

        _clearPreviewRateLimit();

        const afterReset = await preview('https://example.com/', ip);
        expect(afterReset.status).toBe(200);
    });
});
