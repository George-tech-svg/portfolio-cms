// Cache only the public app shell. Never store API responses or admin pages.
const CACHE = 'george-public-shell-v7';
const SHELL = ['/', '/index.html', '/css/style.css', '/css/app.css', '/js/config.js', '/js/api.js', '/js/credentials.js', '/js/app.js', '/js/main.js', '/favicon.svg', '/manifest.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('george-public-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
    event.respondWith(fetch(event.request).then(response => {
        if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, copy)));
        }
        return response;
    }).catch(() => caches.match(event.request).then(response => response || caches.match(url.pathname))));
});
