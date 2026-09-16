import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleTurnstileVerify, verifyTurnstileTicket } from '../src/handlers/turnstile.js';
import { arrayBufferToHex } from '../src/utils/helpers.js';

const ENV = { TURNSTILE_SECRET_KEY: 'test', HMAC_SECRET: 'test-hmac' };

function makeRequest(body) {
    return new Request('https://example.com/api/turnstile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function callVerify(sessionId = 'session-1') {
    const res = await handleTurnstileVerify(makeRequest({ token: 'turnstile-token', sessionId }), ENV, {});
    return res.json();
}

async function sign(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return arrayBufferToHex(signature);
}

async function craftTicket(secret, sessionId, ts) {
    return `${ts}.${await sign(secret, `turnstile:${sessionId}:${ts}`)}`;
}

describe('turnstile ticket flow', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('issues a ticket on successful siteverify', async () => {
        const data = await callVerify('session-1');
        expect(data.success).toBe(true);
        expect(data.ticket).toMatch(/^\d+\.[0-9a-f]{64}$/);
    });

    it('accepts a ticket issued for the same session', async () => {
        const { ticket } = await callVerify('session-1');
        await expect(verifyTurnstileTicket(ENV, ticket, 'session-1')).resolves.toBe(true);
    });

    it('rejects the same ticket for a different session', async () => {
        const { ticket } = await callVerify('session-1');
        await expect(verifyTurnstileTicket(ENV, ticket, 'session-2')).resolves.toBe(false);
    });

    it('rejects a tampered ticket', async () => {
        const { ticket } = await callVerify('session-1');
        const last = ticket.at(-1);
        const tampered = ticket.slice(0, -1) + (last === 'a' ? 'b' : 'a');
        await expect(verifyTurnstileTicket(ENV, tampered, 'session-1')).resolves.toBe(false);
    });

    it('rejects a 13h-old ticket even with a valid signature', async () => {
        const ts = Date.now() - 13 * 60 * 60 * 1000;
        const ticket = await craftTicket(ENV.HMAC_SECRET, 'session-1', ts);
        await expect(verifyTurnstileTicket(ENV, ticket, 'session-1')).resolves.toBe(false);
    });

    it('rejects a ticket older than the 2h TTL and accepts one within it', async () => {
        const oldTs = Date.now() - (2 * 60 * 60 * 1000 + 1000);
        const oldTicket = await craftTicket(ENV.HMAC_SECRET, 'session-1', oldTs);
        await expect(verifyTurnstileTicket(ENV, oldTicket, 'session-1')).resolves.toBe(false);

        const freshTs = Date.now() - 60 * 60 * 1000;
        const freshTicket = await craftTicket(ENV.HMAC_SECRET, 'session-1', freshTs);
        await expect(verifyTurnstileTicket(ENV, freshTicket, 'session-1')).resolves.toBe(true);
    });

    it('rejects a ticket timestamped more than 60s in the future', async () => {
        const ts = Date.now() + 120 * 1000;
        const ticket = await craftTicket(ENV.HMAC_SECRET, 'session-1', ts);
        await expect(verifyTurnstileTicket(ENV, ticket, 'session-1')).resolves.toBe(false);
    });

    it('rejects empty and garbage tickets', async () => {
        for (const bad of ['', null, undefined, 'garbage', '123', '123.', '.abc', 'a.b', '123.zz']) {
            await expect(verifyTurnstileTicket(ENV, bad, 'session-1')).resolves.toBe(false);
        }
    });

    it('rejects every ticket when HMAC_SECRET is missing', async () => {
        const { ticket } = await callVerify('session-1');
        const noSecret = { TURNSTILE_SECRET_KEY: 'test' };
        await expect(verifyTurnstileTicket(noSecret, ticket, 'session-1')).resolves.toBe(false);
    });
});
