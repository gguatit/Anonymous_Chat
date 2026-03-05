// Push notification subscription handlers
import { sendPushNotification } from '../utils/web-push.js';
import { getFCMAccessToken } from '../utils/fcm-auth.js';

/**
 * GET /api/push/vapid-key — Return VAPID public key
 */
export async function handleGetVapidKey(request, env, corsHeaders) {
    const publicKey = env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
        console.warn('[Push API] VAPID_PUBLIC_KEY not configured');
        return new Response(JSON.stringify({ error: 'Push not configured' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Validate and sanitize the key
    const sanitizedKey = publicKey.trim();

    // Log key info for debugging (first 20 chars only)
    console.log('[Push API] Returning VAPID key:', sanitizedKey.substring(0, 20) + '...', 'length:', sanitizedKey.length);

    // Validate base64url format
    if (!/^[A-Za-z0-9_-]+$/.test(sanitizedKey)) {
        console.error('[Push API] Invalid VAPID key format - contains invalid characters');
        return new Response(JSON.stringify({ error: 'Invalid VAPID key configuration' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ publicKey: sanitizedKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

/**
 * POST /api/push/subscribe — Store push subscription or FCM Token
 */
export async function handlePushSubscribe(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { subscription, sessionId, isFcmToken } = body;

        if (!subscription || !sessionId) {
            return new Response(JSON.stringify({ error: 'Missing subscription or sessionId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate subscription format based on type (Web Push vs FCM)
        if (!isFcmToken && (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth)) {
            return new Response(JSON.stringify({ error: 'Invalid subscription format' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Store in KV: key = sessionId, value = subscription wrap
        const dataToSave = {
            type: isFcmToken ? 'fcm' : 'web',
            data: subscription
        };

        if (env.PUSH_SUBSCRIPTIONS) {
            await env.PUSH_SUBSCRIPTIONS.put(
                `sub:${sessionId}`,
                JSON.stringify(dataToSave),
                { expirationTtl: 30 * 24 * 60 * 60 } // 30 days TTL
            );
            console.log(`[Push API] Saved ${dataToSave.type} subscription for ${sessionId}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Push subscribe error:', error);
        return new Response(JSON.stringify({ error: 'Failed to subscribe' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * POST /api/push/unsubscribe — Remove push subscription
 */
export async function handlePushUnsubscribe(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (env.PUSH_SUBSCRIPTIONS) {
            await env.PUSH_SUBSCRIPTIONS.delete(`sub:${sessionId}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        return new Response(JSON.stringify({ error: 'Failed to unsubscribe' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Send FCM Push via FCM v1 API
 */
async function sendFcmNotification(fcmToken, payload, env) {
    try {
        if (!env.FCM_SERVICE_ACCOUNT) {
            throw new Error('FCM_SERVICE_ACCOUNT environment variable is missing.');
        }

        const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT);
        const accessToken = await getFCMAccessToken(serviceAccount);
        const projectId = serviceAccount.project_id;

        const fcmMessage = {
            message: {
                token: fcmToken,
                notification: {
                    title: payload.title,
                    body: payload.body
                },
                data: {
                    url: payload.url,
                    tag: payload.tag
                }
            }
        };

        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(fcmMessage)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`FCM API Error: ${response.status} - ${errBody}`);
        }

        return response;
    } catch (error) {
        console.error('[Push FCM] Error sending FCM message:', error);
        throw error;
    }
}

/**
 * Send push notifications to offline subscribers
 * Called from ChatRoom.broadcast()
 * @param {Object} env - Worker environment
 * @param {Set<string>} onlineSessionIds - Currently connected session IDs
 * @param {Object} messageData - Message to send as notification
 */
export async function sendPushToOfflineUsers(env, onlineSessionIds, messageData) {
    console.log('[Push] sendPushToOfflineUsers called');

    // Validate environment configuration
    if (!env.PUSH_SUBSCRIPTIONS) {
        console.warn('[Push] PUSH_SUBSCRIPTIONS KV not configured');
        return;
    }

    const vapidKeysKeysExist = env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY;
    const fcmKeyExists = !!env.FCM_SERVICE_ACCOUNT;

    if (!vapidKeysKeysExist && !fcmKeyExists) {
        console.warn('[Push] Neither VAPID nor FCM keys configured - push notifications disabled');
        return;
    }

    const vapidKeys = vapidKeysKeysExist ? {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: 'mailto:admin@kalpha.kr'
    } : null;

    try {
        // List all subscriptions from KV
        const list = await env.PUSH_SUBSCRIPTIONS.list({ prefix: 'sub:', limit: 100 });
        console.log(`[Push] Found ${list.keys.length} subscriptions in KV`);

        const pushPromises = [];

        for (const key of list.keys) {
            const sessionId = key.name.replace('sub:', '');

            try {
                const subRawData = await env.PUSH_SUBSCRIPTIONS.get(key.name);
                if (!subRawData) {
                    console.log(`[Push] No data for key: ${key.name}`);
                    continue;
                }

                let subWrap;
                try {
                    subWrap = JSON.parse(subRawData);
                } catch (e) {
                    console.warn(`[Push] Failed to parse subscription data for ${key.name} - might be legacy format`);
                    // Fallback for legacy format
                    subWrap = { type: 'web', data: JSON.parse(subRawData) };
                }

                // For legacy compatibility, auto-detect web push
                if (!subWrap.type) {
                    subWrap = { type: 'web', data: subWrap };
                }

                const payload = {
                    title: '익명 채팅',
                    body: messageData.content
                        ? (messageData.content.length > 100
                            ? messageData.content.substring(0, 100) + '...'
                            : messageData.content)
                        : '새 파일이 공유되었습니다.',
                    tag: 'chat-message',
                    url: '/'
                };

                console.log(`[Push] Sending to ${sessionId} using ${subWrap.type} push...`);

                if (subWrap.type === 'fcm') {
                    if (!fcmKeyExists) {
                        console.warn('[Push] Cannot send FCM message: FCM_SERVICE_ACCOUNT missing.');
                        continue;
                    }

                    const fcmToken = subWrap.data;
                    pushPromises.push(
                        sendFcmNotification(fcmToken, payload, env)
                            .then(response => console.log(`[Push FCM] ✓ Sent to ${sessionId}`))
                            .catch(async (err) => {
                                // If token is unregistered, delete it from KV
                                if (err.message.includes('UNREGISTERED') || err.message.includes('INVALID_ARGUMENT')) {
                                    await env.PUSH_SUBSCRIPTIONS.delete(key.name);
                                    console.log(`[Push FCM] Removed invalid subscription for ${sessionId}`);
                                }
                            })
                    );
                } else if (subWrap.type === 'web' && vapidKeysKeysExist) {
                    const subscription = subWrap.data;
                    pushPromises.push(
                        sendPushNotification(subscription, JSON.stringify(payload), vapidKeys)
                            .then(async (response) => {
                                const body = await response.text();

                                if (response.ok) {
                                    console.log(`[Push WEB] ✓ Sent to ${sessionId}: ${response.status}`);
                                } else {
                                    console.warn(`[Push WEB] ✗ Failed for ${sessionId}: ${response.status} ${response.statusText} - ${body}`);
                                }

                                // If push service returns 404 or 410, subscription is invalid
                                if (response.status === 404 || response.status === 410) {
                                    await env.PUSH_SUBSCRIPTIONS.delete(key.name);
                                    console.log(`[Push WEB] Removed invalid subscription: ${sessionId}`);
                                }
                            })
                            .catch((err) => {
                                console.error(`[Push WEB] Network error sending to ${sessionId}:`, err.message);
                            })
                    );
                }
            } catch (e) {
                console.error(`[Push] Error processing subscription ${sessionId}:`, e.message);
            }
        }

        // Send all push notifications concurrently
        console.log(`[Push] Sending ${pushPromises.length} push notifications...`);
        await Promise.allSettled(pushPromises);
        console.log('[Push] All push notifications processed');
    } catch (error) {
        console.error('[Push] sendPushToOfflineUsers error:', error.message, error.stack);
    }
}
