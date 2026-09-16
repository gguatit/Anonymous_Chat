import { safeJson } from '../utils/helpers.js';

import { jsonError } from '../utils/errors.js';

const OG_CACHE_TTL = 3600;
const MAX_BODY_BYTES = 32768;
const RATE_LIMIT_WINDOW = 12000;
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_MAX_ENTRIES = 5000;
const MAX_REDIRECTS = 2;

const rateLimitMap = new Map();

const OG_FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; OGPreviewBot/1.0)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'ko-KR,ko;q=0.9'
};

export function _clearPreviewRateLimit() {
    rateLimitMap.clear();
}

function isPrivateV4(a, b, c, d) {
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0) return true;                          // 0.0.0.0/8 (unspecified)
    if (a === 127 || a === 10) return true;            // loopback / private
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;           // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && c === 0) return true;  // 192.0.0.0/24 IETF
    if (a === 192 && b === 0 && c === 2) return true;  // TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a === 198 && b === 51 && c === 100) return true;  // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true;   // TEST-NET-3
    if (a >= 224) return true;                         // multicast, reserved, broadcast
    return false;
}

export function isPrivateHost(hostname) {
    if (typeof hostname !== 'string' || !hostname) return true;

    let host = hostname.toLowerCase();
    if (host.startsWith('[') && host.endsWith(']')) {
        host = host.slice(1, -1);
    }

    if (
        host === 'localhost' ||
        host === 'metadata.google.internal' ||
        host.endsWith('.internal') ||
        host.endsWith('.local')
    ) {
        return true;
    }

    const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        return isPrivateV4(Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4]));
    }

    if (host.includes(':')) {
        if (host === '::1' || host === '::') return true;
        if (host.startsWith('fc') || host.startsWith('fd')) return true; // fc00::/7 ULA
        if (/^fe[89ab]/.test(host)) return true;         // fe80::/10 link-local

        // IPv4-mapped IPv6: ::ffff:127.0.0.1 (dotted) or ::ffff:7f00:1 (hex, WHATWG-normalized)
        const mappedDotted = host.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (mappedDotted) {
            return isPrivateV4(Number(mappedDotted[1]), Number(mappedDotted[2]), Number(mappedDotted[3]), Number(mappedDotted[4]));
        }
        const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (mappedHex) {
            const hi = parseInt(mappedHex[1], 16);
            const lo = parseInt(mappedHex[2], 16);
            return isPrivateV4((hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff);
        }
        return false;
    }
    return false;
}

function validateUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (_e) {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isPrivateHost(parsed.hostname)) return null;
    return parsed;
}

function nullPreview(corsHeaders) {
    return new Response(JSON.stringify({ og: null }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

async function fetchHtml(targetUrl) {
    let current = targetUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (!validateUrl(current)) return null;

        const response = await fetch(current, {
            redirect: 'manual',
            headers: OG_FETCH_HEADERS,
            cf: {
                cacheTtl: OG_CACHE_TTL,
                cacheEverything: true
            }
        });

        if (response.status < 300 || response.status >= 400) return response;

        const location = response.headers.get('Location');
        if (!location) return null;

        try {
            current = new URL(location, current).href;
        } catch (_e) {
            return null;
        }
    }

    return null;
}

function getRateLimit(ip) {
    const now = Date.now();

    if (rateLimitMap.size > 100) {
        for (const [key, entry] of rateLimitMap) {
            if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
                rateLimitMap.delete(key);
            }
        }
    }

    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        if (!entry && rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
            return { allowed: false, remaining: 0 };
        }
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    if (entry.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }
    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function decodeEntities(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function parseOG(html) {
    const og = { title: '', description: '', image: '', url: '', siteName: '' };

    const metaRegex = /<meta\s([^>]*)>/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
        const attrs = {};
        const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(metaMatch[1])) !== null) {
            attrs[attrMatch[1].toLowerCase()] = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
        }

        const key = (attrs.property || attrs.name || '').toLowerCase();
        if (!key || attrs.content === undefined) continue;
        const value = decodeEntities(attrs.content).trim();

        if (key === 'og:title') og.title = value;
        else if (key === 'og:description') og.description = value;
        else if (key === 'og:image') og.image = value;
        else if (key === 'og:url') og.url = value;
        else if (key === 'og:site_name') og.siteName = value;
    }

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!og.title && titleMatch) {
        og.title = titleMatch[1].trim();
    }

    const urlMatch = html.match(/<link\s[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i);
    if (!og.url && urlMatch) {
        og.url = urlMatch[1].trim();
    }

    return og;
}

export async function handlePreview(request, env, corsHeaders) {
    if (request.method !== 'POST') {
        return jsonError('Method not allowed', 405, request.headers.get('Origin'));
    }

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = getRateLimit(clientIP);
    if (!rl.allowed) {
        return jsonError('Rate limit exceeded', 429, request.headers.get('Origin'));
    }

    let body;
    try {
        body = await safeJson(request);
    } catch (_e) {
        return jsonError('Invalid JSON', 400, request.headers.get('Origin'));
    }

    const targetUrl = body.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
        return jsonError('Missing url', 400, request.headers.get('Origin'));
    }

    if (!validateUrl(targetUrl)) {
        return jsonError('Invalid URL', 400, request.headers.get('Origin'));
    }

    try {
        const fetchResponse = await fetchHtml(targetUrl);

        if (!fetchResponse || !fetchResponse.ok || !fetchResponse.body) {
            return nullPreview(corsHeaders);
        }

        const contentType = fetchResponse.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return nullPreview(corsHeaders);
        }

        const reader = fetchResponse.body.getReader();
        const decoder = new TextDecoder();
        let html = '';
        let total = 0;

        while (total < MAX_BODY_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            const remaining = MAX_BODY_BYTES - total;
            const chunk = value.length > remaining ? value.slice(0, remaining) : value;
            html += decoder.decode(chunk, { stream: true });
            total += chunk.length;
        }
        reader.cancel();

        const og = parseOG(html);

        if (og.image && !og.image.startsWith('http')) {
            try {
                og.image = new URL(og.image, targetUrl).href;
            } catch (_e) { /* expected: relative URL unresolvable */
                og.image = '';
            }
        }

        return new Response(JSON.stringify({ og }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${OG_CACHE_TTL}`
            }
        });
    } catch (error) {
        console.error('OG preview error:', error);
        return nullPreview(corsHeaders);
    }
}
