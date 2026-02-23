// Web Push utility for Cloudflare Workers (no Node.js dependencies)
// Implements VAPID (RFC 8292) + Payload Encryption (RFC 8291) using Web Crypto API

/**
 * Send a push notification to a subscriber
 * @param {Object} subscription - PushSubscription from the client
 * @param {string} payload - JSON string payload to send
 * @param {Object} vapidKeys - { publicKey, privateKey, subject }
 * @returns {Promise<Response>}
 */
export async function sendPushNotification(subscription, payload, vapidKeys) {
    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys.p256dh;
    const auth = subscription.keys.auth;

    // 1. Generate VAPID Authorization header
    const vapidHeaders = await generateVAPIDHeaders(endpoint, vapidKeys);

    // 2. Encrypt the payload (RFC 8291 - aes128gcm)
    const encrypted = await encryptPayload(payload, p256dh, auth);

    // 3. Send the request to the push service
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': vapidHeaders.authorization,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            'TTL': '86400', // 24 hours
            ...vapidHeaders.crypto
        },
        body: encrypted
    });

    return response;
}

/**
 * Generate VAPID Authorization headers (RFC 8292)
 */
async function generateVAPIDHeaders(endpoint, vapidKeys) {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
        aud: audience,
        exp: now + 12 * 3600, // 12 hours
        sub: vapidKeys.subject
    };

    // Import VAPID private key
    const privateKeyBytes = base64urlDecode(vapidKeys.privateKey);
    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        d: vapidKeys.privateKey,
        x: '', // Will be extracted from public key
        y: ''
    };

    // Extract x and y from the uncompressed public key (65 bytes: 0x04 + x + y)
    const pubKeyBytes = base64urlDecode(vapidKeys.publicKey);
    jwk.x = base64urlEncode(pubKeyBytes.slice(1, 33));
    jwk.y = base64urlEncode(pubKeyBytes.slice(33, 65));

    const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    // Create and sign JWT
    const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify(jwtPayload)));
    const signingInput = `${header}.${payload}`;

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(signingInput)
    );

    // Convert DER signature to raw (r + s)
    const rawSig = derToRaw(new Uint8Array(signature));
    const sig = base64urlEncode(rawSig);
    const jwt = `${signingInput}.${sig}`;

    return {
        authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        crypto: {}
    };
}

/**
 * Encrypt push payload using aes128gcm (RFC 8291)
 */
async function encryptPayload(plaintext, p256dhKey, authKey) {
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Client's public key and auth secret
    const clientPublicKeyBytes = base64urlDecode(p256dhKey);
    const authSecret = base64urlDecode(authKey);

    // Import the client's public key
    const clientPublicKey = await crypto.subtle.importKey(
        'raw',
        clientPublicKeyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    // Generate a server ephemeral key pair
    const serverKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    // ECDH shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: clientPublicKey },
        serverKeyPair.privateKey,
        256
    );

    // Export server public key
    const serverPublicKeyBytes = new Uint8Array(
        await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
    );

    // HKDF to derive IKM from auth secret + shared secret
    // info = "WebPush: info\0" + clientPublicKey + serverPublicKey
    const authInfo = concatArrays(
        new TextEncoder().encode('WebPush: info\0'),
        clientPublicKeyBytes,
        serverPublicKeyBytes
    );

    const ikm = await hkdf(authSecret, new Uint8Array(sharedSecret), authInfo, 32);

    // Generate 16-byte salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive content encryption key (CEK) and nonce
    const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
    const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

    const prk = await hkdfExtract(salt, ikm);
    const cek = await hkdfExpand(prk, cekInfo, 16);
    const nonce = await hkdfExpand(prk, nonceInfo, 12);

    // Pad the plaintext (add delimiter byte 0x02 for final record)
    const paddedPlaintext = new Uint8Array(plaintextBytes.length + 1);
    paddedPlaintext.set(plaintextBytes);
    paddedPlaintext[plaintextBytes.length] = 2; // 0x02 = final record delimiter

    // AES-128-GCM encrypt
    const cekKey = await crypto.subtle.importKey(
        'raw',
        cek,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            cekKey,
            paddedPlaintext
        )
    );

    // Build aes128gcm header:
    // salt (16 bytes) + record size (4 bytes, big-endian) + key ID length (1 byte) + key ID (server public key, 65 bytes)
    const recordSize = paddedPlaintext.length + 16; // plaintext + tag
    const header = new Uint8Array(16 + 4 + 1 + 65);
    header.set(salt, 0); // salt
    header[16] = (recordSize >> 24) & 0xff;
    header[17] = (recordSize >> 16) & 0xff;
    header[18] = (recordSize >> 8) & 0xff;
    header[19] = recordSize & 0xff;
    header[20] = 65; // key ID length
    header.set(serverPublicKeyBytes, 21); // key ID

    // Concatenate header + ciphertext
    const result = new Uint8Array(header.length + ciphertext.length);
    result.set(header, 0);
    result.set(ciphertext, header.length);

    return result;
}

// ---- Utility functions ----

function base64urlEncode(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let str = '';
    for (const b of bytes) {
        str += String.fromCharCode(b);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function concatArrays(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + (arr instanceof Uint8Array ? arr : new Uint8Array(arr)).length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        const bytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
        result.set(bytes, offset);
        offset += bytes.length;
    }
    return result;
}

/**
 * HKDF (RFC 5869) using Web Crypto
 */
async function hkdf(salt, ikm, info, length) {
    const prk = await hkdfExtract(salt, ikm);
    return hkdfExpand(prk, info, length);
}

async function hkdfExtract(salt, ikm) {
    const key = await crypto.subtle.importKey(
        'raw',
        salt.length ? salt : new Uint8Array(32),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}

async function hkdfExpand(prk, info, length) {
    const key = await crypto.subtle.importKey(
        'raw',
        prk,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    let t = new Uint8Array(0);
    let okm = new Uint8Array(0);
    let counter = 1;

    while (okm.length < length) {
        const input = concatArrays(t, info, new Uint8Array([counter]));
        t = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
        okm = concatArrays(okm, t);
        counter++;
    }

    return okm.slice(0, length);
}

/**
 * Convert DER-encoded ECDSA signature to raw (r || s) format
 */
function derToRaw(der) {
    // DER: 0x30 <total_len> 0x02 <r_len> <r> 0x02 <s_len> <s>
    const raw = new Uint8Array(64);

    let offset = 2; // Skip 0x30 and total length
    // Read r
    offset++; // Skip 0x02
    let rLen = der[offset++];
    let rStart = offset;
    offset += rLen;

    // Read s
    offset++; // Skip 0x02
    let sLen = der[offset++];
    let sStart = offset;

    // Copy r (right-aligned to 32 bytes, skip leading zeros)
    const rBytes = der.slice(rStart, rStart + rLen);
    if (rLen > 32) {
        raw.set(rBytes.slice(rLen - 32), 0);
    } else {
        raw.set(rBytes, 32 - rLen);
    }

    // Copy s (right-aligned to 32 bytes, skip leading zeros)
    const sBytes = der.slice(sStart, sStart + sLen);
    if (sLen > 32) {
        raw.set(sBytes.slice(sLen - 32), 32);
    } else {
        raw.set(sBytes, 64 - sLen);
    }

    return raw;
}
