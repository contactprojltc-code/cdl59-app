const VERSION = '1782470268';
const CACHE = 'cdl59-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      const old = keys.filter(k => k !== CACHE);
      const isUpgrade = old.length > 0;
      return Promise.all(old.map(k => caches.delete(k)))
        .then(() => self.clients.claim())
        .then(() => isUpgrade
          ? self.clients.matchAll({includeUncontrolled: true})
              .then(clients => clients.forEach(c => c.postMessage({type: 'SW_UPDATED'})))
          : null
        );
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // HTML / navigation : toujours depuis le rÃ©seau, jamais en cache
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Assets JS/CSS/images : cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      });
      return cached || net;
    })
  );
});

// PUSH NOTIFICATIONS
self.addEventListener('push', e => {
  let data = {title: 'CDL59', body: 'Nouvelle livraison disponible !', url: '/cdl59-app/driver/'};
  try { data = {...data, ...e.data.json()}; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/cdl59-app/icon.png',
      badge: '/cdl59-app/icon.png',
      tag: 'cdl59-delivery',
      renotify: true,
      vibrate: [200, 100, 200, 100, 300],
      data: {url: data.url}
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(wins => {
      const existing = wins.find(w => w.url.includes('/cdl59-app/driver'));
      if (existing) { existing.focus(); return; }
      return clients.openWindow('/cdl59-app/driver/');
    })
  );
});


