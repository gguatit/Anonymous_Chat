import { describe, it, expect, vi, afterEach } from 'vitest';
import { getFCMAccessToken } from '../src/utils/fcm-auth.js';

async function makeServiceAccount() {
    const { privateKey } = await crypto.subtle.generateKey(
        {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
    );
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
    let binary = '';
    for (const b of pkcs8) binary += String.fromCharCode(b);
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----`;
    return { client_email: 'svc@test-project.iam.gserviceaccount.com', private_key: pem };
}

describe('fcm-auth getFCMAccessToken (real module)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('exchanges a signed RS256 JWT for an access token', async () => {
        const fetchMock = vi.fn(async () =>
            new Response(JSON.stringify({ access_token: 'ya29.test-token' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const token = await getFCMAccessToken(await makeServiceAccount());
        expect(token).toBe('ya29.test-token');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://oauth2.googleapis.com/token');
        expect(init.method).toBe('POST');

        const params = init.body;
        expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');

        const assertion = params.get('assertion');
        const [headerPart, claimsPart, signaturePart] = assertion.split('.');
        expect(signaturePart.length).toBeGreaterThan(0);

        const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
        expect(header.alg).toBe('RS256');
        expect(header.typ).toBe('JWT');

        const claims = JSON.parse(Buffer.from(claimsPart, 'base64url').toString());
        expect(claims.iss).toBe('svc@test-project.iam.gserviceaccount.com');
        expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
        expect(claims.exp).toBeGreaterThan(claims.iat);
        expect(claims.scope).toContain('firebase.messaging');
    });

    it('throws when the token endpoint rejects the assertion', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid_grant', { status: 401 })));

        await expect(getFCMAccessToken(await makeServiceAccount())).rejects.toThrow(
            'Failed to get FCM access token: 401'
        );
    });
});
