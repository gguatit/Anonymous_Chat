// Push Notification Manager
// Handles Service Worker registration, permission requests, and push subscriptions

export class PushNotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
        this.vapidPublicKey = null;
    }

    /**
     * Initialize push notifications
     * @returns {Promise<boolean>} true if push is supported and SW registered
     */
    async initialize() {
        // Check browser support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[Push] Push notifications not supported');
            return false;
        }

        try {
            // Register Service Worker
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('[Push] Service Worker registered');

            // Wait for the SW to be ready
            await navigator.serviceWorker.ready;

            // Fetch VAPID public key from server
            const response = await fetch('/api/push/vapid-key');
            const data = await response.json();
            this.vapidPublicKey = data.publicKey;

            // Check existing subscription
            const subscription = await this.swRegistration.pushManager.getSubscription();
            this.isSubscribed = !!subscription;

            return true;
        } catch (error) {
            console.error('[Push] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Request notification permission and subscribe
     * @param {string} sessionId - Current user's session ID
     * @returns {Promise<boolean>}
     */
    async subscribe(sessionId) {
        try {
            // Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('[Push] Permission denied');
                return false;
            }

            if (!this.swRegistration) {
                await this.initialize();
            }

            // Convert VAPID key from base64url to Uint8Array
            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

            // Subscribe to push
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            // Send subscription to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    sessionId
                })
            });

            if (response.ok) {
                this.isSubscribed = true;
                console.log('[Push] Subscribed successfully');
                return true;
            } else {
                console.error('[Push] Server rejected subscription');
                return false;
            }
        } catch (error) {
            console.error('[Push] Subscribe failed:', error);
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

                // Notify server
                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId })
                });
            }

            this.isSubscribed = false;
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
     * @returns {Promise<boolean>} new subscription state
     */
    async toggle(sessionId) {
        if (this.isSubscribed) {
            await this.unsubscribe(sessionId);
        } else {
            await this.subscribe(sessionId);
        }
        return this.isSubscribed;
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
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}
