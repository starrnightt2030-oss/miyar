/* الدخول: شاشة البداية + القفل بالبصمة (WebAuthn على الجهاز نفسه) أو رمز الدخول
   البصمة لا تغادر الهاتف أبداً: المتصفح يطلب من نظام التشغيل التحقق، ونحن نحفظ معرّف المفتاح فقط */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, I = M.icon;
  var AUTO_LOCK_MS = 5 * 60 * 1000;

  function rand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }

  M.bio = {
    supported: function () { return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext); },
    available: function () {
      if (!M.bio.supported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
      return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
    },
    enabled: function () { return !!(S.settings.bio && S.settings.bio.id); },
    enroll: function () {
      var me = M.me();
      return navigator.credentials.create({ publicKey: {
        challenge: rand(32), rp: { name: 'معيار' },
        user: { id: rand(16), name: (me.name || 'user') + '@miyar', displayName: me.name || 'مستخدم معيار' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000, attestation: 'none'
      } }).then(function (cred) {
        if (!cred) throw new Error('لم يكتمل التسجيل');
        return M.setSetting('bio', { id: b64(cred.rawId), at: M.now() });
      }).then(function () { M.log && M.log('تفعيل الدخول بالبصمة', M.me().name || ''); });
    },
    verify: function () {
      var b = S.settings.bio; if (!b || !b.id) return Promise.reject(new Error('البصمة غير مفعّلة'));
      return navigator.credentials.get({ publicKey: {
        challenge: rand(32), allowCredentials: [{ type: 'public-key', id: unb64(b.id), transports: ['internal', 'hybrid'] }],
        userVerification: 'required', timeout: 60000
      } }).then(function (a) { if (!a) throw new Error('لم يتم التحقق'); return true; });
    },
    disable: function () { return M.setSetting('bio', null); }
  };

  M.lockEnabled = function () { return !!(M.me().pin || M.bio.enabled()); };

  /* القفل التلقائي بعد ٥ دقائق في الخلفية */
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS && S.settings.setupDone && M.lockEnabled() && !M._locked && !document.querySelector('.overlay')) { M._locked = true; M.render(); }
  });

  function authShell(inner, foot) {
    var cen = S.settings.center || {};
    return '<div class="auth"><aside class="auth-hero"><div class="ah-in">' +
      '<div class="ah-brand">' + (cen.logo ? '<img src="' + cen.logo + '" alt="">' : '<span class="ah-mark">' + I('exam', 30) + '</span>') + '<div><b>معيار</b><span>' + esc(cen.name || 'بنك الأسئلة وتصميم الامتحانات') + '</span></div></div>' +
      '<h1>امتحانات احترافية<br>من بنك أسئلة موثّق</h1>' +
      '<ul class="ah-list"><li>' + I('bank', 18) + ' بنك أسئلة مرتبط بالدروس ونواتج التعلم</li><li>' + I('exam', 18) + ' أوراق A4 وA3 بترويسة وثيقة الجودة</li><li>' + I('spark', 18) + ' توليد الأسئلة من صور شرح الدرس</li><li>' + I('lock', 18) + ' يعمل بدون إنترنت — وبياناتك على جهازك</li></ul>' +
      '<div class="ah-foot">ISO 21001 · v' + esc(M.VERSION) + '</div></div></aside>' +
      '<main class="auth-main"><div class="auth-card">' + inner + '</div>' + (foot || '') + '</main></div>';
  }

  /* ===== الإعداد الأول ===== */
  M.views.setup = function (app) {
    var st = { role: 'teacher', bio: false };
    app.innerHTML = authShell(
      '<div class="ac-head"><h2>مرحباً بك في معيار</h2><p>إعداد هذا الجهاز — دقيقة واحدة</p></div>' +
      '<div class="field"><label for="su-name">اسمك</label><input id="su-name" class="inp lg" placeholder="مثال: أ. محمد علي" autocomplete="name"></div>' +
      '<div class="field"><span class="lbl">دورك على هذا الجهاز</span><div class="role-pick">' +
      '<button type="button" data-r="teacher" class="on">' + I('edit', 22) + 'مدرس<small>يبني بنك أسئلة مادته ويرسله</small></button>' +
      '<button type="button" data-r="head">' + I('review', 22) + 'رئيس قسم<small>يراجع ويعتمد الأسئلة</small></button>' +
      '<button type="button" data-r="admin">' + I('merge', 22) + 'مدير النظام<small>يجمع ويصدّر ويدير الجودة</small></button></div></div>' +
      '<div class="field" id="su-center-f" style="display:none"><label for="su-center">اسم مركز التدريب / المدرسة</label><input id="su-center" class="inp"></div>' +
      '<div class="field"><label for="su-pin">رمز دخول (اختياري — ٤ أرقام أو أكثر)</label><input id="su-pin" class="inp lg pin" inputmode="numeric" type="password" autocomplete="new-password" placeholder="••••"></div>' +
      '<label class="bio-opt" id="su-bio-f" style="display:none"><input type="checkbox" id="su-bio"><span class="bio-ic">' + I('finger', 22) + '</span><span><b>الدخول بالبصمة</b><small>افتح التطبيق ببصمة الإصبع أو الوجه — والرمز احتياطي</small></span></label>' +
      '<button class="btn pri lg" id="su-go" style="width:100%">ابدأ الآن</button>' +
      '<button class="btn ghost" id="su-restore" style="width:100%">' + I('merge') + ' لدي نسخة احتياطية — استعادتها</button>',
      '<p class="auth-note">كل البيانات تُحفظ على هذا الجهاز فقط، ولا تخرج إلا في حزمة أو نسخة احتياطية تصدّرها بنفسك.</p>');
    M.bio.available().then(function (ok) { if (ok) M.qs('#su-bio-f', app).style.display = ''; });
    M.qsa('.role-pick button', app).forEach(function (b) {
      b.onclick = function () { st.role = b.dataset.r; M.qsa('.role-pick button', app).forEach(function (x) { x.classList.toggle('on', x === b); }); M.qs('#su-center-f').style.display = st.role === 'admin' ? '' : 'none'; };
    });
    M.qs('#su-go').onclick = function () {
      var name = M.qs('#su-name').value.trim();
      if (!name) { M.toast('اكتب اسمك أولاً', 'bad'); M.qs('#su-name').focus(); return; }
      var pin = M.toWestern(M.qs('#su-pin').value.trim());
      if (pin && !/^\d{4,}$/.test(pin)) { M.toast('رمز الدخول أرقام فقط (٤ على الأقل)', 'bad'); return; }
      var wantBio = M.qs('#su-bio').checked;
      if (wantBio && !pin) { M.toast('اختر رمز دخول احتياطياً مع البصمة', 'bad'); M.qs('#su-pin').focus(); return; }
      var center = Object.assign({}, S.settings.center, { name: M.qs('#su-center').value.trim() || S.settings.center.name });
      Promise.all([M.setSetting('user', { name: name, role: st.role, pin: pin }), M.setSetting('center', center)]).then(function () {
        return wantBio ? M.bio.enroll().catch(function (e) { M.toast('لم تُفعّل البصمة: ' + (e.message || e) + ' — يمكنك تفعيلها لاحقاً من الإعدادات', 'bad'); }) : null;
      }).then(function () { return M.setSetting('setupDone', true); }).then(function () {
        M.log('إعداد الجهاز', name, M.ROLES[st.role]);
        M.sound && M.sound('done');
        location.hash = '#/home'; M.render();
      });
    };
    M.qs('#su-restore').onclick = function () { M.restoreFlow(); };
  };

  /* ===== شاشة القفل ===== */
  M.views.lock = function (app) {
    var me = M.me(), hasPin = !!me.pin, hasBio = M.bio.enabled();
    var h = new Date().getHours(), greet = h < 12 ? 'صباح الخير' : 'مساء الخير';
    app.innerHTML = authShell(
      '<div class="lock-id"><div class="lock-av">' + esc((me.name || '؟').trim().charAt(0)) + '</div><div><span class="muted small">' + greet + '</span><h2>' + esc(me.name || '') + '</h2><span class="chip">' + esc(M.ROLES[M.role()] || '') + '</span></div></div>' +
      (hasBio ? '<button type="button" class="bio-btn" id="lk-bio" aria-label="الدخول بالبصمة"><span class="ring"></span>' + I('finger', 44) + '<b>المس للدخول بالبصمة</b></button>' : '') +
      (hasPin ? '<div class="field' + (hasBio ? ' lk-pin-alt' : '') + '"><label for="lk">' + (hasBio ? 'أو أدخل رمز الدخول' : 'رمز الدخول') + '</label><input id="lk" class="inp lg pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••"></div>' +
        '<button class="btn pri lg" id="lk-go" style="width:100%">دخول</button>' : ''));
    var open = function () { M._locked = false; M.sound && M.sound('success'); M.render(); };
    var tryBio = function () {
      var b = M.qs('#lk-bio', app); if (!b) return;
      b.classList.add('busy');
      M.bio.verify().then(open).catch(function (e) {
        b.classList.remove('busy');
        if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') M.toast('تعذّر التحقق بالبصمة — استخدم رمز الدخول', 'bad');
        var p = M.qs('#lk', app); if (p) p.focus();
      });
    };
    var go = function () {
      if (M.toWestern(M.qs('#lk').value.trim()) === String(me.pin)) open();
      else { M.toast('الرمز غير صحيح', 'bad'); M.qs('#lk').value = ''; var c = M.qs('.auth-card', app); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
    };
    var lb = M.qs('#lk-bio', app); if (lb) lb.onclick = tryBio;
    var lg = M.qs('#lk-go', app); if (lg) lg.onclick = go;
    var lk = M.qs('#lk', app); if (lk) { lk.onkeydown = function (e) { if (e.key === 'Enter') go(); }; lk.oninput = function () { var v = M.toWestern(lk.value); if (me.pin && v.length === String(me.pin).length && v === String(me.pin)) open(); }; }
    if (!hasPin && !hasBio) { open(); return; }
    if (hasBio) setTimeout(tryBio, 350); else setTimeout(function () { if (lk) lk.focus(); }, 30);
  };

  /* ===== بطاقة الأمان في الإعدادات ===== */
  M.securityCardHTML = function () {
    var on = M.bio.enabled();
    return '<div class="card" id="sec-card"><h2 style="margin-bottom:6px">الأمان والدخول</h2><p class="small muted" style="margin:0 0 12px">قفل التطبيق برمز دخول أو ببصمة الإصبع/الوجه. يُقفل تلقائياً بعد ٥ دقائق في الخلفية.</p>' +
      '<div class="row"><span class="bio-ic">' + I('finger', 22) + '</span><div style="flex:1;min-width:200px"><b>الدخول بالبصمة</b><div class="small muted" id="sec-bio-st">' + (on ? 'مفعّل على هذا الجهاز' : 'غير مفعّل') + '</div></div>' +
      (on ? '<button class="btn" id="sec-bio-off">إيقاف</button>' : '<button class="btn pri" id="sec-bio-on">تفعيل البصمة</button>') +
      (M.lockEnabled() ? '<button class="btn" id="sec-lock">' + I('lock', 16) + ' قفل الآن</button>' : '') + '</div></div>';
  };
  M.bindSecurity = function (root) {
    var on = M.qs('#sec-bio-on', root);
    if (on) {
      M.bio.available().then(function (ok) { if (!ok) { on.disabled = true; M.qs('#sec-bio-st', root).textContent = M.bio.supported() ? 'هذا الجهاز لا يدعم البصمة في المتصفح' : 'البصمة تعمل من رابط التطبيق (https) وليس من ملف محلي'; } });
      on.onclick = function () {
        if (!M.me().pin) return M.toast('اختر رمز دخول احتياطياً أولاً (المستخدم والجهاز) ثم احفظ', 'bad');
        M.bio.enroll().then(function () { M.toast('تم تفعيل الدخول بالبصمة', 'ok'); M.render(); }).catch(function (e) { M.toast('لم تُفعّل البصمة: ' + (e.message || e), 'bad'); });
      };
    }
    var off = M.qs('#sec-bio-off', root); if (off) off.onclick = function () { M.bio.disable().then(function () { M.toast('أُوقفت البصمة'); M.render(); }); };
    var lk = M.qs('#sec-lock', root); if (lk) lk.onclick = function () { M._locked = true; M.render(); };
  };
})(window.M);
