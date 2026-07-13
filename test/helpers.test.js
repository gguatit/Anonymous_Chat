import { describe, it, expect, vi } from 'vitest';

import { sanitizeInput, arrayBufferToHex, isValidFileUrl, generateMessageSignature, verifyMessageSignature, safeJson } from '../src/utils/helpers.js';

describe('sanitizeInput', () => {
    it('should return empty for non-string input', () => {
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
        expect(sanitizeInput(123)).toBe('');
        expect(sanitizeInput({})).toBe('');
    });

    it('should strip control characters', () => {
        expect(sanitizeInput('hello\x00world')).toBe('helloworld');
        expect(sanitizeInput('test\x1Fend')).toBe('testend');
        expect(sanitizeInput('\x7Fclean')).toBe('clean');
    });

    it('should normalize carriage returns', () => {
        expect(sanitizeInput('line1\r\nline2')).toBe('line1\nline2');
        expect(sanitizeInput('old\rline')).toBe('old\nline');
    });

    it('should keep normal text unchanged', () => {
        expect(sanitizeInput('hello world')).toBe('hello world');
        expect(sanitizeInput('한글 테스트')).toBe('한글 테스트');
        expect(sanitizeInput('emoji 👋 test')).toBe('emoji 👋 test');
    });
});

describe('arrayBufferToHex', () => {
    it('should convert empty buffer', () => {
        const buf = new Uint8Array([]).buffer;
        expect(arrayBufferToHex(buf)).toBe('');
    });

    it('should convert single byte', () => {
        const buf = new Uint8Array([0xff]).buffer;
        expect(arrayBufferToHex(buf)).toBe('ff');
    });

    it('should pad zero values', () => {
        const buf = new Uint8Array([0x0f, 0x00, 0xa1]).buffer;
        expect(arrayBufferToHex(buf)).toBe('0f00a1');
    });
});

describe('isValidFileUrl', () => {
    it('should reject non-string input', () => {
        expect(isValidFileUrl(null)).toBe(false);
        expect(isValidFileUrl(undefined)).toBe(false);
        expect(isValidFileUrl(123)).toBe(false);
        expect(isValidFileUrl('')).toBe(false);
    });

    it('should require https protocol', () => {
        expect(isValidFileUrl('http://example.com/file.jpg')).toBe(false);
        expect(isValidFileUrl('https://example.com/file.jpg')).toBe(true);
    });

    it('should reject invalid URLs', () => {
        expect(isValidFileUrl('not-a-url')).toBe(false);
        expect(isValidFileUrl('/relative/path')).toBe(false);
    });

    it('should check allowed origins when provided', () => {
        expect(isValidFileUrl('https://cdn.com/file.jpg', ['https://cdn.com'])).toBe(true);
        expect(isValidFileUrl('https://evil.com/file.jpg', ['https://cdn.com'])).toBe(false);
    });

    it('should match origin prefix for allowed origins', () => {
        expect(isValidFileUrl('https://cdn.example.com/path/file.jpg', ['https://cdn.example.com'])).toBe(true);
    });

    it('should allow /api/file/ prefix regardless of protocol', () => {
        expect(isValidFileUrl('/api/file/abc123')).toBe(true);
        expect(isValidFileUrl('/api/file/xyz789?token=a')).toBe(true);
    });
});

describe('generateMessageSignature and verifyMessageSignature', () => {
    it('generates a hex signature', async () => {
        const sig = await generateMessageSignature(
            { content: 'hello', sessionId: 's1', timestamp: 1000 },
            'test-secret'
        );
        expect(typeof sig).toBe('string');
        expect(sig.length).toBe(64);
        expect(/^[0-9a-f]+$/.test(sig)).toBe(true);
    });

    it('verifies a valid signature', async () => {
        const msg = { content: 'hello', sessionId: 's1', timestamp: 1000 };
        const sig = await generateMessageSignature(msg, 'secret');
        const valid = await verifyMessageSignature(msg, sig, 'secret');
        expect(valid).toBe(true);
    });

    it('rejects a signature with wrong secret', async () => {
        const msg = { content: 'hello', sessionId: 's1', timestamp: 1000 };
        const sig = await generateMessageSignature(msg, 'secret-a');
        const valid = await verifyMessageSignature(msg, sig, 'secret-b');
        expect(valid).toBe(false);
    });

    it('rejects a tampered message', async () => {
        const msg = { content: 'hello', sessionId: 's1', timestamp: 1000 };
        const sig = await generateMessageSignature(msg, 'secret');
        const tampered = { content: 'hacked', sessionId: 's1', timestamp: 1000 };
        const valid = await verifyMessageSignature(tampered, sig, 'secret');
        expect(valid).toBe(false);
    });

    it('rejects a signature with tampered content', async () => {
        const msg1 = { content: 'msg1', sessionId: 's1', timestamp: 1000 };
        const sig = await generateMessageSignature(msg1, 'secret');
        const msg2 = { content: 'msg2', sessionId: 's1', timestamp: 1000 };
        const valid = await verifyMessageSignature(msg2, sig, 'secret');
        expect(valid).toBe(false);
    });
});

describe('safeJson', () => {
    it('parses valid JSON request body', async () => {
        const req = new Request('https://example.com', {
            method: 'POST',
            body: JSON.stringify({ key: 'value' }),
            headers: { 'Content-Type': 'application/json', 'Content-Length': '20' }
        });
        const data = await safeJson(req);
        expect(data.key).toBe('value');
    });

    it('throws for oversized body', async () => {
        const req = new Request('https://example.com', {
            method: 'POST',
            body: '{}',
            headers: { 'Content-Length': String(200 * 1024 * 1024) }
        });
        await expect(safeJson(req)).rejects.toThrow('Request body too large');
    });
});
