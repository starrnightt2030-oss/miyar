/* يُشغَّل قبل كل رفع: node tools/release.js
   يقرأ رقم الإصدار من js/version.js ثم يولّد version.json و sw.js بقائمة الملفات */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {} }; ctx.M = ctx.window.M = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'), ctx);
const M = ctx.window.M;
const top = M.CHANGELOG.find(c => c.v === M.VERSION) || { notes: [] };
fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify({ version: M.VERSION, date: M.RELEASE_DATE, mandatory: true, notes: top.notes }, null, 2) + '\n');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(path.join(root, d))) {
    const rel = d ? d + '/' + f : f;
    if (/^(\.|tools|supabase|sw\.js$|version\.json$|README|SETUP|node_modules)/.test(rel) || /\.(md|bat|zip|toml|sql|ts)$/.test(f)) continue;
    if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel); else files.push('./' + rel);
  }
})('');
files.sort(); files.push('./');
const sw = `/* معيار — Service Worker (مولَّد تلقائياً بواسطة tools/release.js — لا تعدّله يدوياً) */
var VERSION = '${M.VERSION}';
var CACHE = 'miyar-' + VERSION;
var FILES = ${JSON.stringify(files, null, 2)};

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
  if (url.pathname.endsWith('/config.json')) { e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(function () { return caches.match('./config.json'); })); return; }
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
/* الإشعارات الفورية من الخادم (Web Push) */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'معيار', body: e.data ? e.data.text() : '' }; }
  var isUpdate = d.kind === 'update';
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'معيار', {
      body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'miyar', renotify: true,
      requireInteraction: isUpdate, vibrate: isUpdate ? [250, 120, 250, 120, 400] : [200, 100, 200], data: { url: d.url || './index.html' }
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) { cl.forEach(function (c) { c.postMessage({ type: 'PUSH', data: d }); }); })
  ]));
});
self.addEventListener('periodicsync', function (e) { if (e.tag === 'miyar-update-check') e.waitUntil(checkAndNotify()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
    for (var i = 0; i < cl.length; i++) if ('focus' in cl[i]) { if (url.indexOf('#') >= 0 && cl[i].navigate) cl[i].navigate(url).catch(function () {}); return cl[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
`;
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log('release', M.VERSION, files.length, 'files');
