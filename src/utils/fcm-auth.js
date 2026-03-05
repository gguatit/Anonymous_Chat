// src/utils/fcm-auth.js
// Utility to generate Google OAuth 2.0 JWT for FCM v1 API using Web Crypto API

/**
 * Creates a JWT signed with the Service Account private key
 * @param {Object} serviceAccount - Parsed service account JSON
 * @returns {Promise<string>} Signed JWT
 */
export async function getFCMAccessToken(serviceAccount) {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600, // 1 hour max
        scope: 'https://www.googleapis.com/auth/firebase.messaging'
    };

    const headerBase64 = StringUtils.toBase64Url(JSON.stringify(header));
    const claimBase64 = StringUtils.toBase64Url(JSON.stringify(claim));
    const unsignedJwt = `${headerBase64}.${claimBase64}`;

    const signature = await CryptoUtils.signRs256(unsignedJwt, serviceAccount.private_key);
    const signatureBase64 = StringUtils.arrayBufferToBase64Url(signature);

    const jwt = `${unsignedJwt}.${signatureBase64}`;

    // Exchange JWT for Access Token
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[FCM Auth] Token exchange failed:', errorText);
        throw new Error(`Failed to get FCM access token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
}

const StringUtils = {
    toBase64Url(str) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        return this.arrayBufferToBase64Url(bytes);
    },
    
    arrayBufferToBase64Url(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
};

const CryptoUtils = {
    async signRs256(data, privateKeyPem) {
        // Convert PEM to binary
        const pemHeader = '-----BEGIN PRIVATE KEY-----';
        const pemFooter = '-----END PRIVATE KEY-----';
        const pemContents = privateKeyPem
            .replace(pemHeader, '')
            .replace(pemFooter, '')
            .replace(/\s/g, '');
        
        const binaryDerString = atob(pemContents);
        const binaryDer = new Uint8Array(binaryDerString.length);
        for (let i = 0; i < binaryDerString.length; i++) {
            binaryDer[i] = binaryDerString.charCodeAt(i);
        }

        // Import key for Web Crypto
        const cryptoKey = await crypto.subtle.importKey(
            'pkcs8',
            binaryDer.buffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: { name: 'SHA-256' },
            },
            false,
            ['sign']
        );

        // Sign data
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        return await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            cryptoKey,
            dataBuffer
        );
    }
};
