/* أصوات التنبيه لكل مرحلة — مولّدة بالمتصفح بدون ملفات صوتية
   success حفظ · send إرسال للمراجعة · approve اعتماد · return إعادة بملاحظة · error خطأ
   start بدء مهمة · tick تقدّم · done اكتمال مهمة طويلة · notify وصول إشعار/تحديث من الآخرين */
(function (M) {
  'use strict';
  var last = 0;
  var TONES = {
    success: [[660, 0, 0.12], [990, 0.09, 0.16]],
    send: [[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.18]],
    approve: [[784, 0, 0.14], [988, 0.1, 0.14], [1319, 0.2, 0.26]],
    return: [[740, 0, 0.16], [554, 0.15, 0.24]],
    error: [[220, 0, 0.14, 'square'], [196, 0.18, 0.2, 'square']],
    start: [[880, 0, 0.08]],
    tick: [[1400, 0, 0.04]],
    done: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]],
    notify: [[1047, 0, 0.18], [1319, 0.16, 0.18], [1047, 0.32, 0.24]]
  };
  M.SOUND_LABELS = { success: 'حفظ', send: 'إرسال للمراجعة', approve: 'اعتماد', return: 'إعادة بملاحظة', error: 'خطأ', start: 'بدء مهمة', done: 'اكتمال مهمة', notify: 'إشعار وارد' };

  function ctx() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var c = M._ac || (M._ac = new AC());
    if (c.state === 'suspended') c.resume();
    return c;
  }
  M.sound = function (kind, force) {
    var st = (M.S && M.S.settings) || {};
    if (!force && st.soundOn === false) return;
    var now = Date.now(); if (!force && now - last < 220 && kind !== 'notify') return; last = now;
    var t = TONES[kind]; if (!t) return;
    var vol = st.soundVol == null ? 0.3 : Number(st.soundVol);
    try {
      var c = ctx(); if (!c) return;
      t.forEach(function (x) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = x[3] || 'sine'; o.frequency.value = x[0];
        var s = c.currentTime + x[1], d = x[2];
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * (x[3] === 'square' ? 0.35 : 1)), s + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, s + d);
        o.connect(g); g.connect(c.destination); o.start(s); o.stop(s + d + 0.02);
      });
    } catch (e) { /* الصوت غير متاح */ }
    if (kind === 'notify' || kind === 'error' || kind === 'return') { try { if (navigator.vibrate && st.soundOn !== false) navigator.vibrate(kind === 'error' ? [120, 60, 120] : [180]); } catch (e) { /* */ } }
  };

  /* كل رسالة نجاح/خطأ لها صوت */
  var origToast = M.toast;
  M.toast = function (msg, kind) { if (kind === 'ok') M.sound('success'); else if (kind === 'bad') M.sound('error'); return origToast.apply(this, arguments); };

  /* مراحل دورة اعتماد السؤال */
  var origStatus = M.setStatus;
  M.setStatus = function (q, status) {
    var r = origStatus.apply(this, arguments);
    Promise.resolve(r).then(function () { M.sound({ review: 'send', approved: 'approve', returned: 'return' }[status] || 'success'); });
    return r;
  };

  /* اكتمال مهمة طويلة: صوت + إشعار نظام لو التطبيق في الخلفية */
  M.notifyDone = function (title, body) {
    M.sound('done');
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.showNotification(title, { body: body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'miyar-task', vibrate: [200, 100, 200] }); });
  };

  /* تنزيل ملف (Word/Excel/PDF/حزمة) = اكتمال */
  var origDl = M.download;
  M.download = function () { var r = origDl.apply(this, arguments); M.sound('done'); return r; };
})(window.M);
