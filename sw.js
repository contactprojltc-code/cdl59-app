const VERSION = '1782469058';
const CACHE = 'cdl59-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({includeUncontrolled: true}))
      .then(clients => clients.forEach(c => c.postMessage({type: 'SW_UPDATED'})))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(r => {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      });
      return cached || networkFetch;
    })
  );
});

// ── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {title: 'CDL59', body: '🚨 Nouvelle livraison disponible !', url: '/cdl59-app/driver/'};
  try { data = {...data, ...e.data.json()}; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/cdl59-app/icon.svg',
      badge: '/cdl59-app/icon.svg',
      tag: 'cdl59-delivery',
      renotify: true,
      vibrate: [200, 100, 200, 100, 300],
      requireInteraction: false,
      data: {url: data.url}
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(wins => {
      const target = '/cdl59-app/driver/';
      const existing = wins.find(w => w.url.includes('/cdl59-app/driver'));
      if (existing) { existing.focus(); return; }
      return clients.openWindow(target);
    })
  );
});
