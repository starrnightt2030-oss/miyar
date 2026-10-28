/* معيار — Service Worker (مولَّد تلقائياً بواسطة tools/release.js — لا تعدّله يدوياً) */
var VERSION = '1.1.0';
var CACHE = 'miyar-' + VERSION;
var FILES = [
  "./css/app.css",
  "./css/fonts.css",
  "./css/paper.css",
  "./fonts/naskh-ar-400.woff2",
  "./fonts/naskh-ar-600.woff2",
  "./fonts/naskh-ar-700.woff2",
  "./fonts/naskh-lat-400.woff2",
  "./fonts/naskh-lat-600.woff2",
  "./fonts/naskh-lat-700.woff2",
  "./fonts/plex-ar-400.woff2",
  "./fonts/plex-ar-500.woff2",
  "./fonts/plex-ar-600.woff2",
  "./fonts/plex-ar-700.woff2",
  "./fonts/plex-lat-400.woff2",
  "./fonts/plex-lat-500.woff2",
  "./fonts/plex-lat-600.woff2",
  "./fonts/plex-lat-700.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/app.js",
  "./js/db.js",
  "./js/draw.js",
  "./js/exchange.js",
  "./js/generator.js",
  "./js/math.js",
  "./js/paper.js",
  "./js/safety.js",
  "./js/store.js",
  "./js/update.js",
  "./js/util.js",
  "./js/version.js",
  "./js/views-admin.js",
  "./js/views-bank.js",
  "./js/views-exam.js",
  "./js/word.js",
  "./manifest.webmanifest",
  "./vendor/docx.umd.js",
  "./vendor/xlsx.full.min.js",
  "./"
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return fetch(f, { cache: 'reload' }).then(function (r) { if (r.ok) return c.put(f, r); }); }));
  }).then(function () {
    /* أول تثبيت: تفعيل فوري. التحديثات: تنتظر ضغط «تحديث الآن» */
    return self.clients.matchAll().then(function (cl) { if (!cl.length) return self.skipWaiting(); cl.forEach(function (c) { c.postMessage({ type: 'UPDATE_AVAILABLE', version: VERSION }); }); });
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('miyar-') === 0 && k !== CACHE && k !== 'miyar-meta'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(function () { return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); })); return; }
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(e.request).then(function (res) { if (res && res.ok) c.put(e.request, res.clone()); return res; })
        .catch(function () { return e.request.mode === 'navigate' ? c.match('./index.html') : Response.error(); });
    });
  }));
});
/* فحص التحديث في الخلفية وإظهار إشعار حتى والتطبيق مغلق (Chrome على الهاتف بعد التثبيت) */
function checkAndNotify() {
  return fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
    if (!v.version || v.version === VERSION) return;
    return caches.open('miyar-meta').then(function (c) {
      return c.match('notified').then(function (m) { return m ? m.text() : ''; }).then(function (last) {
        if (last === v.version) return;
        return self.registration.showNotification('تحديث جديد لمعيار — الإصدار ' + v.version, {
          body: (v.notes || []).slice(0, 2).join(' · ') || 'افتح التطبيق للتحديث الآن', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
          tag: 'miyar-update', requireInteraction: true, vibrate: [250, 120, 250, 120, 400], renotify: true
        }).then(function () { return c.put('notified', new Response(v.version)); });
      });
    });
  }).catch(function () {});
}
self.addEventListener('periodicsync', function (e) { if (e.tag === 'miyar-update-check') e.waitUntil(checkAndNotify()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
    for (var i = 0; i < cl.length; i++) if ('focus' in cl[i]) return cl[i].focus();
    return self.clients.openWindow('./index.html');
  }));
});
