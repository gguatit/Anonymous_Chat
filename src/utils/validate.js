import { CHANNEL, MAX_NICKNAME_LENGTH, UPLOAD, DEAD_DROP, SECURITY } from '../config/constants.js';

const VALID_TYPES = new Set(['message', 'reaction', 'typing', 'ping', 'edit', 'delete']);
const VALID_CONTENT_TYPES = new Set(['text', 'image', 'file']);

export function validateClientMessage(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid message format' };
    }

    if (!VALID_TYPES.has(data.type)) {
        return { valid: false, error: `Invalid message type: ${data.type}` };
    }

    switch (data.type) {
    case 'message':
        if (typeof data.content !== 'string' || data.content.length === 0) {
            if (!data.file && !data.files) {
                return { valid: false, error: 'Message content is required' };
            }
        }
        if (data.content && data.content.length > SECURITY.MAX_MESSAGE_LENGTH) {
            return { valid: false, error: 'Message content too long' };
        }
        if (data.contentType && !VALID_CONTENT_TYPES.has(data.contentType)) {
            return { valid: false, error: 'Invalid content type' };
        }
        if (data.file) {
            const fileCheck = validateFileInfo(data.file);
            if (!fileCheck.valid) return fileCheck;
        }
        if (Array.isArray(data.files)) {
            for (const f of data.files) {
                const fileCheck = validateFileInfo(f);
                if (!fileCheck.valid) return fileCheck;
            }
        }
        break;

    case 'reaction':
        if (!data.messageId || typeof data.messageId !== 'string') {
            return { valid: false, error: 'messageId is required for reactions' };
        }
        if (!data.emoji || typeof data.emoji !== 'string') {
            return { valid: false, error: 'emoji is required for reactions' };
        }
        if (data.emoji.length > 10) {
            return { valid: false, error: 'Emoji too long' };
        }
        break;

    case 'edit':
        if (!data.messageId || typeof data.messageId !== 'string') {
            return { valid: false, error: 'messageId is required for edits' };
        }
        if (typeof data.newContent !== 'string' || data.newContent.length === 0) {
            return { valid: false, error: 'Edit content is required' };
        }
        if (data.newContent.length > SECURITY.MAX_MESSAGE_LENGTH) {
            return { valid: false, error: 'Edit content too long' };
        }
        break;

    case 'delete':
        if (!data.messageId || typeof data.messageId !== 'string') {
            return { valid: false, error: 'messageId is required for delete' };
        }
        break;

    case 'typing':
        if (typeof data.typing !== 'boolean') {
            return { valid: false, error: 'typing must be a boolean' };
        }
        break;

    case 'ping':
        break;

    default:
        return { valid: false, error: 'Unknown message type' };
    }

    return { valid: true };
}

export function validateFileInfo(file) {
    if (!file || typeof file !== 'object') {
        return { valid: false, error: 'Invalid file info' };
    }
    if (!file.url || typeof file.url !== 'string') {
        return { valid: false, error: 'File URL is required' };
    }
    if (file.url.length > 2048) {
        return { valid: false, error: 'File URL too long' };
    }
    if (file.filename && file.filename.length > UPLOAD.MAX_FILENAME_LENGTH) {
        return { valid: false, error: 'Filename too long' };
    }
    if (file.filetype && file.filetype.length > UPLOAD.MAX_FILETYPE_LENGTH) {
        return { valid: false, error: 'Filetype too long' };
    }
    return { valid: true };
}

export function validateChannelName(name) {
    if (typeof name !== 'string') return { valid: false, error: 'Channel name must be a string' };
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, error: 'Channel name is required' };
    if (trimmed.length > CHANNEL.MAX_NAME_LENGTH) {
        return { valid: false, error: `Channel name must be ${CHANNEL.MAX_NAME_LENGTH} characters or less` };
    }
    return { valid: true, value: trimmed };
}

export function validateNickname(name) {
    if (typeof name !== 'string') return { valid: false, error: 'Nickname must be a string' };
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, error: 'Nickname is required' };
    if (trimmed.length > MAX_NICKNAME_LENGTH) {
        return { valid: false, error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or less` };
    }
    return { valid: true, value: trimmed };
}

export function validateDeadDropMessage(message) {
    if (typeof message !== 'string') return { valid: false, error: 'Message must be a string' };
    if (message.length === 0) return { valid: false, error: 'Message is required' };
    if (message.length > DEAD_DROP.MAX_MESSAGE_LENGTH) {
        return { valid: false, error: 'Message too long' };
    }
    return { valid: true };
}

export function validateSessionId(id) {
    if (typeof id !== 'string') return { valid: false, error: 'Session ID must be a string' };
    if (id.length === 0 || id.length > 200) {
        return { valid: false, error: 'Invalid session ID length' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return { valid: false, error: 'Session ID contains invalid characters' };
    }
    return { valid: true };
}
