/**
 * RamadanReady - Service Worker
 * Provides offline support and background notifications
 */

const CACHE_VERSION = 'ramadan-ready-v3';
const CACHE_NAME = CACHE_VERSION;
const FETCH_TIMEOUT = 5000;
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/db.js',
    '/js/alarms.js',
    '/js/file-handler.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Install complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Cache failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('Service Worker: Deleting old cache', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - hybrid caching strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    const url = new URL(event.request.url);
    const isHtmlRequest = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/index.html';
    
    if (isHtmlRequest) {
        // Network-first with cache fallback for HTML
        event.respondWith(networkFirstWithCacheFallback(event.request));
    } else {
        // Cache-first for static assets (CSS, JS, icons)
        event.respondWith(cacheFirstStrategy(event.request));
    }
});

// Network-first with cache fallback for HTML
async function networkFirstWithCacheFallback(request) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        
        const networkResponse = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache for', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Fetch failed for', request.url, error);
        throw error;
    }
}

// Message event - handle communication from main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker: Received message', event.data);
    
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: event.data.icon || '/icons/icon-192x192.png',
            tag: event.data.tag,
            requireInteraction: event.data.requireInteraction || false,
            actions: [
                {
                    action: 'open',
                    title: 'Open App'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        });
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // Focus existing window if open
                    for (const client of clientList) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    
                    // Open new window if not already open
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
    console.log('Service Worker: Notification closed', event);
});

// Background sync for alarm scheduling
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);
    
    if (event.tag === 'schedule-alarms') {
        event.waitUntil(handleAlarmSync());
    }
});

// Handle alarm sync - reschedule alarms from service worker
async function handleAlarmSync() {
    try {
        // Get clients and request alarm data
        const clients = await self.clients.matchAll();
        
        if (clients.length > 0) {
            // Send message to main thread to get alarm data
            const client = clients[0];
            client.postMessage({ type: 'REQUEST_ALARM_DATA' });
        }
        
        // Check for periodic sync support
        if ('periodicSync' in self.registration) {
            const status = await self.registration.periodicSync.getTags();
            if (!status.includes('alarm-check')) {
                await self.registration.periodicSync.register('alarm-check', {
                    minInterval: 60 * 60 * 1000, // 1 hour
                    minFetchInterval: 15 * 60 * 1000 // 15 minutes minimum
                });
            }
        }
    } catch (error) {
        console.error('Service Worker: Alarm sync failed', error);
    }
}

// Periodic background sync for alarm checking
self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync', event.tag);
    
    if (event.tag === 'alarm-check') {
        event.waitUntil(checkAlarms());
    }
});

// Check and trigger alarms
async function checkAlarms() {
    try {
        // Try to get stored alarm data
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match('/js/alarms.js');
        
        if (response) {
            // Notify main thread to check alarms
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({ type: 'CHECK_ALARMS' });
            });
        }
    } catch (error) {
        console.error('Service Worker: Alarm check failed', error);
    }
}

// Push event (for push notifications - requires server)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push received', event);
    
    if (event.data) {
        const data = event.data.json();
        
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: '/icons/icon-192x192.png',
                tag: data.tag,
                requireInteraction: true,
                vibrate: [200, 100, 200]
            })
        );
    } else {
        // Default notification
        event.waitUntil(
            self.registration.showNotification('RamadanReady', {
                body: 'New notification',
                icon: '/icons/icon-192x192.png',
                tag: 'default'
            })
        );
    }
});