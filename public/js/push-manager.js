// Push Notification Manager
// Handles Service Worker registration, permission requests, and push subscriptions

export class PushNotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
        this.vapidPublicKey = null;
        this._sessionSubscribed = false;
    }

    async initialize() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[Push] Push notifications not supported');
            return { supported: false, subscribed: false };
        }

        try {
            this.swRegistration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
            console.log('[Push] Service Worker registered');

            await navigator.serviceWorker.ready;

            const response = await fetch('/api/push/vapid-key');
            if (!response.ok) {
                const errorData = await response.json();
                console.warn('[Push] VAPID key not available:', errorData.error);
                return { supported: false, subscribed: false, error: 'Push notifications not configured' };
            }

            const data = await response.json();

            if (!data.publicKey) {
                console.error('[Push] Server returned empty VAPID key');
                return { supported: false, subscribed: false, error: 'Invalid server response' };
            }

            this.vapidPublicKey = data.publicKey.trim();

            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                this.isSubscribed = true;
                this._sessionSubscribed = true;
            } else {
                const stored = sessionStorage.getItem('pushSubscribed');
                if (stored === 'true') {
                    this._sessionSubscribed = true;
                }
            }

            console.log('[Push] Initialization complete, subscribed:', this.isSubscribed);

            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'push-received') {
                    console.log('[Push] Push forwarded from SW while page visible');
                }
            });

            return { supported: true, subscribed: this.isSubscribed };
        } catch (error) {
            console.error('[Push] Initialization failed:', error);
            return { supported: false, subscribed: false, error: error.message };
        }
    }

    /**
     * Request notification permission and subscribe
     * @param {string} sessionId - Current user's session ID
     * @returns {Promise<boolean>}
     */
    async subscribe(sessionId) {
        try {
            console.log('[Push] Starting subscription process...');

            // --- ANDROID WEBVIEW / FCM HYBRID SUPPORT ---
            // If running inside our Android Hybrid App, the Android native side will provide the FCM token
            // via window.AndroidBridge.getDeviceToken() or similar mechanism.
            if (window.AndroidBridge && typeof window.AndroidBridge.getFcmToken === 'function') {
                console.log('[Push] Android Hybrid App detected. Using FCM token.');
                const fcmToken = window.AndroidBridge.getFcmToken();

                if (!fcmToken) {
                    console.error('[Push] ✗ AndroidBridge returned empty FCM token.');
                    return false;
                }

                // Send FCM token to server directly
                const response = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscription: fcmToken,
                        sessionId,
                        isFcmToken: true
                    })
                });

                if (response.ok) {
                    this.isSubscribed = true;
                    this._sessionSubscribed = true;
                    sessionStorage.setItem('pushSubscribed', 'true');
                    console.log('[Push] ✓ FCM Token subscribed successfully via Hybrid App');
                    return true;
                } else {
                    const errorText = await response.text();
                    console.error('[Push] ✗ Server rejected FCM subscription:', response.status, errorText);
                    return false;
                }
            }
            // --- END ANDROID OVERRIDE ---

            // Request permission for standard Web Push
            const permission = await Notification.requestPermission();
            console.log('[Push] Permission result:', permission);

            if (permission !== 'granted') {
                console.log('[Push] Permission denied by user');
                return false;
            }

            if (!this.swRegistration) {
                console.log('[Push] Re-initializing Service Worker...');
                const initResult = await this.initialize();
                if (!initResult.supported) {
                    console.error('[Push] Initialization failed:', initResult.error);
                    return false;
                }
            }

            if (!this.vapidPublicKey) {
                console.error('[Push] VAPID public key not available');
                return false;
            }

            console.log('[Push] Converting VAPID key...');
            // Convert VAPID key from base64url to Uint8Array
            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

            console.log('[Push] Subscribing to push service...');
            // Subscribe to push
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            console.log('[Push] Sending subscription to server...');
            // Send subscription to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    sessionId,
                    isFcmToken: false
                })
            });

            if (response.ok) {
                this.isSubscribed = true;
                this._sessionSubscribed = true;
                sessionStorage.setItem('pushSubscribed', 'true');
                console.log('[Push] ✓ Subscribed successfully');
                return true;
            } else {
                const errorText = await response.text();
                console.error('[Push] ✗ Server rejected subscription:', response.status, errorText);
                return false;
            }
        } catch (error) {
            console.error('[Push] ✗ Subscribe failed:', error.name, error.message);
            return false;
        }
    }

    /**
     * Unsubscribe from push notifications
     * @param {string} sessionId
     * @returns {Promise<boolean>}
     */
    async unsubscribe(sessionId) {
        try {
            const subscription = await this.swRegistration?.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }

            await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            this.isSubscribed = false;
            this._sessionSubscribed = false;
            sessionStorage.removeItem('pushSubscribed');
            console.log('[Push] Unsubscribed');
            return true;
        } catch (error) {
            console.error('[Push] Unsubscribe failed:', error);
            return false;
        }
    }

    /**
     * Toggle subscription state
     * @param {string} sessionId
     * @returns {Promise<boolean|undefined>} new subscription state, or undefined on error
     */
    async toggle(sessionId) {
        try {
            if (this.isSubscribed) {
                const success = await this.unsubscribe(sessionId);
                if (!success) {
                    console.error('[Push] Failed to unsubscribe');
                    return undefined;
                }
            } else {
                const success = await this.subscribe(sessionId);
                if (!success) {
                    console.error('[Push] Failed to subscribe');
                    return undefined;
                }
            }
            return this.isSubscribed;
        } catch (error) {
            console.error('[Push] Toggle error:', error);
            return undefined;
        }
    }

    /**
     * Check if push notifications are supported
     */
    static isSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    /**
     * Get current permission state
     */
    static getPermissionState() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission; // 'default', 'granted', 'denied'
    }

    /**
     * Convert base64url to Uint8Array (for applicationServerKey)
     */
    urlBase64ToUint8Array(base64String) {
        if (!base64String || typeof base64String !== 'string') {
            throw new Error('VAPID public key is empty or invalid');
        }

        try {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        } catch (error) {
            console.error('[Push] Failed to decode VAPID key:', error);
            throw new Error('Invalid VAPID public key format: ' + error.message);
        }
    }
}
