// Push notification subscription handlers
import { PUSH_SUBSCRIPTION_TTL, PUSH_CONFIG } from '../config/constants.js';
import { sendPushNotification } from '../utils/web-push.js';
import { getFCMAccessToken } from '../utils/fcm-auth.js';
import { safeJson } from '../utils/helpers.js';

import { jsonError } from '../utils/errors.js';

/**
 * GET /api/push/vapid-key — Return VAPID public key
 */
export async function handleGetVapidKey(request, env, corsHeaders) {
    const publicKey = env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
        return jsonError('Push not configured', 503, request.headers.get('Origin'));
    }

    // Validate and sanitize the key
    const sanitizedKey = publicKey.trim();

    if (!/^[A-Za-z0-9_-]+$/.test(sanitizedKey)) {
        return jsonError('Invalid VAPID key configuration', 500, request.headers.get('Origin'));
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
        const body = await safeJson(request);
        const { subscription, sessionId, isFcmToken, type } = body;

        if (type === 'resubscribe' && subscription) {
            if (!subscription.endpoint) {
                return jsonError('Invalid resubscribe data', 400, request.headers.get('Origin'));
            }

            if (!env.PUSH_SUBSCRIPTIONS) {
                return jsonError('Push not configured', 503, request.headers.get('Origin'));
            }

            const allKeys = await listAllKvKeys(env.PUSH_SUBSCRIPTIONS, 'sub:');
            for (const key of allKeys) {
                const rawData = await env.PUSH_SUBSCRIPTIONS.get(key.name);
                if (!rawData) continue;
                const parsed = parseSubscriptionData(rawData);
                if (parsed && parsed.type === 'web' && parsed.data?.endpoint === subscription.endpoint) {
                    const dataToSave = { type: 'web', data: subscription };
                    await env.PUSH_SUBSCRIPTIONS.put(key.name, JSON.stringify(dataToSave), { expirationTtl: PUSH_SUBSCRIPTION_TTL });
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            return new Response(JSON.stringify({ success: true, note: 'No matching subscription found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!subscription || !sessionId) {
            return jsonError('Missing subscription or sessionId', 400, request.headers.get('Origin'));
        }

        // Validate subscription format based on type (Web Push vs FCM)
        if (!isFcmToken && (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth)) {
            return jsonError('Invalid subscription format', 400, request.headers.get('Origin'));
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
                { expirationTtl: PUSH_SUBSCRIPTION_TTL } // 30 days TTL
            );
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Push subscribe error:', error);
        return jsonError('Failed to subscribe', 500, request.headers.get('Origin'));
    }
}

/**
 * POST /api/push/unsubscribe — Remove push subscription
 */
export async function handlePushUnsubscribe(request, env, corsHeaders) {
    try {
        const body = await safeJson(request);
        const { sessionId } = body;

        if (!sessionId) {
            return jsonError('Missing sessionId', 400, request.headers.get('Origin'));
        }

        if (env.PUSH_SUBSCRIPTIONS) {
            await env.PUSH_SUBSCRIPTIONS.delete(`sub:${sessionId}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        return jsonError('Failed to unsubscribe', 500, request.headers.get('Origin'));
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
 * List all KV keys with cursor-based pagination (handles >100 entries)
 */
async function listAllKvKeys(kv, prefix) {
    const allKeys = [];
    let cursor = null;

    do {
        const list = await kv.list({ prefix, limit: PUSH_CONFIG.KV_LIST_LIMIT, cursor });
        allKeys.push(...list.keys);
        cursor = list.list_complete ? null : list.cursor;
    } while (cursor);

    return allKeys;
}

/**
 * Parse subscription data, handling legacy formats gracefully
 */
function parseSubscriptionData(rawData) {
    const parsed = JSON.parse(rawData);

    if (parsed && typeof parsed === 'object' && parsed.type && parsed.data !== undefined) {
        return parsed;
    }

    if (parsed && typeof parsed === 'object' && parsed.endpoint && parsed.keys) {
        return { type: 'web', data: parsed };
    }

    if (typeof parsed === 'string') {
        try {
            const inner = JSON.parse(parsed);
            if (inner && typeof inner === 'object' && inner.endpoint && inner.keys) {
                return { type: 'web', data: inner };
            }
        } catch (_e) { /* expected: not valid nested JSON */ }
    }

    return null;
}

/**
 * Send push notifications to offline subscribers
 * Called from ChatRoom.broadcast()
 * @param {Object} env - Worker environment
 * @param {Set<string>} onlineSessionIds - Currently connected session IDs
 * @param {Object} messageData - Message to send as notification
 */
export async function sendPushToOfflineUsers(env, onlineSessionIds, messageData) {
    if (!env.PUSH_SUBSCRIPTIONS) {
        return;
    }

    const vapidKeysExist = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    const fcmKeyExists = !!env.FCM_SERVICE_ACCOUNT;

    if (!vapidKeysExist && !fcmKeyExists) {
        return;
    }

    const vapidKeys = vapidKeysExist ? {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: 'mailto:admin@kalpha.kr'
    } : null;

    try {
        const allKeys = await listAllKvKeys(env.PUSH_SUBSCRIPTIONS, 'sub:');

        const pushPromises = [];
        const keysToDelete = [];

        for (const key of allKeys) {
            const sessionId = key.name.replace('sub:', '');

            if (onlineSessionIds.has(sessionId)) {
                continue;
            }

            try {
                const subRawData = await env.PUSH_SUBSCRIPTIONS.get(key.name);
                if (!subRawData) {
                    keysToDelete.push(key.name);
                    continue;
                }

                const subWrap = parseSubscriptionData(subRawData);
                if (!subWrap) {
                    console.warn(`[Push] Unparseable subscription for ${sessionId}, removing`);
                    keysToDelete.push(key.name);
                    continue;
                }

                const payload = {
                    title: '익명 채팅',
                body: messageData.content
                    ? (messageData.content.length > PUSH_CONFIG.BODY_TRUNCATION
                        ? messageData.content.substring(0, PUSH_CONFIG.BODY_TRUNCATION) + '...'
                            : messageData.content)
                        : '새 파일이 공유되었습니다.',
                    tag: 'chat-message',
                    url: '/'
                };

                if (subWrap.type === 'fcm') {
                    if (!fcmKeyExists) continue;

                    const fcmToken = subWrap.data;
                    pushPromises.push(
                        sendFcmNotification(fcmToken, payload, env)
                            .catch(async (err) => {
                                if (err.message && (err.message.includes('UNREGISTERED') || err.message.includes('INVALID_ARGUMENT'))) {
                                    keysToDelete.push(key.name);
                                }
                            })
                    );
                } else if (subWrap.type === 'web' && vapidKeysExist) {
                    const subscription = subWrap.data;
                    pushPromises.push(
                        sendPushNotification(subscription, JSON.stringify(payload), vapidKeys)
                            .then(async (response) => {
                                if (response.status === 404 || response.status === 410) {
                                    keysToDelete.push(key.name);
                                }
                            })
                            .catch((err) => {
                                console.error(`[Push WEB] Network error for ${sessionId}:`, err.message);
                            })
                    );
                }
            } catch (e) {
                console.error(`[Push] Error processing ${sessionId}:`, e.message);
            }
        }

        if (pushPromises.length > 0) {
            await Promise.allSettled(pushPromises);
        }

        if (keysToDelete.length > 0) {
            const deletePromises = keysToDelete.map(k => env.PUSH_SUBSCRIPTIONS.delete(k));
            await Promise.allSettled(deletePromises);
        }
    } catch (error) {
        console.error('[Push] sendPushToOfflineUsers error:', error.message);
    }
}
