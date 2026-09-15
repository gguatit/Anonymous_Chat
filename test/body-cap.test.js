import { describe, it, expect } from 'vitest';
import { safeJson, readBodyCapped, isBodyTooLargeError } from '../src/utils/helpers.js';

function makeChunkedRequest(chunkStrings, extraHeaders = {}) {
    const stream = new ReadableStream({
        start(controller) {
            for (const s of chunkStrings) {
                controller.enqueue(new TextEncoder().encode(s));
            }
            controller.close();
        }
    });
    return new Request('https://example.com/api/test', {
        method: 'POST',
        headers: extraHeaders,
        body: stream,
        duplex: 'half'
    });
}

describe('readBodyCapped', () => {
    it('reads a chunked body without Content-Length', async () => {
        const req = makeChunkedRequest(['hello', ' ', 'world']);
        expect(await readBodyCapped(req, 100)).toBe('hello world');
    });

    it('throws when the streamed body exceeds the cap even without Content-Length', async () => {
        const req = makeChunkedRequest(['aaaa', 'bbbb', 'cccc']);
        await expect(readBodyCapped(req, 10)).rejects.toSatisfy(isBodyTooLargeError);
    });

    it('throws before reading when Content-Length exceeds the cap', async () => {
        const req = new Request('https://example.com/api/test', {
            method: 'POST',
            headers: { 'Content-Length': '999999' },
            body: '{}'
        });
        await expect(readBodyCapped(req, 10)).rejects.toSatisfy(isBodyTooLargeError);
    });

    it('detects oversized bodies despite a lying small Content-Length', async () => {
        const req = makeChunkedRequest(['x'.repeat(50)], { 'Content-Length': '5' });
        await expect(readBodyCapped(req, 10)).rejects.toSatisfy(isBodyTooLargeError);
    });

    it('returns an empty string for a request without a body', async () => {
        const req = new Request('https://example.com/api/test', { method: 'POST' });
        expect(await readBodyCapped(req, 10)).toBe('');
    });
});

describe('safeJson', () => {
    it('parses a small JSON body', async () => {
        const req = new Request('https://example.com/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: '203.0.113.5' })
        });
        expect(await safeJson(req)).toEqual({ ip: '203.0.113.5' });
    });

    it('rejects a body over the limit', async () => {
        const req = makeChunkedRequest([JSON.stringify({ data: 'x'.repeat(2000) })]);
        await expect(safeJson(req, 100)).rejects.toSatisfy(isBodyTooLargeError);
    });
});

describe('isBodyTooLargeError', () => {
    it('only matches the body-too-large error', () => {
        expect(isBodyTooLargeError(new Error('Request body too large'))).toBe(true);
        expect(isBodyTooLargeError(new Error('something else'))).toBe(false);
        expect(isBodyTooLargeError(null)).toBe(false);
    });
});
