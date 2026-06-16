import { SECURITY_EVENTS } from '../constants/security-events.js';

const XSS_PATTERNS = [
    /<script[\s>]/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<link[\s>]/i,
    /<meta[\s>]/i,
    /<svg[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=\s*["']?[^"'>]*[("']/i,
    /\balert\s*\(/i,
    /\beval\s*\(/i,
    /\bdocument\.cookie\b/i,
    /\bdocument\.write\b/i,
    /\bwindow\.location\b/i,
];

const SQL_PATTERNS = [
    /(\b(?:select|insert|update|delete|drop|alter|create|truncate|exec|execute)\b)[\s\S]*?(\b(?:from|into|set|where|table|database)\b)/i,
    /'\s*(?:or|and)\s+['\d]+?\s*=\s*['\d]+/i,
    /union\s+(?:all\s+)?select\b/i,
    /--[\s]*$/m,
    /\/\*[\s\S]*?\*\//,
    /;\s*(?:drop|alter|create|exec|shutdown)/i,
    /\bxp_cmdshell\b/i,
    /\b(?:information_schema|sys\.tables|sqlite_master)\b/i,
];

const PATH_TRAVERSAL_PATTERNS = [
    /\.\.(?:\\|\/)/,
    /(?:\\|\/)\.\./,
    /%2e%2e(?:%2f|%5c)/i,
    /(?:%2f|%5c)%2e%2e/i,
    /etc\/(?:passwd|shadow|hosts)/,
    /\\\\windows\\\\/i,
    /C:\\Windows\\/i,
    /\/proc\/(?:self|mounts)/,
    /\/var\/log\//,
];

const OVERSIZE_THRESHOLD_BYTES = 1024 * 1024;

export function classifyContent(content) {
    if (!content || typeof content !== 'string') return null;

    for (const pattern of SQL_PATTERNS) {
        if (pattern.test(content)) {
            return SECURITY_EVENTS.SQL_INJECTION;
        }
    }

    for (const pattern of XSS_PATTERNS) {
        if (pattern.test(content)) {
            return SECURITY_EVENTS.XSS_PAYLOAD;
        }
    }

    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(content)) {
            return SECURITY_EVENTS.PATH_TRAVERSAL;
        }
    }

    return null;
}

export function classifyPayloadSize(bodyLength) {
    if (bodyLength > OVERSIZE_THRESHOLD_BYTES) {
        return SECURITY_EVENTS.OVERSIZED_PAYLOAD;
    }
    return null;
}

export function classifyURLPath(pathname) {
    if (!pathname || typeof pathname !== 'string') return null;

    if (pathname.length > 2000) {
        return SECURITY_EVENTS.PATH_TRAVERSAL;
    }

    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(pathname)) {
            return SECURITY_EVENTS.PATH_TRAVERSAL;
        }
    }

    return null;
}

export function classifyBypassAttempt(ip, bannedIPsSet) {
    if (!ip || !bannedIPsSet) return null;
    if (bannedIPsSet.has(ip)) {
        return SECURITY_EVENTS.IP_BYPASS_ATTEMPT;
    }
    return null;
}

export const ALL_CLASSIFIED_EVENT_TYPES = new Set(
    Object.values(SECURITY_EVENTS)
        .filter((e) => e.category === 'input')
        .map((e) => e.type)
);
