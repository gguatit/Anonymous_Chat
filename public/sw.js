// Service Worker for Push Notifications
// This runs in the background even when the page is closed

self.addEventListener('install', (event) => {
    console.log('[SW] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activated');
    event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    let data = { title: '익명 채팅', body: '새 메시지가 도착했습니다.' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
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
        // Only skip notification if user is actively viewing the chat (visible AND focused)
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // Check if any client is both visible and focused
            const isActivelyUsing = clients.some(client => {
                return client.visibilityState === 'visible' && client.focused;
            });
            
            if (isActivelyUsing) {
                console.log('[SW] User is actively using the chat, skipping notification');
                return;
            }
            
            console.log('[SW] Showing notification - user not actively using chat');
            return self.registration.showNotification(data.title || '익명 채팅', options);
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    if (event.action === 'dismiss') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // Focus existing tab if available
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            return self.clients.openWindow(urlToOpen);
        })
    );
});
