// Push notification subscription handlers
import { sendPushNotification } from '../utils/web-push.js';

/**
 * GET /api/push/vapid-key — Return VAPID public key
 */
export async function handleGetVapidKey(request, env, corsHeaders) {
    const publicKey = env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
        return new Response(JSON.stringify({ error: 'Push not configured' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ publicKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

/**
 * POST /api/push/subscribe — Store push subscription
 */
export async function handlePushSubscribe(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { subscription, sessionId } = body;

        if (!subscription || !sessionId) {
            return new Response(JSON.stringify({ error: 'Missing subscription or sessionId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate subscription has required fields
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
            return new Response(JSON.stringify({ error: 'Invalid subscription format' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Store in KV: key = sessionId, value = subscription
        if (env.PUSH_SUBSCRIPTIONS) {
            await env.PUSH_SUBSCRIPTIONS.put(
                `sub:${sessionId}`,
                JSON.stringify(subscription),
                { expirationTtl: 30 * 24 * 60 * 60 } // 30 days TTL
            );
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
 * Send push notifications to offline subscribers
 * Called from ChatRoom.broadcast()
 * @param {Object} env - Worker environment
 * @param {Set<string>} onlineSessionIds - Currently connected session IDs
 * @param {Object} messageData - Message to send as notification
 */
export async function sendPushToOfflineUsers(env, onlineSessionIds, messageData) {
    console.log('[Push] sendPushToOfflineUsers called');

    if (!env.PUSH_SUBSCRIPTIONS) {
        console.log('[Push] ABORT: no PUSH_SUBSCRIPTIONS KV');
        return;
    }
    if (!env.VAPID_PUBLIC_KEY) {
        console.log('[Push] ABORT: no VAPID_PUBLIC_KEY');
        return;
    }
    if (!env.VAPID_PRIVATE_KEY) {
        console.log('[Push] ABORT: no VAPID_PRIVATE_KEY');
        return;
    }

    const vapidKeys = {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: 'mailto:admin@kalpha.kr'
    };

    try {
        // List all subscriptions from KV
        const list = await env.PUSH_SUBSCRIPTIONS.list({ prefix: 'sub:', limit: 100 });
        console.log(`[Push] Found ${list.keys.length} subscriptions in KV`);

        const pushPromises = [];

        for (const key of list.keys) {
            const sessionId = key.name.replace('sub:', '');

            // Skip if it's the sender's own message
            if (sessionId === messageData.sessionId) {
                console.log(`[Push] Skipping sender: ${sessionId}`);
                continue;
            }

            try {
                const subData = await env.PUSH_SUBSCRIPTIONS.get(key.name);
                if (!subData) {
                    console.log(`[Push] No data for key: ${key.name}`);
                    continue;
                }

                const subscription = JSON.parse(subData);
                console.log(`[Push] Sending to ${sessionId}, endpoint: ${subscription.endpoint?.substring(0, 60)}...`);

                const payload = JSON.stringify({
                    title: '익명 채팅',
                    body: messageData.content
                        ? (messageData.content.length > 100
                            ? messageData.content.substring(0, 100) + '...'
                            : messageData.content)
                        : '새 파일이 공유되었습니다.',
                    tag: 'chat-message',
                    url: '/'
                });

                pushPromises.push(
                    sendPushNotification(subscription, payload, vapidKeys)
                        .then(async (response) => {
                            const body = await response.text();
                            console.log(`[Push] Response for ${sessionId}: ${response.status} ${response.statusText} - ${body}`);
                            // If push service returns 404 or 410, subscription is invalid
                            if (response.status === 404 || response.status === 410) {
                                await env.PUSH_SUBSCRIPTIONS.delete(key.name);
                                console.log(`[Push] Removed invalid subscription: ${sessionId}`);
                            }
                        })
                        .catch((err) => {
                            console.error(`[Push] Failed to send to ${sessionId}:`, err.message, err.stack);
                        })
                );
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
