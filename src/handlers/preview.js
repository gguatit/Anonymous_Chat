import { safeJson } from '../utils/helpers.js';

const OG_CACHE_TTL = 3600;
const MAX_BODY_BYTES = 32768;
const RATE_LIMIT_WINDOW = 12000;
const RATE_LIMIT_MAX = 8;

const rateLimitMap = new Map();

function getRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    if (entry.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }
    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function parseOG(html) {
    const og = { title: '', description: '', image: '', url: '', siteName: '' };

    const ogRegex = /<meta\s[^>]*property="og:([^"]+)"[^>]*content="([^"]*)"[^>]*\/?>/gi;
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        if (key === 'title') og.title = value;
        else if (key === 'description') og.description = value;
        else if (key === 'image') og.image = value;
        else if (key === 'url') og.url = value;
        else if (key === 'site_name') og.siteName = value;
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
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = getRateLimit(clientIP);
    if (!rl.allowed) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let body;
    try {
        body = await safeJson(request);
    } catch (_e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const targetUrl = body.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing url' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Invalid protocol');
        }
    } catch (_e) {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const fetchResponse = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; OGPreviewBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9'
            },
            cf: {
                cacheTtl: OG_CACHE_TTL,
                cacheEverything: true
            }
        });

        if (!fetchResponse.ok) {
            return new Response(JSON.stringify({ og: null }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const contentType = fetchResponse.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return new Response(JSON.stringify({ og: null }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const reader = fetchResponse.body.getReader();
        let html = '';
        let total = 0;

        while (total < MAX_BODY_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            html += new TextDecoder().decode(value, { stream: true });
            total += value.length;
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
        return new Response(JSON.stringify({ og: null }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
