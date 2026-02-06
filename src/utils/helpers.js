// HMAC signature generation for message integrity
export async function generateMessageSignature(message, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(JSON.stringify({
        content: message.content,
        sessionId: message.sessionId,
        timestamp: message.timestamp
    }));
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return arrayBufferToHex(signature);
}

// Verify HMAC signature
export async function verifyMessageSignature(message, signature, secret) {
    const expectedSignature = await generateMessageSignature(message, secret);
    return signature === expectedSignature;
}

// Helper function to convert ArrayBuffer to hex string
export function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
