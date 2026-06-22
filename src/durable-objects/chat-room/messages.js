import { SECURITY, RATE_LIMIT, ONE_MINUTE_MS, MESSAGE_RETENTION_MS } from '../../config/constants.js';

export function isLikelyCode(content, cachedHint) {
    if (cachedHint !== undefined) return cachedHint;
    if (!content || typeof content !== 'string') return false;
    if (/```/.test(content)) return true;
    const trimmed = content.trim();
    const lines = trimmed.split(/\r?\n/);
    if (lines.length < 2) return false;
    if (lines.length > 50) return true;
    if (/^(#!\/bin\/|import\s|from\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|def\s|return\s|#include|#define|using\s|namespace\s|public\s|private\s|SELECT\s|INSERT\s|CREATE\s)/mi.test(trimmed)) return true;
    let codeEndingLines = 0;
    for (const line of lines) {
        const t = line.trim();
        if (/[;{})\]]=?>?\s*$/.test(t) && t.length > 1) codeEndingLines++;
    }
    if (codeEndingLines / lines.length > 0.4) return true;
    const codeChars = (trimmed.match(/[{}();=<>]/g) || []).length;
    if (codeChars / trimmed.length > 0.08) return true;
    return false;
}

export function containsUrl(content) {
    if (!content || typeof content !== 'string') return false;
    return /https?:\/\/[^\s<>"{}|^`[\]]+/i.test(content) ||
            /www\.[a-zA-Z0-9][-a-zA-Z0-9]*[a-zA-Z0-9]*(\.[a-zA-Z]{2,})+/i.test(content);
}

export function generateSessionId() {
    const randomPart1 = crypto.randomUUID().replace(/-/g, '');
    const randomPart2 = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    return `user_${randomPart1.substring(0, 16)}${randomPart2}`;
}

export function sanitizeContentForAI(content) {
    if (!content || !content.trim()) return null;
    const trimmed = content.trim();

    if (trimmed.length <= 2) return null;

    const jamo = (trimmed.match(/[\u1100-\u11FF\u3130-\u318F]/g) || []).length;
    const syllables = (trimmed.match(/[\uAC00-\uD7AF]/g) || []).length;
    if (jamo > 0 && (jamo / Math.max(1, jamo + syllables)) >= 0.8) return null;

    if (/^```|^(import |export |function |class |const |let |var |async function)/m.test(trimmed)) {
        const firstLine = trimmed.split('\n')[0].substring(0, 60);
        return firstLine + ' [코드]';
    }

    if (/^[\s\W_]+$/.test(trimmed) && trimmed.length < 10) return null;

    return trimmed;
}

export function extractErrorLocation(error) {
    if (error instanceof Error && error.stack) {
        const lines = error.stack.split('\n');
        if (lines.length > 1) {
            return lines[1].trim();
        }
    }
    return 'Unknown';
}

export function validateMessage(data, metadata) {
    const hasFile = data.file && data.file.url;
    const hasFiles = data.files && Array.isArray(data.files) && data.files.length > 0 && data.files[0].url;
    const hasContent = data.content && data.content.trim().length > 0;

    if (!hasContent && !hasFile && !hasFiles) {
        return '메시지 내용이 비어있습니다.';
    }

    if (data.content && data.content.length > SECURITY.MAX_MESSAGE_LENGTH) {
        return `메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`;
    }

    const now = Date.now();
    if (now - metadata.lastMessageTime < RATE_LIMIT.MESSAGE_COOLDOWN) {
        return '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.';
    }

    const oneMinuteAgo = now - ONE_MINUTE_MS;
    if (!metadata._minuteWindowStart || metadata._minuteWindowStart < oneMinuteAgo) {
        metadata._minuteWindowStart = now;
        metadata._minuteMessageCount = 0;
    }
    if (metadata._minuteMessageCount >= RATE_LIMIT.MAX_MESSAGES_PER_MINUTE) {
        return '분당 메시지 전송 한도를 초과했습니다.';
    }

    return null;
}

export function searchMessages(messages, query, limit) {
    if (!query || query.trim().length === 0) {
        return { results: [], total: 0 };
    }

    const tags = [];
    const terms = [];
    const parts = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    for (const part of parts) {
        if (part.startsWith('#')) {
            tags.push(part.substring(1));
        } else {
            terms.push(part);
        }
    }

    if (tags.length > 0) {
        terms.length = 0;
    }

    if (tags.length === 0 && terms.length === 0) {
        return { results: [], total: 0 };
    }

    const results = [];
    const twelveHoursAgo = Date.now() - MESSAGE_RETENTION_MS;
    const recentMessages = messages.filter(msg => msg.timestamp > twelveHoursAgo);

    for (const msg of recentMessages) {
        if (results.length >= limit) break;

        if (tags.length > 0) {
            let matchesAllTags = true;
            for (const tag of tags) {
                if (tag === 'images') {
                    const hasImage = (msg.file && msg.file.filetype && msg.file.filetype.startsWith('image/')) ||
                                   (msg.files && msg.files.some(f => f.filetype && f.filetype.startsWith('image/')));
                    if (!hasImage) {
                        matchesAllTags = false;
                        break;
                    }
                } else if (tag === 'files') {
                    const hasNonImage = (msg.file && msg.file.filetype && !msg.file.filetype.startsWith('image/')) ||
                                      (msg.files && msg.files.some(f => f.filetype && !f.filetype.startsWith('image/')));
                    if (!hasNonImage) {
                        matchesAllTags = false;
                        break;
                    }
                } else if (tag === 'code') {
                    if (!isLikelyCode(msg.content || '', msg._codeHint)) {
                        matchesAllTags = false;
                        break;
                    }
                } else if (tag === 'url') {
                    if (!containsUrl(msg.content || '')) {
                        matchesAllTags = false;
                        break;
                    }
                } else {
                    matchesAllTags = false;
                    break;
                }
            }
            if (!matchesAllTags) continue;
        }

        if (terms.length > 0) {
            const content = (msg.content || '').toLowerCase();
            const nickname = (msg.nickname || '').toLowerCase();
            const fileName = (msg.file?.filename || '').toLowerCase();
            const matchesAllTerms = terms.every(term =>
                content.includes(term) ||
                nickname.includes(term) ||
                fileName.includes(term)
            );
            if (!matchesAllTerms) continue;
        }

        const tagList = [];
        if (msg.file && msg.file.filetype) {
            if (msg.file.filetype.startsWith('image/')) {
                tagList.push('images');
            } else {
                tagList.push('files');
            }
        }
        if (msg.files && msg.files.length > 0) {
            const hasImage = msg.files.some(f => f.filetype && f.filetype.startsWith('image/'));
            const hasNonImage = msg.files.some(f => f.filetype && !f.filetype.startsWith('image/'));
            if (hasImage && !tagList.includes('images')) {
                tagList.push('images');
            }
            if (hasNonImage && !tagList.includes('files')) {
                tagList.push('files');
            }
        }
        if (isLikelyCode(msg.content || '', msg._codeHint)) {
            tagList.push('code');
        }
        if (containsUrl(msg.content || '')) {
            tagList.push('url');
        }

        results.push({
            messageId: msg.messageId,
            content: msg.content || '',
            nickname: msg.nickname || 'Anonymous',
            sessionId: msg.sessionId,
            timestamp: msg.timestamp,
            hasFile: !!(msg.file),
            fileName: msg.file?.filename || null,
            fileType: msg.file?.filetype || null,
            tags: tagList
        });
    }

    return { results, total: results.length };
}
