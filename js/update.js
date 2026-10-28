/* التحديثات الإجبارية: فحص فوري + تنبيه صوتي + اهتزاز + إشعار */
(function (M) {
  'use strict';
  var esc = M.esc, n = M.n, I = M.icon;
  var shown = false, reg = null, beepTimer = null;

  M.cmpVer = function (a, b) {
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  };

  /* نغمة تنبيه بدون ملفات صوتية */
  M.chime = function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var ctx = M._ac || (M._ac = new AC());
      if (ctx.state === 'suspended') ctx.resume();
      [[880, 0], [1175, 0.18], [1568, 0.36]].forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = t[0];
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t[1]);
        g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t[1] + 0.32);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t[1]); o.stop(ctx.currentTime + t[1] + 0.35);
      });
    } catch (e) { /* الصوت غير متاح */ }
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 400]); } catch (e) { /* */ }
  };
  /* المتصفحات تمنع الصوت قبل أول لمسة — نفتح قناة الصوت مع أول تفاعل */
  document.addEventListener('pointerdown', function unlock() {
    try { var AC = window.AudioContext || window.webkitAudioContext; if (AC && !M._ac) M._ac = new AC(); if (M._ac && M._ac.state === 'suspended') M._ac.resume(); } catch (e) { /* */ }
    document.removeEventListener('pointerdown', unlock);
  });

  function notify(remote) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var opts = { body: 'الإصدار ' + remote.version + ' — افتح التطبيق للتحديث الآن', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'miyar-update', requireInteraction: true, vibrate: [250, 120, 250] };
    if (reg && reg.showNotification) reg.showNotification('تحديث جديد لمعيار', opts).catch(function () {});
    else try { new Notification('تحديث جديد لمعيار', opts); } catch (e) { /* */ }
  }

  M.checkUpdate = function (manual) {
    if (location.protocol.indexOf('http') !== 0) { if (manual) M.toast('فحص التحديثات يعمل عند فتح التطبيق من الرابط (GitHub)', 'bad'); return Promise.resolve(null); }
    if (!navigator.onLine) { if (manual) M.toast('لا يوجد اتصال بالإنترنت', 'bad'); return Promise.resolve(null); }
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (remote) {
      if (!remote || !remote.version) return null;
      M.S.settings && M.setSetting && M.setSetting('lastUpdateCheck', M.now());
      if (M.cmpVer(remote.version, M.VERSION) > 0) { M.showUpdate(remote); return remote; }
      if (manual) M.toast('أنت على أحدث إصدار (' + M.VERSION + ')', 'ok');
      return null;
    }).catch(function () { if (manual) M.toast('تعذّر الوصول لخادم التحديثات', 'bad'); return null; });
  };

  M.showUpdate = function (remote) {
    if (shown) return; shown = true;
    var ov = document.createElement('div');
    ov.className = 'overlay update-ov';
    ov.innerHTML = '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="up-h">' +
      '<div class="modal-h" style="background:var(--accent);color:#fff;border-radius:16px 16px 0 0"><span class="pulse">' + I('download', 24) + '</span><h2 id="up-h">تحديث جديد إجباري — الإصدار ' + esc(remote.version) + '</h2></div>' +
      '<div class="modal-b"><div class="row small muted">الإصدار الحالي: <b>' + esc(M.VERSION) + '</b> ← الجديد: <b style="color:var(--accent-d)">' + esc(remote.version) + '</b>' + (remote.date ? ' · ' + esc(remote.date) : '') + '</div>' +
      (remote.notes && remote.notes.length ? '<div><b>ما الجديد:</b><ul style="margin:6px 0 0;padding-inline-start:20px">' + remote.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="alert ok">' + I('lock') + '<div>بياناتك محفوظة ولن تتأثر — يُحفظ تلقائياً نسخة داخلية قبل التحديث.</div></div></div>' +
      '<div class="modal-f"><button class="btn pri" id="up-go" style="min-width:180px">' + I('download') + ' تحديث الآن</button><span class="small muted" id="up-st"></span></div></div>';
    document.body.appendChild(ov);
    M.chime();
    beepTimer = setInterval(function () { if (document.visibilityState === 'visible') M.chime(); }, 20000);
    if (document.visibilityState !== 'visible') notify(remote);
    M.qs('#up-go', ov).onclick = function () {
      var b = this; b.disabled = true; M.qs('#up-st', ov).textContent = 'جاري التحديث…';
      clearInterval(beepTimer);
      var snap = M.snapshot ? M.snapshot('قبل التحديث إلى ' + remote.version) : Promise.resolve();
      snap.catch(function () {}).then(function () { return M.log ? M.log('تحديث التطبيق', M.VERSION + ' ← ' + remote.version) : null; }).then(applyUpdate);
    };
  };

  function hardReload() {
    var p = window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : Promise.resolve();
    p.then(function () { location.replace(location.pathname + '?v=' + Date.now() + location.hash); });
  }

  function applyUpdate() {
    if (!('serviceWorker' in navigator)) return hardReload();
    var done = false;
    var fallback = setTimeout(function () { if (!done) hardReload(); }, 10000);
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (done) return; done = true; clearTimeout(fallback); location.reload(); });
    navigator.serviceWorker.getRegistration().then(function (r) {
      if (!r) return hardReload();
      var push = function (w) { w.postMessage({ type: 'SKIP_WAITING' }); };
      if (r.waiting) return push(r.waiting);
      r.update().then(function () {
        if (r.waiting) return push(r.waiting);
        var w = r.installing;
        if (!w) return hardReload();
        w.addEventListener('statechange', function () { if (w.state === 'installed') push(w); });
      }).catch(hardReload);
    });
  }

  /* طلب إذن الإشعارات + الفحص الدوري في الخلفية (Chrome على الهاتف عند التثبيت) */
  M.enableUpdateNotifications = function () {
    if (!('Notification' in window)) { M.toast('المتصفح لا يدعم الإشعارات', 'bad'); return Promise.resolve(false); }
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { M.toast('لم يُسمح بالإشعارات — فعّلها من إعدادات المتصفح', 'bad'); return false; }
      return navigator.serviceWorker.ready.then(function (r) {
        var j = r.periodicSync && navigator.permissions ? navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (st) {
          if (st.state === 'granted') return r.periodicSync.register('miyar-update-check', { minInterval: 6 * 60 * 60 * 1000 }).then(function () { return true; });
          return false;
        }).catch(function () { return false; }) : Promise.resolve(false);
        return j.then(function (bg) {
          M.setSetting('notifyEnabled', true);
          r.showNotification('معيار', { body: 'تم تفعيل إشعارات التحديث' + (bg ? ' — مع الفحص في الخلفية' : ''), icon: 'icons/icon-192.png', tag: 'miyar-test' });
          M.toast('تم تفعيل الإشعارات', 'ok');
          return true;
        });
      });
    });
  };

  M.startUpdates = function () {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    navigator.serviceWorker.register('sw.js').then(function (r) {
      reg = r;
      /* لو في نسخة جديدة نزلت بالفعل وتنتظر */
      if (r.waiting && navigator.serviceWorker.controller) M.checkUpdate();
      r.addEventListener('updatefound', function () {
        var w = r.installing;
        if (w) w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) M.checkUpdate(); });
      });
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'UPDATE_AVAILABLE') M.checkUpdate(); });
    M.checkUpdate();
    setInterval(function () { if (document.visibilityState === 'visible') M.checkUpdate(); }, 3 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') M.checkUpdate(); });
    window.addEventListener('online', function () { M.checkUpdate(); });
  };

  /* بعد التحديث: رسالة «تم التحديث» + ما الجديد */
  M.afterUpdateNotice = function () {
    var last = M.S.settings.lastSeenVersion;
    if (last === M.VERSION) return;
    M.setSetting('lastSeenVersion', M.VERSION);
    if (!last) return;
    var entry = (M.CHANGELOG || []).find(function (c) { return c.v === M.VERSION; });
    M.modal({ title: 'تم التحديث إلى الإصدار ' + M.VERSION,
      body: '<div class="alert ok">' + I('check') + '<div>تم التحديث بنجاح من الإصدار ' + esc(last) + '، وبياناتك كما هي.</div></div>' +
        (entry ? '<ul style="margin:0;padding-inline-start:20px">' + entry.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''),
      foot: '<button class="btn pri" data-x>تمام</button>' });
  };

  M.changelogHTML = function () {
    return (M.CHANGELOG || []).map(function (c) {
      return '<div style="padding:8px 0;border-bottom:1px solid #EEF0F4"><div class="row"><b>الإصدار ' + esc(c.v) + '</b><span class="small muted">' + n(c.date) + '</span>' + (c.v === M.VERSION ? '<span class="chip ok">الحالي</span>' : '') + '</div><ul style="margin:4px 0 0;padding-inline-start:20px" class="small">' + c.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  };
})(window.M);
