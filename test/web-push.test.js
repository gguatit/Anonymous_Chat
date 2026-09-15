import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendPushNotification } from '../src/utils/web-push.js';

function base64url(bytes) {
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makeSubscription() {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );
    const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    return {
        endpoint: 'https://push.example.com/send/abc123',
        keys: { p256dh: base64url(publicKey), auth: base64url(auth) }
    };
}

async function makeVapidKeys() {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
    );
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    return {
        publicKey: base64url(raw),
        privateKey: jwk.d,
        subject: 'mailto:test@example.com'
    };
}

describe('web-push sendPushNotification (real module)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('encrypts the payload (RFC 8291) and sends VAPID auth (RFC 8292)', async () => {
        const fetchMock = vi.fn(async () => new Response('', { status: 201 }));
        vi.stubGlobal('fetch', fetchMock);

        const subscription = await makeSubscription();
        const vapidKeys = await makeVapidKeys();
        const payload = JSON.stringify({ title: 'hello', body: 'secret-body' });

        const response = await sendPushNotification(subscription, payload, vapidKeys);
        expect(response.status).toBe(201);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [endpoint, init] = fetchMock.mock.calls[0];
        expect(endpoint).toBe(subscription.endpoint);
        expect(init.method).toBe('POST');
        expect(init.headers['Content-Encoding']).toBe('aes128gcm');
        expect(init.headers['TTL']).toBe('86400');
        expect(init.headers['Authorization']).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    });

    it('builds a valid aes128gcm body that does not leak plaintext', async () => {
        const fetchMock = vi.fn(async () => new Response('', { status: 201 }));
        vi.stubGlobal('fetch', fetchMock);

        const subscription = await makeSubscription();
        const vapidKeys = await makeVapidKeys();
        const payload = JSON.stringify({ title: 'hello', body: 'secret-body' });

        await sendPushNotification(subscription, payload, vapidKeys);
        const body = new Uint8Array(fetchMock.mock.calls[0][1].body);

        // header: salt(16) + rs(4) + idlen(1) + keyid(65) = 86 bytes minimum
        expect(body.length).toBeGreaterThan(86);
        expect(body[20]).toBe(65);
        // key id must be a valid uncompressed P-256 point
        expect(body[21]).toBe(0x04);
        // record size field must match rs >= ciphertext length
        const recordSize = (body[16] << 24) | (body[17] << 16) | (body[18] << 8) | body[19];
        expect(recordSize).toBeGreaterThan(0);
        expect(recordSize).toBeLessThanOrEqual(body.length - 86);

        const text = new TextDecoder('utf-8', { fatal: false }).decode(body);
        expect(text).not.toContain('secret-body');
        expect(text).not.toContain('"title"');
    });

    it('VAPID JWT carries the correct audience and subject', async () => {
        const fetchMock = vi.fn(async () => new Response('', { status: 201 }));
        vi.stubGlobal('fetch', fetchMock);

        const subscription = await makeSubscription();
        const vapidKeys = await makeVapidKeys();
        await sendPushNotification(subscription, '{}', vapidKeys);

        const auth = fetchMock.mock.calls[0][1].headers['Authorization'];
        const jwt = auth.slice('vapid t='.length).split(',')[0];
        const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
        expect(claims.aud).toBe('https://push.example.com');
        expect(claims.sub).toBe('mailto:test@example.com');
        expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
});
