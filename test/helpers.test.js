import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { sanitizeInput, arrayBufferToHex, isValidFileUrl } from '../src/utils/helpers.js';

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
});
