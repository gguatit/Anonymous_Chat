import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isLikelyCode, containsUrl, generateSessionId, sanitizeContentForAI, extractErrorLocation, validateMessage, searchMessages } from '../src/durable-objects/chat-room/messages.js';

describe('isLikelyCode', () => {
    it('returns cached hint if provided', () => {
        expect(isLikelyCode('anything', true)).toBe(true);
        expect(isLikelyCode('anything', false)).toBe(false);
    });

    it('returns false for non-string input', () => {
        expect(isLikelyCode(null)).toBe(false);
        expect(isLikelyCode(undefined)).toBe(false);
        expect(isLikelyCode(123)).toBe(false);
    });

    it('detects code block markers', () => {
        expect(isLikelyCode('```\ncode\n```')).toBe(true);
    });

    it('detects multi-line code by line count', () => {
        const lines = Array.from({ length: 51 }, (_, i) => `line ${i}`).join('\n');
        expect(isLikelyCode(lines)).toBe(true);
    });

    it('rejects single line', () => {
        expect(isLikelyCode('hello world')).toBe(false);
    });

    it('detects programming keywords', () => {
        expect(isLikelyCode('import foo from "bar"\nconst x = 1')).toBe(true);
        expect(isLikelyCode('export function test() {\n  return 1\n}')).toBe(true);
    });

    it('detects SQL keywords', () => {
        expect(isLikelyCode('SELECT * FROM users\nWHERE id = 1')).toBe(true);
        expect(isLikelyCode('INSERT INTO table\nVALUES (1, 2)')).toBe(true);
    });

    it('detects code by special char density', () => {
        expect(isLikelyCode('{a: 1};\n{b: 2};')).toBe(true);
    });
});

describe('containsUrl', () => {
    it('detects https URLs', () => {
        expect(containsUrl('check https://example.com here')).toBe(true);
    });

    it('detects www URLs', () => {
        expect(containsUrl('visit www.example.com now')).toBe(true);
    });

    it('returns false for non-URL text', () => {
        expect(containsUrl('hello world')).toBe(false);
        expect(containsUrl(null)).toBe(false);
    });
});

describe('generateSessionId', () => {
    it('generates IDs with user_ prefix', () => {
        const id = generateSessionId();
        expect(id.startsWith('user_')).toBe(true);
    });

    it('generates unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 10; i++) {
            ids.add(generateSessionId());
        }
        expect(ids.size).toBe(10);
    });
});

describe('sanitizeContentForAI', () => {
    it('returns null for empty content', () => {
        expect(sanitizeContentForAI('')).toBe(null);
        expect(sanitizeContentForAI('  ')).toBe(null);
    });

    it('returns null for very short content', () => {
        expect(sanitizeContentForAI('ab')).toBe(null);
    });

    it('returns null for jamo-heavy Korean', () => {
        const jamo = '\u1100\u1161\u11AB'.repeat(10);
        expect(sanitizeContentForAI(jamo)).toBe(null);
    });

    it('replaces code with [코드] tag', () => {
        const result = sanitizeContentForAI('function test() {\n  return 1\n}');
        expect(result).toContain('[코드]');
    });

    it('returns null for whitespace-only content', () => {
        expect(sanitizeContentForAI('@#$%^')).toBe(null);
    });

    it('preserves normal Korean text', () => {
        const result = sanitizeContentForAI('안녕하세요 반갑습니다');
        expect(result).toBe('안녕하세요 반갑습니다');
    });
});

describe('extractErrorLocation', () => {
    it('extracts from Error stack', () => {
        const err = new Error('test');
        const loc = extractErrorLocation(err);
        expect(typeof loc).toBe('string');
    });

    it('returns Unknown for non-Error', () => {
        expect(extractErrorLocation('string')).toBe('Unknown');
        expect(extractErrorLocation({})).toBe('Unknown');
    });
});

describe('validateMessage', () => {
    it('rejects empty content without file', () => {
        const error = validateMessage(
            { content: '' },
            { lastMessageTime: Date.now() - 2000 }
        );
        expect(error).toContain('비어있습니다');
    });

    it('allows content with file', () => {
        const error = validateMessage(
            { content: '', file: { url: '/api/file/xyz' } },
            { lastMessageTime: Date.now() - 2000 }
        );
        expect(error).toBeNull();
    });

    it('rejects content exceeding max length', () => {
        const error = validateMessage(
            { content: 'x'.repeat(10000) },
            { lastMessageTime: Date.now() - 2000 }
        );
        expect(error).toContain('최대');
    });

    it('enforces cooldown', () => {
        const error = validateMessage(
            { content: 'hello' },
            { lastMessageTime: Date.now() }
        );
        expect(error).toContain('빠르게');
    });

    it('enforces per-minute rate limit', () => {
        const metadata = {
            lastMessageTime: Date.now() - 2000,
            _minuteWindowStart: Date.now() - 10000,
            _minuteMessageCount: 30
        };
        const error = validateMessage({ content: 'hello' }, metadata);
        expect(error).toContain('한도를 초과');
    });

    it('resets minute window when expired', () => {
        const metadata = {
            lastMessageTime: Date.now() - 2000,
            _minuteWindowStart: Date.now() - 120000,
            _minuteMessageCount: 30
        };
        const error = validateMessage({ content: 'hello' }, metadata);
        expect(error).toBeNull();
    });

    it('returns null for valid message', () => {
        const error = validateMessage(
            { content: 'hello' },
            { lastMessageTime: Date.now() - 2000 }
        );
        expect(error).toBeNull();
    });
});

describe('searchMessages', () => {
    const msgs = [
        { messageId: '1', content: 'hello world', nickname: 'Alice', sessionId: 's1', timestamp: Date.now() - 1000, file: null },
        { messageId: '2', content: 'goodbye', nickname: 'Bob', sessionId: 's2', timestamp: Date.now() - 2000, file: { filename: 'pic.jpg', filetype: 'image/jpeg' } },
        { messageId: '3', content: 'function test() {\n  return 1\n}', nickname: 'Carol', sessionId: 's3', timestamp: Date.now() - 3000, file: null },
        { messageId: '4', content: 'check https://example.com', nickname: 'Dave', sessionId: 's4', timestamp: Date.now() - 4000, file: null },
        { messageId: '5', content: 'old message', nickname: 'Eve', sessionId: 's5', timestamp: Date.now() - 14 * 60 * 60 * 1000, file: null },
    ];

    it('returns empty for null query', () => {
        const result = searchMessages(msgs, '', 10);
        expect(result.results).toHaveLength(0);
    });

    it('searches by text keyword', () => {
        const result = searchMessages(msgs, 'hello', 10);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].messageId).toBe('1');
    });

    it('searches by nickname', () => {
        const result = searchMessages(msgs, 'bob', 10);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].nickname).toBe('Bob');
    });

    it('filters by #images tag', () => {
        const result = searchMessages(msgs, '#images', 10);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].messageId).toBe('2');
    });

    it('filters by #code tag', () => {
        const result = searchMessages(msgs, '#code', 10);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].messageId).toBe('3');
    });

    it('filters by #url tag', () => {
        const result = searchMessages(msgs, '#url', 10);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].messageId).toBe('4');
    });

    it('excludes messages older than 12 hours', () => {
        const result = searchMessages(msgs, 'old', 10);
        expect(result.results).toHaveLength(0);
    });

    it('respects limit', () => {
        const result = searchMessages(msgs, 'e', 2);
        expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('tags take priority over keywords', () => {
        const result = searchMessages(msgs, '#images hello', 10);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].messageId).toBe('2');
    });
});
