import { describe, it, expect, beforeAll } from 'vitest';
import { Window } from 'happy-dom';

let window;
let escapeHtml, isValidUrl, sanitizeUrl, formatFileSize;

beforeAll(async () => {
    window = new Window();
    globalThis.document = window.document;

    const mod = await import('../public/js/utils.js');
    escapeHtml = mod.escapeHtml;
    isValidUrl = mod.isValidUrl;
    sanitizeUrl = mod.sanitizeUrl;
    formatFileSize = mod.formatFileSize;
});

describe('escapeHtml', () => {
    it('should escape HTML special chars', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).not.toContain('<');
        expect(escapeHtml('&')).toBe('&amp;');
        expect(escapeHtml('>')).toBe('&gt;');
        expect(escapeHtml('<')).toBe('&lt;');
    });

    it('should handle non-string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(123)).toBe('123');
    });

    it('should keep normal text', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });
});

describe('isValidUrl', () => {
    it('should validate https URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should validate http URLs', () => {
        expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should add protocol for protocol-less domains', () => {
        expect(isValidUrl('example.com')).toBe(true);
        expect(isValidUrl('www.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
        expect(isValidUrl('not-a-url!!')).toBe(false);
        expect(isValidUrl('')).toBe(false);
    });

    it('should reject non-domain strings', () => {
        expect(isValidUrl('abc')).toBe(false);
        expect(isValidUrl('   ')).toBe(false);
    });
});

describe('sanitizeUrl', () => {
    it('should add protocol for bare domains', () => {
        expect(sanitizeUrl('example.com')).toBe('https://example.com');
    });

    it('should return # for invalid URLs', () => {
        expect(sanitizeUrl('')).toBe('#');
    });

    it('should preserve valid URLs', () => {
        expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    });
});

describe('formatFileSize', () => {
    it('should format bytes', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(500)).toBe('500 B');
        expect(formatFileSize(1024)).toBe('1.00 KB');
        expect(formatFileSize(1048576)).toBe('1.00 MB');
    });

    it('should handle falsy values', () => {
        expect(formatFileSize(null)).toBe('');
        expect(formatFileSize(undefined)).toBe('');
        expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format terabytes', () => {
        expect(formatFileSize(1099511627776)).toBe('1.00 TB');
    });
});
