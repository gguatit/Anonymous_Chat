self.addEventListener('install', (_event) => {
    console.log('[SW] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activated');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    let data = { title: '익명 채팅', body: '새 메시지가 도착했습니다.' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (_e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body || '새 메시지가 도착했습니다.',
        icon: '/ico/android-chrome-192x192.png',
        badge: '/ico/android-chrome-192x192.png',
        tag: data.tag || 'chat-message',
        renotify: true,
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: [
            { action: 'open', title: '채팅 열기' },
            { action: 'dismiss', title: '닫기' }
        ],
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const isActivelyViewing = clients.some(client => {
                return client.visibilityState === 'visible';
            });

            if (isActivelyViewing) {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'push-received',
                        payload: data
                    });
                });
                console.log('[SW] Page is visible, forwarding push to page');
                return;
            }

            console.log('[SW] Showing notification - page not visible');
            return self.registration.showNotification(data.title || '익명 채팅', options);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    if (event.action === 'dismiss') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(urlToOpen);
        })
    );
});

self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW] Push subscription changed/expired');
    event.waitUntil(
        self.registration.pushManager.getSubscription().then((subscription) => {
            if (!subscription) {
                return;
            }
            return fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    type: 'resubscribe'
                })
            }).catch(err => {
                console.error('[SW] Failed to resubscribe:', err);
            });
        })
    );
});
