/* الهيكل العام والتوجيه والشاشات العامة */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;
  M.views = {};

  /* ===== التوجيه ===== */
  M.route = function () {
    var h = location.hash.replace(/^#/, '') || '/';
    var parts = h.split('?');
    var path = parts[0].split('/').filter(Boolean);
    var q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { name: path[0] || 'home', id: path[1] || '', q: q };
  };
  M.go = function (hash) { if (location.hash === hash) M.render(); else location.hash = hash; };
  M.link = function (name, id, q) {
    var s = '#/' + name + (id ? '/' + id : '');
    var qs = Object.keys(q || {}).filter(function (k) { return q[k] != null && q[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    return s + (qs ? '?' + qs : '');
  };

  function navItems() {
    var r = M.role(), pend = M.pendingReview().length;
    var items = [
      { k: 'home', label: 'الرئيسية', icon: 'home' },
      { k: 'bank', label: 'بنك الأسئلة', icon: 'bank' },
      { k: 'exams', label: 'الامتحانات', icon: 'exam' }
    ];
    if (r !== 'teacher') items.push({ k: 'review', label: 'المراجعة والاعتماد', icon: 'review', cnt: pend });
    items.push(r === 'admin' ? { k: 'merge', label: 'تجميع الحزم', icon: 'merge' } : { k: 'merge', label: 'إرسال للأدمن', icon: 'send' });
    items.push({ k: 'cloud', label: 'الأونلاين والإشعارات', icon: 'spark' });
    items.push({ k: 'docs', label: 'وثائق الجودة', icon: 'docs' });
    items.push({ k: 'settings', label: 'الإعدادات', icon: 'settings' });
    return items;
  }

  function shell(active) {
    var me = M.me();
    var items = navItems();
    var nav = items.map(function (it) {
      return '<a href="#/' + it.k + '" class="' + (it.k === active ? 'on' : '') + '">' + I(it.icon) + '<span>' + it.label + '</span>' + (it.cnt ? '<span class="cnt">' + n(it.cnt) + '</span>' : '') + '</a>';
    }).join('');
    var mob = items.filter(function (it) { return ['home', 'bank', 'exams', 'cloud', 'settings'].indexOf(it.k) >= 0; }).map(function (it) {
      return '<a href="#/' + it.k + '" class="' + (it.k === active ? 'on' : '') + '">' + I(it.icon, 22) + '<span>' + (it.k === 'cloud' ? 'الأونلاين' : it.label.split(' ')[0]) + '</span></a>';
    }).join('');
    return '<div class="app"><aside class="side"><div class="brand"><div class="brand-mark">' + I('exam', 20) + '</div><div><b>معيار</b><span>بنك الأسئلة والامتحانات</span></div></div>' +
      '<nav class="nav" aria-label="القائمة الرئيسية">' + nav + '</nav>' +
      '<div class="side-foot"><div class="avatar">' + esc((me.name || '؟').trim().charAt(0)) + '</div><div style="min-width:0"><div class="bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(me.name || '') + '</div><div class="small muted">' + esc(M.ROLES[M.role()]) + ' · <span class="p-code">v' + esc(M.VERSION) + '</span></div></div><a href="#/cloud" id="cloud-dot" class="cloud-dot ' + ((M.cloud && M.cloud.status) || 'off') + '" title="' + esc(M.cloud && M.cloud.statusLabel ? M.cloud.statusLabel() : '') + '" aria-label="حالة الأونلاين"></a></div></aside>' +
      '<div class="main" id="main"></div><nav class="mnav" aria-label="التنقل">' + mob + '</nav></div>';
  }

  var current = null;
  M.render = function () {
    var r = M.route();
    var app = document.getElementById('app');
    if (!app) return;
    if (!S.settings.setupDone) { app.innerHTML = ''; return M.views.setup(app); }
    if (M._locked) { return M.views.lock(app); }
    var view = M.views[r.name] || M.views.home;
    var activeKey = { q: 'bank', lesson: 'bank', exam: 'exams', gen: 'exams' }[r.name] || r.name;
    app.innerHTML = shell(activeKey);
    var main = document.getElementById('main');
    if (current && current.destroy) current.destroy();
    current = null;
    try { current = view(main, r) || null; }
    catch (e) { console.error(e); main.innerHTML = '<div class="content"><div class="alert bad">' + I('warn') + '<div>حدث خطأ أثناء عرض الصفحة: ' + esc(e.message) + '</div></div></div>'; }
    window.scrollTo(0, 0);
  };
  M.refreshNav = function () {
    var r = M.route();
    var nav = M.qs('.nav'); if (!nav) return;
    var activeKey = { q: 'bank', lesson: 'bank', exam: 'exams', gen: 'exams' }[r.name] || r.name;
    var tmp = document.createElement('div'); tmp.innerHTML = shell(activeKey);
    nav.innerHTML = tmp.querySelector('.nav').innerHTML;
  };

  M.topbar = function (title, sub, actions, back) {
    return '<header class="topbar">' + (back ? '<a class="btn icon ghost" href="' + back + '" aria-label="رجوع">' + I('back') + '</a>' : '') +
      '<div style="min-width:0"><h1>' + title + '</h1>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div><div class="grow"></div>' +
      '<div class="row" style="gap:8px">' + (actions || '') + '</div></header>';
  };

  M.statusChip = function (st) { var s = M.STATUS[st] || M.STATUS.draft; return '<span class="chip ' + s.cls + '">' + s.label + '</span>'; };
  M.typeChip = function (t) { return '<span class="chip type">' + esc((M.TYPE[t] || {}).label || t) + '</span>'; };

  /* ===== الإعداد الأول ===== */
  M.views.setup = function (app) {
    var st = { role: 'teacher' };
    app.innerHTML = '<div class="setup"><div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px">' +
      '<div class="brand" style="padding:0;border:0"><div class="brand-mark">' + I('exam', 20) + '</div><div><b>مرحباً بك في معيار</b><span>بنك الأسئلة وتصميم الامتحانات — يعمل بدون إنترنت</span></div></div>' +
      '<div class="field"><label for="su-name">اسمك</label><input id="su-name" class="inp" placeholder="مثال: أ. محمد علي" autocomplete="name"></div>' +
      '<div class="field"><span class="lbl">دورك على هذا الجهاز</span><div class="role-pick">' +
      '<button type="button" data-r="teacher" class="on">' + I('edit', 22) + 'مدرس<small>يبني بنك أسئلة مادته ويرسله</small></button>' +
      '<button type="button" data-r="head">' + I('review', 22) + 'رئيس قسم<small>يراجع ويعتمد الأسئلة</small></button>' +
      '<button type="button" data-r="admin">' + I('merge', 22) + 'مدير النظام<small>يجمع ويصدّر ويدير الجودة</small></button></div></div>' +
      '<div class="field" id="su-center-f" style="display:none"><label for="su-center">اسم مركز التدريب / المدرسة</label><input id="su-center" class="inp"></div>' +
      '<div class="field"><label for="su-pin">رمز دخول (اختياري — ٤ أرقام أو أكثر)</label><input id="su-pin" class="inp" inputmode="numeric" type="password" autocomplete="new-password"></div>' +
      '<div class="row"><button class="btn pri" id="su-go">ابدأ</button><button class="btn" id="su-restore">' + I('merge') + ' استعادة نسخة احتياطية</button></div>' +
      '<p class="small muted" style="margin:0">كل البيانات تُحفظ على هذا الجهاز فقط، ولا تخرج إلا في حزمة أو نسخة احتياطية تصدّرها بنفسك.</p></div></div>';
    M.qsa('.role-pick button', app).forEach(function (b) {
      b.onclick = function () { st.role = b.dataset.r; M.qsa('.role-pick button', app).forEach(function (x) { x.classList.toggle('on', x === b); }); M.qs('#su-center-f').style.display = st.role === 'admin' ? '' : 'none'; };
    });
    M.qs('#su-go').onclick = function () {
      var name = M.qs('#su-name').value.trim();
      if (!name) { M.toast('اكتب اسمك أولاً', 'bad'); M.qs('#su-name').focus(); return; }
      var pin = M.toWestern(M.qs('#su-pin').value.trim());
      if (pin && !/^\d{4,}$/.test(pin)) { M.toast('رمز الدخول أرقام فقط (٤ على الأقل)', 'bad'); return; }
      var center = Object.assign({}, S.settings.center, { name: M.qs('#su-center').value.trim() || S.settings.center.name });
      Promise.all([M.setSetting('user', { name: name, role: st.role, pin: pin }), M.setSetting('center', center), M.setSetting('setupDone', true)]).then(function () {
        M.log('إعداد الجهاز', name, M.ROLES[st.role]);
        location.hash = '#/home'; M.render();
      });
    };
    M.qs('#su-restore').onclick = function () { M.restoreFlow(); };
  };

  M.views.lock = function (app) {
    app.innerHTML = '<div class="setup"><div class="card" style="padding:24px;display:flex;flex-direction:column;gap:14px;max-width:380px;margin:auto">' +
      '<div class="row">' + I('lock', 22) + '<h2>معيار — ' + esc(M.me().name || '') + '</h2></div>' +
      '<div class="field"><label for="lk">رمز الدخول</label><input id="lk" class="inp" type="password" inputmode="numeric" autocomplete="current-password"></div>' +
      '<button class="btn pri" id="lk-go">دخول</button></div></div>';
    var go = function () {
      if (M.toWestern(M.qs('#lk').value.trim()) === String(M.me().pin)) { M._locked = false; M.render(); }
      else { M.toast('الرمز غير صحيح', 'bad'); M.qs('#lk').value = ''; }
    };
    M.qs('#lk-go').onclick = go;
    M.qs('#lk').onkeydown = function (e) { if (e.key === 'Enter') go(); };
    setTimeout(function () { M.qs('#lk').focus(); }, 30);
  };

  M.restoreFlow = function () {
    M.pickFile('.miyar,.json').then(function (files) {
      if (!files[0]) return;
      return M.readFile(files[0]).then(M.parsePack).then(function (p) {
        if (!p.intact) M.toast('تنبيه: بصمة الملف لا تطابق محتواه — قد يكون تالفاً أو معدّلاً', 'bad');
        return M.confirm('استعادة نسخة احتياطية', 'سيتم استبدال كل بيانات هذا الجهاز بمحتوى النسخة (' + M.fmtDate(p.createdAt, true) + ' — ' + ((p.from && p.from.name) || '') + '). هل تريد المتابعة؟', 'استعادة', true).then(function (ok) {
          if (!ok) return;
          return (M.snapshot ? M.snapshot('قبل استعادة نسخة احتياطية').catch(function () {}) : Promise.resolve()).then(function () { return M.restore(p); }).then(function () { return M.load(); }).then(function () { M.toast('تمت الاستعادة', 'ok'); location.hash = '#/home'; M.render(); });
        });
      });
    }).catch(function (e) { M.toast(e.message, 'bad'); });
  };

  /* ===== الرئيسية ===== */
  M.views.home = function (main) {
    var me = M.me(), qs = S.questions.filter(function (q) { return q.status !== 'archived'; });
    var cnt = function (st) { return qs.filter(function (q) { return q.status === st; }).length; };
    var lastB = S.settings.lastBackupAt, days = lastB ? (Date.now() - new Date(lastB)) / 864e5 : 999;
    var subjects = S.subjects.slice().sort(function (a, b) { return String(a.name).localeCompare(b.name, 'ar'); });
    var subjRows = subjects.map(function (s) {
      var sq = qs.filter(function (q) { return q.subjectId === s.id; }), ap = sq.filter(function (q) { return q.status === 'approved'; }).length;
      var target = Number(s.target) || 0, pct = target ? Math.min(100, Math.round(ap / target * 100)) : 0;
      return '<tr><td><a href="' + M.link('bank', '', { s: s.id }) + '">' + esc(s.name) + '</a><div class="small muted">' + esc(s.className || '') + '</div></td><td>' + n(sq.length) + '</td><td>' + n(ap) + '</td>' +
        '<td style="min-width:160px">' + (target ? '<div class="bar"><i class="' + (pct < 60 ? 'w' : '') + '" style="width:' + pct + '%"></i></div><div class="small muted">' + n(ap) + ' من ' + n(target) + '</div>' : '<span class="small muted">بدون مستهدف</span>') + '</td></tr>';
    }).join('');
    var recent = S.log.slice(0, 8).map(function (e) { return '<tr><td class="small muted" style="white-space:nowrap">' + n(M.fmtDate(e.at, true)) + '</td><td>' + esc(e.action) + '</td><td>' + esc(e.target) + '</td><td class="small muted">' + esc(e.by) + '</td></tr>'; }).join('');
    main.innerHTML = M.topbar('أهلاً، ' + esc(me.name || ''), esc(M.ROLES[M.role()]) + (S.settings.center.name ? ' · ' + esc(S.settings.center.name) : ''),
      '<a class="btn" href="#/bank">' + I('plus') + ' سؤال جديد</a><a class="btn pri" href="#/gen">' + I('spark') + ' توليد نماذج استرشادية</a>') +
      '<div class="content">' + (M.cloud && M.cloud.ready && !M.cloud.user ? '<div class="alert info">' + I('spark') + '<div style="flex:1">الخادم الأونلاين جاهز — سجّل الدخول لمزامنة عملك لحظياً مع باقي الأجهزة وتلقي الإشعارات الفورية.</div><a class="btn sm" href="#/cloud">تسجيل الدخول</a></div>' : '') + M.safetyBanner() + '<div id="h-folderbar"></div>' +
      (!M.db.persistent() ? '<div class="alert bad">' + I('warn') + '<div>المتصفح لا يسمح بالحفظ الدائم في هذا الوضع (مثل التصفح الخاص) — البيانات ستضيع عند الإغلاق.</div></div>' : '') +
      (days > 7 && S.questions.length ? '<div class="alert warn">' + I('warn') + '<div style="flex:1">' + (lastB ? 'آخر نسخة احتياطية منذ ' + n(Math.floor(days)) + ' يوماً.' : 'لم تُؤخذ نسخة احتياطية بعد.') + ' خذ نسخة الآن واحفظها خارج الجهاز.</div><button class="btn sm" id="h-backup">نسخة احتياطية</button></div>' : '') +
      '<div class="grid4">' +
      '<div class="card stat"><span class="small muted">إجمالي الأسئلة</span><b>' + n(qs.length) + '</b></div>' +
      '<div class="card stat"><span class="small muted">معتمد</span><b style="color:var(--accent-d)">' + n(cnt('approved')) + '</b></div>' +
      '<div class="card stat"><span class="small muted">قيد المراجعة</span><b style="color:var(--info)">' + n(cnt('review')) + '</b></div>' +
      '<div class="card stat"><span class="small muted">مسودة / مُعاد</span><b style="color:var(--warn)">' + n(cnt('draft') + cnt('returned')) + '</b></div></div>' +
      '<div class="split"><div class="body" style="flex:999 1 520px">' +
      '<div class="card flat"><div class="card-h" style="padding:14px 16px 0"><h2 class="grow">المواد</h2><button class="btn sm" id="h-addsub">' + I('plus') + ' مادة</button></div>' +
      (subjects.length ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>المادة</th><th>الأسئلة</th><th>المعتمد</th><th>اكتمال البنك</th></tr></thead><tbody>' + subjRows + '</tbody></table></div>'
        : '<div style="padding:16px"><div class="empty">ابدأ بإضافة مادتك، ثم الوحدات والدروس ونواتج التعلم، ثم الأسئلة.</div></div>') + '</div></div>' +
      '<div class="aside" style="flex:1 1 380px"><div class="card flat"><div style="padding:14px 16px"><h2>آخر النشاط</h2></div>' +
      (recent ? '<div class="scroll-x"><table class="tbl"><tbody>' + recent + '</tbody></table></div>' : '<div style="padding:0 16px 16px" class="muted small">لا يوجد نشاط بعد.</div>') + '</div></div></div></div>';
    var hb = M.qs('#h-backup', main); if (hb) hb.onclick = function () { M.backup(); };
    M.bindSafety(main);
    M.folderReconnectBar().then(function (h) { var fb = M.qs('#h-folderbar', main); if (fb && h) { fb.innerHTML = h; M.bindSafety(fb); } });
    M.qs('#h-addsub', main).onclick = function () { M.editSubject(null); };
  };

  /* نافذة المادة */
  M.editSubject = function (s) {
    var isNew = !s; s = s || { name: '', className: '', specialization: '', target: '' };
    M.modal({
      title: isNew ? 'مادة جديدة' : 'تعديل المادة',
      body: '<div class="field"><label for="sb-n">اسم المادة</label><input id="sb-n" class="inp" value="' + esc(s.name) + '"></div>' +
        '<div class="grid2"><div class="field"><label for="sb-c">الصف</label><input id="sb-c" class="inp" placeholder="الصف الأول" value="' + esc(s.className) + '"></div>' +
        '<div class="field"><label for="sb-sp">التخصص / الشعبة</label><input id="sb-sp" class="inp" value="' + esc(s.specialization || '') + '"></div></div>' +
        '<div class="field"><label for="sb-t">العدد المستهدف من الأسئلة المعتمدة</label><input id="sb-t" class="inp" inputmode="numeric" value="' + esc(s.target || '') + '"></div>',
      foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qs('[data-ok]', m).onclick = function () {
          var nm = M.qs('#sb-n', m).value.trim(); if (!nm) { M.toast('اكتب اسم المادة', 'bad'); return; }
          s.name = nm; s.className = M.qs('#sb-c', m).value.trim(); s.specialization = M.qs('#sb-sp', m).value.trim();
          s.target = Number(M.toWestern(M.qs('#sb-t', m).value)) || '';
          M.save('subjects', s).then(function () { close(); M.toast('تم الحفظ', 'ok'); M.go(M.link('bank', '', { s: s.id })); });
        };
      }
    });
  };

  /* ===== الإعدادات ===== */
  M.views.settings = function (main) {
    var st = S.settings, cen = st.center || {}, me = M.me(), admin = M.can('center');
    var t = st.levelTargets || [30, 40, 20, 10];
    main.innerHTML = M.topbar('الإعدادات', 'الإصدار ' + n(M.VERSION)) + '<div class="content">' +
      '<div class="row mob-only"><a class="btn" href="#/merge">' + I(M.role() === 'admin' ? 'merge' : 'send') + ' ' + (M.role() === 'admin' ? 'تجميع الحزم' : 'إرسال حزمة للأدمن') + '</a><a class="btn" href="#/docs">' + I('docs') + ' وثائق الجودة</a>' + (M.role() !== 'teacher' ? '<a class="btn" href="#/review">' + I('review') + ' المراجعة</a>' : '') + '</div>' +
      '<div class="card"><div class="card-h"><h2 class="grow">الإصدار والتحديثات</h2><span class="chip ok">الإصدار <span class="p-code">' + esc(M.VERSION) + '</span></span></div>' +
      '<div class="small muted" style="margin-bottom:10px">التحديثات إجبارية: عند نشر إصدار جديد يظهر تنبيه صوتي ونافذة تحديث فوراً عند فتح التطبيق أو أثناء استخدامه (يُفحص كل ٣ دقائق)، ومع تفعيل الإشعارات يصلك إشعار حتى والتطبيق مغلق.' + (st.lastUpdateCheck ? ' آخر فحص: ' + n(M.fmtDate(st.lastUpdateCheck, true)) : '') + '</div>' +
      '<div class="row"><button class="btn" id="st-chk">' + I('download') + ' فحص التحديثات الآن</button><button class="btn" id="st-ntf">' + I('spark') + ' ' + (('Notification' in window) && Notification.permission === 'granted' ? 'الإشعارات مفعّلة — إعادة التفعيل' : 'تفعيل إشعارات التحديث') + '</button><button class="btn" id="st-snd">اختبار صوت التنبيه</button></div>' +
      '<details style="margin-top:10px"><summary class="bold" style="cursor:pointer">سجل الإصدارات</summary>' + M.changelogHTML() + '</details></div>' +
      '<div id="st-safety"></div>' +
      M.aiSettingsHTML() +
      '<div class="card"><h2 style="margin-bottom:6px">الأصوات والتنبيهات</h2><p class="small muted" style="margin:0 0 10px">صوت مميز لكل مرحلة: الحفظ، والإرسال للمراجعة، والاعتماد، والإعادة بملاحظة، والأخطاء، واكتمال المهام الطويلة (التوليد والتصدير)، ووصول الإشعارات. صوت التحديث الإجباري يعمل دائماً.</p>' +
      '<div class="row"><label class="check"><input type="checkbox" id="snd-on"' + (st.soundOn !== false ? ' checked' : '') + '> تشغيل الأصوات</label><label class="small">مستوى الصوت <input type="range" id="snd-vol" min="0.05" max="0.8" step="0.05" value="' + (st.soundVol == null ? 0.3 : st.soundVol) + '"></label></div>' +
      '<div class="row" style="gap:6px;margin-top:8px">' + Object.keys(M.SOUND_LABELS).map(function (k) { return '<button class="btn sm" data-sndt="' + k + '">▶ ' + M.SOUND_LABELS[k] + '</button>'; }).join('') + '</div>' +
      (M.canInstall() ? '<div class="row" style="margin-top:12px"><button class="btn pri" id="st-install">' + I('download') + ' تثبيت التطبيق على هذا الجهاز</button></div>' : (M.isStandalone() ? '<div class="small muted" style="margin-top:10px">✓ التطبيق مثبت على هذا الجهاز.</div>' : '')) + '</div>' +
      '<div class="card"><div class="card-h"><h2 class="grow">بيانات المركز (تظهر في ترويسة كل المخرجات)</h2>' + (admin ? '' : '<span class="chip">يعدّلها مدير النظام</span>') + '</div>' +
      '<div class="row" style="align-items:flex-start">' +
      '<div style="display:flex;flex-direction:column;gap:8px;align-items:center"><div class="p-logo' + (cen.logo ? ' has' : '') + '" id="st-logo" style="width:90px;height:90px">' + (cen.logo ? '<img src="' + cen.logo + '" alt="الشعار">' : 'لا يوجد شعار') + '</div>' +
      (admin ? '<div class="row" style="gap:6px"><button class="btn sm" id="st-logo-up">رفع الشعار</button>' + (cen.logo ? '<button class="btn sm danger" id="st-logo-rm">إزالة</button>' : '') + '</div>' : '') + '</div>' +
      '<div style="flex:1;min-width:260px;display:flex;flex-direction:column;gap:10px">' +
      '<div class="field"><label for="st-cn">اسم مركز التدريب / المدرسة</label><input id="st-cn" class="inp" ' + (admin ? '' : 'disabled') + ' value="' + esc(cen.name || '') + '"></div>' +
      '<div class="grid2"><div class="field"><label for="st-cd">المديرية / الإدارة</label><input id="st-cd" class="inp" ' + (admin ? '' : 'disabled') + ' value="' + esc(cen.directorate || '') + '"></div>' +
      '<div class="field"><label for="st-ca">العنوان / الهاتف</label><input id="st-ca" class="inp" ' + (admin ? '' : 'disabled') + ' value="' + esc(cen.address || '') + '"></div></div>' +
      '<div class="field"><label for="st-y">العام الدراسي</label><input id="st-y" class="inp" value="' + esc(st.year || '') + '"></div>' +
      '</div></div></div>' +
      '<div class="card"><h2 style="margin-bottom:12px">المستخدم والجهاز</h2><div class="grid3">' +
      '<div class="field"><label for="st-un">الاسم</label><input id="st-un" class="inp" value="' + esc(me.name || '') + '"></div>' +
      '<div class="field"><label for="st-ur">الدور</label><select id="st-ur" class="inp">' + Object.keys(M.ROLES).map(function (k) { return '<option value="' + k + '"' + (k === me.role ? ' selected' : '') + '>' + M.ROLES[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="st-up">رمز الدخول (اتركه فارغاً لإلغائه)</label><input id="st-up" class="inp" type="password" inputmode="numeric" value="' + esc(me.pin || '') + '" autocomplete="new-password"></div></div>' +
      '<div class="small muted" style="margin-top:8px">معرّف الجهاز: <span class="p-code">' + esc(st.deviceId) + '</span></div></div>' +
      '<div class="card"><h2 style="margin-bottom:12px">الافتراضيات التربوية</h2><div class="grid2">' +
      '<div class="field"><span class="lbl">شكل الأرقام الافتراضي في الورقة</span><div class="seg" id="st-dg"><button type="button" data-v="arabic" class="' + (st.digits !== 'english' ? 'on' : '') + '">هندية ١٢٣</button><button type="button" data-v="english" class="' + (st.digits === 'english' ? 'on' : '') + '">إنجليزية 123</button></div></div>' +
      '<div class="field"><span class="lbl">النسب المستهدفة للمستويات المعرفية (٪) — المجموع ١٠٠</span><div class="grid4">' +
      M.LEVELS.map(function (l, i) { return '<div class="field"><label for="st-l' + i + '" class="small">' + l + '</label><input id="st-l' + i + '" class="inp" inputmode="numeric" value="' + n(t[i]) + '"></div>'; }).join('') + '</div></div></div></div>' +
      '<div class="row"><button class="btn pri" id="st-save">' + I('check') + ' حفظ الإعدادات</button></div>' +
      '<div class="card"><h2 style="margin-bottom:6px">النسخ الاحتياطي</h2><p class="small muted" style="margin:0 0 12px">النسخة الاحتياطية ملف واحد فيه كل بيانات الجهاز. احفظه على فلاشة أو Drive. آخر نسخة: ' + (st.lastBackupAt ? n(M.fmtDate(st.lastBackupAt, true)) : 'لم تُؤخذ بعد') + '</p>' +
      '<div class="row"><button class="btn" id="st-bk">' + I('download') + ' أخذ نسخة احتياطية</button><button class="btn" id="st-rs">' + I('merge') + ' استعادة نسخة</button><button class="btn" id="st-xl">' + I('download') + ' تصدير البنك كاملاً Excel</button></div></div>' +
      '<div class="card flat"><div style="padding:14px 16px"><h2>سجل النشاط</h2><div class="small muted">سجل لا يُحذف: من فعل ماذا ومتى — دليل للمراجعة الداخلية</div></div><div class="scroll-x" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>العنصر</th><th>تفاصيل</th></tr></thead><tbody>' +
      S.log.slice(0, 300).map(function (e) { return '<tr><td class="small" style="white-space:nowrap">' + n(M.fmtDate(e.at, true)) + '</td><td>' + esc(e.by) + '<div class="small muted">' + esc(M.ROLES[e.role] || '') + '</div></td><td>' + esc(e.action) + '</td><td>' + esc(e.target) + '</td><td class="small muted">' + esc(e.detail) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="card"><h2 style="margin-bottom:6px;color:var(--bad)">منطقة الخطر</h2><p class="small muted" style="margin:0 0 12px">مسح كل البيانات من هذا الجهاز. خذ نسخة احتياطية أولاً.</p><button class="btn danger" id="st-wipe">' + I('trash') + ' مسح كل البيانات</button></div>' +
      '</div>';
    var digits = st.digits || 'arabic';
    M.qsa('#st-dg button', main).forEach(function (b) { b.onclick = function () { digits = b.dataset.v; M.qsa('#st-dg button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    if (admin) {
      M.qs('#st-logo-up', main).onclick = function () {
        M.pickFile('image/*').then(function (f) { if (!f[0]) return; return M.readFile(f[0], 'dataurl').then(function (d) { return M.shrinkImage(d, 400); }).then(function (d) { return M.setSetting('center', Object.assign({}, S.settings.center, { logo: d })); }).then(function () { M.render(); }); });
      };
      var rm = M.qs('#st-logo-rm', main); if (rm) rm.onclick = function () { M.setSetting('center', Object.assign({}, S.settings.center, { logo: '' })).then(M.render); };
    }
    M.qs('#st-save', main).onclick = function () {
      var lv = [0, 1, 2, 3].map(function (i) { return Number(M.toWestern(M.qs('#st-l' + i, main).value)) || 0; });
      if (lv.reduce(function (a, b) { return a + b; }, 0) !== 100) { M.toast('مجموع النسب يجب أن يساوي ١٠٠', 'bad'); return; }
      var pin = M.toWestern(M.qs('#st-up', main).value.trim());
      if (pin && !/^\d{4,}$/.test(pin)) { M.toast('رمز الدخول أرقام فقط (٤ على الأقل)', 'bad'); return; }
      var name = M.qs('#st-un', main).value.trim(); if (!name) { M.toast('الاسم مطلوب', 'bad'); return; }
      var newRole = M.qs('#st-ur', main).value;
      var jobs = [M.setSetting('user', { name: name, role: newRole, pin: pin }), M.setSetting('digits', digits), M.setSetting('levelTargets', lv), M.setSetting('year', M.qs('#st-y', main).value.trim())];
      if (admin) jobs.push(M.setSetting('center', Object.assign({}, S.settings.center, { name: M.qs('#st-cn', main).value.trim(), directorate: M.qs('#st-cd', main).value.trim(), address: M.qs('#st-ca', main).value.trim() })));
      if (newRole !== me.role) M.log('تغيير الدور', name, M.ROLES[me.role] + ' ← ' + M.ROLES[newRole]);
      Promise.all(jobs).then(function () { M.toast('تم حفظ الإعدادات', 'ok'); M.render(); });
    };
    M.bindAISettings(main);
    M.qs('#snd-on', main).onchange = function (e) { M.setSetting('soundOn', e.target.checked); if (e.target.checked) M.sound('success', true); };
    M.qs('#snd-vol', main).onchange = function (e) { M.setSetting('soundVol', Number(e.target.value)).then(function () { M.sound('notify', true); }); };
    M.qsa('[data-sndt]', main).forEach(function (b) { b.onclick = function () { M.sound(b.dataset.sndt, true); }; });
    var ins = M.qs('#st-install', main); if (ins) ins.onclick = function () { M.offerInstall(true); };
    M.qs('#st-chk', main).onclick = function () { M.checkUpdate(true); };
    M.qs('#st-ntf', main).onclick = function () { M.enableUpdateNotifications().then(function () { M.render(); }); };
    M.qs('#st-snd', main).onclick = function () { M.chime(); };
    Promise.all([M.storageInfo(), M.folderState(), M.listSnapshots()]).then(function (r) {
      var box = M.qs('#st-safety', main); if (!box) return;
      box.innerHTML = M.safetySettingsHTML(r[0], r[1], r[2]); M.bindSafetySettings(box, r[2]);
    });
    M.qs('#st-bk', main).onclick = function () { M.backup().then(function () { M.toast('تم تنزيل النسخة الاحتياطية', 'ok'); }); };
    M.qs('#st-rs', main).onclick = M.restoreFlow;
    M.qs('#st-xl', main).onclick = function () { M.exportBankExcel(S.questions.filter(function (q) { return q.status !== 'archived'; }), 'بنك-الأسئلة-كاملاً'); };
    M.qs('#st-wipe', main).onclick = function () {
      M.confirm('مسح كل البيانات', 'سيتم حذف كل المواد والأسئلة والامتحانات والوثائق من هذا الجهاز نهائياً.', 'مسح نهائي', true).then(function (ok) {
        if (!ok) return;
        Promise.all(['settings'].concat(M.STORES).map(function (s) { return M.db.clear(s); })).then(function () { location.hash = ''; location.reload(); });
      });
    };
  };

  /* ===== التشغيل ===== */
  M.start = function () {
    M.load().then(function () {
      if (M.me().pin) M._locked = true;
      window.addEventListener('hashchange', M.render);
      M.render();
      M.ensurePersist();
      M.startUpdates();
      if (M.cloud) M.cloud.init().then(function () { M.refreshNav(); var r = M.route(); if (r.name === 'cloud' || r.name === 'home') M.render(); });
      if (S.settings.setupDone) M.afterUpdateNotice(); else M.setSetting('lastSeenVersion', M.VERSION);
    }).catch(function (e) {
      document.getElementById('app').innerHTML = '<div class="setup"><div class="alert bad">تعذّر فتح قاعدة البيانات: ' + esc(e.message) + '</div></div>';
    });
  };
})(window.M);
