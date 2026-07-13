import { describe, it, expect } from 'vitest';
import {
    validateClientMessage, validateFileInfo, validateChannelName,
    validateNickname, validateDeadDropMessage, validateSessionId
} from '../src/utils/validate.js';

describe('validate - extra validators', () => {

    describe('validateClientMessage - message', () => {
        it('rejects null or non-object', () => {
            expect(validateClientMessage(null).valid).toBe(false);
            expect(validateClientMessage(undefined).valid).toBe(false);
            expect(validateClientMessage('string').valid).toBe(false);
        });

        it('rejects unknown type', () => {
            expect(validateClientMessage({ type: 'unknown' }).valid).toBe(false);
        });

        it('rejects empty content without file', () => {
            expect(validateClientMessage({ type: 'message', content: '' }).valid).toBe(false);
        });

        it('allows empty content with file', () => {
            expect(validateClientMessage({
                type: 'message', content: '',
                file: { url: 'https://example.com/img.jpg', filename: 'img.jpg' }
            }).valid).toBe(true);
        });

        it('rejects content exceeding max length', () => {
            expect(validateClientMessage({
                type: 'message', content: 'x'.repeat(10000)
            }).valid).toBe(false);
        });

        it('rejects invalid content type', () => {
            expect(validateClientMessage({
                type: 'message', content: 'test', contentType: 'application'
            }).valid).toBe(false);
        });
    });

    describe('validateClientMessage - reaction', () => {
        it('requires messageId', () => {
            expect(validateClientMessage({ type: 'reaction', emoji: '👍' }).valid).toBe(false);
        });

        it('requires emoji', () => {
            expect(validateClientMessage({ type: 'reaction', messageId: 'msg_1' }).valid).toBe(false);
        });

        it('rejects emoji too long', () => {
            expect(validateClientMessage({
                type: 'reaction', messageId: 'msg_1', emoji: 'x'.repeat(11)
            }).valid).toBe(false);
        });

        it('accepts valid reaction', () => {
            expect(validateClientMessage({
                type: 'reaction', messageId: 'msg_1', emoji: '👍'
            }).valid).toBe(true);
        });
    });

    describe('validateClientMessage - edit', () => {
        it('requires messageId', () => {
            expect(validateClientMessage({
                type: 'edit', newContent: 'updated'
            }).valid).toBe(false);
        });

        it('requires newContent', () => {
            expect(validateClientMessage({
                type: 'edit', messageId: 'msg_1', newContent: ''
            }).valid).toBe(false);
        });

        it('rejects newContent too long', () => {
            expect(validateClientMessage({
                type: 'edit', messageId: 'msg_1', newContent: 'x'.repeat(10000)
            }).valid).toBe(false);
        });

        it('accepts valid edit', () => {
            expect(validateClientMessage({
                type: 'edit', messageId: 'msg_1', newContent: 'updated text'
            }).valid).toBe(true);
        });
    });

    describe('validateClientMessage - delete', () => {
        it('requires messageId', () => {
            expect(validateClientMessage({ type: 'delete' }).valid).toBe(false);
        });

        it('accepts valid delete', () => {
            expect(validateClientMessage({
                type: 'delete', messageId: 'msg_1'
            }).valid).toBe(true);
        });
    });

    describe('validateClientMessage - typing', () => {
        it('requires typing to be boolean', () => {
            expect(validateClientMessage({ type: 'typing', typing: 'yes' }).valid).toBe(false);
            expect(validateClientMessage({ type: 'typing', typing: 1 }).valid).toBe(false);
        });

        it('accepts boolean typing', () => {
            expect(validateClientMessage({ type: 'typing', typing: true }).valid).toBe(true);
            expect(validateClientMessage({ type: 'typing', typing: false }).valid).toBe(true);
        });
    });

    describe('validateClientMessage - ping', () => {
        it('always valid', () => {
            expect(validateClientMessage({ type: 'ping' }).valid).toBe(true);
        });
    });

    describe('validateFileInfo', () => {
        it('rejects non-object', () => {
            expect(validateFileInfo(null).valid).toBe(false);
            expect(validateFileInfo('file').valid).toBe(false);
        });

        it('requires url', () => {
            expect(validateFileInfo({}).valid).toBe(false);
            expect(validateFileInfo({ filename: 'test.jpg' }).valid).toBe(false);
        });

        it('rejects url too long', () => {
            expect(validateFileInfo({ url: 'x'.repeat(3000) }).valid).toBe(false);
        });

        it('rejects filename too long', () => {
            expect(validateFileInfo({ url: 'https://a.com/f.jpg', filename: 'x'.repeat(300) }).valid).toBe(false);
        });

        it('rejects filetype too long', () => {
            expect(validateFileInfo({ url: 'https://a.com/f.jpg', filetype: 'x'.repeat(101) }).valid).toBe(false);
        });

        it('accepts valid file info', () => {
            expect(validateFileInfo({
                url: 'https://cdn.example.com/image.jpg',
                filename: 'photo.jpg',
                filesize: 12345,
                filetype: 'image/jpeg'
            }).valid).toBe(true);
        });

        it('accepts minimal file info', () => {
            expect(validateFileInfo({ url: '/api/file/abc123' }).valid).toBe(true);
        });
    });

    describe('validateChannelName', () => {
        it('rejects non-string', () => {
            expect(validateChannelName(null).valid).toBe(false);
            expect(validateChannelName(123).valid).toBe(false);
        });

        it('rejects empty name', () => {
            expect(validateChannelName('').valid).toBe(false);
            expect(validateChannelName('   ').valid).toBe(false);
        });

        it('rejects name too long', () => {
            expect(validateChannelName('x'.repeat(30)).valid).toBe(false);
        });

        it('accepts valid name and trims', () => {
            const result = validateChannelName('  general  ');
            expect(result.valid).toBe(true);
            expect(result.value).toBe('general');
        });

        it('accepts Korean channel names', () => {
            const result = validateChannelName('일반채널');
            expect(result.valid).toBe(true);
            expect(result.value).toBe('일반채널');
        });
    });

    describe('validateNickname', () => {
        it('rejects non-string', () => {
            expect(validateNickname(123).valid).toBe(false);
        });

        it('rejects empty nickname', () => {
            expect(validateNickname('').valid).toBe(false);
        });

        it('rejects nickname too long', () => {
            expect(validateNickname('x'.repeat(20)).valid).toBe(false);
        });

        it('accepts valid nickname', () => {
            const result = validateNickname('  User123  ');
            expect(result.valid).toBe(true);
            expect(result.value).toBe('User123');
        });
    });

    describe('validateDeadDropMessage', () => {
        it('rejects non-string', () => {
            expect(validateDeadDropMessage(123).valid).toBe(false);
        });

        it('rejects empty message', () => {
            expect(validateDeadDropMessage('').valid).toBe(false);
        });

        it('rejects too long message', () => {
            expect(validateDeadDropMessage('x'.repeat(20000)).valid).toBe(false);
        });

        it('accepts valid message', () => {
            expect(validateDeadDropMessage('secret message').valid).toBe(true);
        });
    });

    describe('validateSessionId', () => {
        it('rejects non-string', () => {
            expect(validateSessionId(123).valid).toBe(false);
        });

        it('rejects empty', () => {
            expect(validateSessionId('').valid).toBe(false);
        });

        it('rejects too long', () => {
            expect(validateSessionId('x'.repeat(300)).valid).toBe(false);
        });

        it('rejects special characters', () => {
            expect(validateSessionId('user<script>').valid).toBe(false);
            expect(validateSessionId('user@name').valid).toBe(false);
            expect(validateSessionId('user name').valid).toBe(false);
        });

        it('accepts alphanumeric with dash and underscore', () => {
            expect(validateSessionId('user_abc-123').valid).toBe(true);
            expect(validateSessionId('session_id_v2').valid).toBe(true);
        });
    });
});
