import { describe, it, expect } from 'vitest';

function base64urlEncode(bytes) {
    let str = '';
    for (const b of bytes) {
        str += String.fromCharCode(b);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function concatArrays(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

describe('web-push utilities', () => {

    describe('base64urlEncode', () => {
        it('encodes bytes to base64url without padding', () => {
            const data = new TextEncoder().encode('Hello');
            const encoded = base64urlEncode(data);
            expect(encoded).toBe('SGVsbG8');
            expect(encoded).not.toContain('=');
            expect(encoded).not.toContain('+');
            expect(encoded).not.toContain('/');
        });

        it('round-trips through decode', () => {
            const data = new Uint8Array([0x00, 0xFF, 0xAB, 0xCD, 0x12]);
            const encoded = base64urlEncode(data);
            const decoded = base64urlDecode(encoded);
            expect(decoded).toEqual(data);
        });

        it('handles empty input', () => {
            const encoded = base64urlEncode(new Uint8Array(0));
            expect(encoded).toBe('');
        });
    });

    describe('base64urlDecode', () => {
        it('decodes base64url back to bytes', () => {
            const decoded = base64urlDecode('SGVsbG8');
            const str = new TextDecoder().decode(decoded);
            expect(str).toBe('Hello');
        });

        it('handles padding mismatch', () => {
            const data = new TextEncoder().encode('short');
            const encoded = base64urlEncode(data);
            const decoded = base64urlDecode(encoded);
            expect(new TextDecoder().decode(decoded)).toBe('short');
        });
    });

    describe('concatArrays', () => {
        it('concatenates multiple Uint8Arrays', () => {
            const a = new Uint8Array([1, 2, 3]);
            const b = new Uint8Array([4, 5]);
            const c = new Uint8Array([6, 7, 8, 9]);
            const result = concatArrays(a, b, c);
            expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
        });

        it('handles single array', () => {
            const a = new Uint8Array([1, 2, 3]);
            expect(concatArrays(a)).toEqual(a);
        });

        it('handles empty arrays', () => {
            expect(concatArrays(new Uint8Array(0), new Uint8Array(0))).toEqual(new Uint8Array(0));
        });
    });

    describe('web-push crypto constants', () => {
        it('generates 16-byte salt', () => {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            expect(salt).toHaveLength(16);
        });
    });
});
