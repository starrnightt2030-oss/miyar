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

  /* الإصدار ٢٫٢: مكتبتا الأسئلة (المستخرجة والمولدة) — بنك الإصدار الأول القديم يبقى محفوظاً ومخفياً */
  function navItems() {
    return [
      { k: 'home', label: 'الرئيسية', icon: 'home' },
      { k: 'exams', label: 'امتحاناتي', icon: 'exam' },
      { k: 'identity', label: 'هوية المؤسسة', icon: 'grid' },
      { k: 'docs', label: 'وثائق الجودة', icon: 'docs' },
      { k: 'library', label: 'الأسئلة المستخرجة', icon: 'bank' },
      { k: 'library-ai', label: 'الأسئلة المولدة', icon: 'spark' },
      { k: 'settings', label: 'الإعدادات', icon: 'settings' }
    ];
  }
  /* توقيع المطوّر */
  M.creditHTML = function (variant) {
    return '<div class="credit' + (variant ? ' ' + variant : '') + '"><span>Designed &amp; Developed by</span><b>Mohamed-Eldawly</b></div>';
  };
  M.COMING_SOON = ['bank', 'gen', 'review', 'q', 'lesson', 'merge', 'soon'];

  function shell(active) {
    var me = M.me();
    var items = navItems();
    var nav = items.map(function (it) {
      return '<a href="#/' + it.k + '" class="' + (it.k === active ? 'on' : '') + (it.soon ? ' soon' : '') + '">' + I(it.icon) + '<span>' + it.label + '</span>' + (it.soon ? '<span class="soon-b">قريباً</span>' : '') + '</a>';
    }).join('');
    var mob = items.filter(function (it) { return ['home', 'exams', 'library', 'identity', 'settings'].indexOf(it.k) >= 0; }).map(function (it) {
      return '<a href="#/' + it.k + '" class="' + (it.k === active || (it.k === 'library' && active === 'library-ai') ? 'on' : '') + '">' + I(it.icon, 22) + '<span>' + ({ home: 'الرئيسية', exams: 'امتحاناتي', library: 'المكتبة', identity: 'الهوية', settings: 'الإعدادات' })[it.k] + '</span></a>';
    }).join('');
    var cen = S.settings.center || {};
    return '<div class="app"><aside class="side"><div class="brand">' + '<img class="brand-logo" src="icons/icon-192.png" alt="Exam Studio">' + '<div><b>Exam Studio</b><span>' + esc(cen.name || 'استوديو الامتحانات') + '</span></div></div>' +
      '<nav class="nav" aria-label="القائمة الرئيسية">' + nav + '</nav>' +
      M.creditHTML('cside') + '<div class="side-foot"><div class="avatar">' + esc((me.name || '؟').trim().charAt(0)) + '</div><div style="min-width:0"><div class="bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(me.name || '') + '</div><div class="small muted">' + esc(M.ROLES[M.role()]) + ' · <span class="p-code">v' + esc(M.VERSION) + '</span></div></div><a href="#/cloud" id="cloud-dot" class="cloud-dot ' + ((M.cloud && M.cloud.status) || 'off') + '" title="' + esc(M.cloud && M.cloud.statusLabel ? M.cloud.statusLabel() : '') + '" aria-label="حالة الأونلاين"></a></div></aside>' +
      '<div class="main" id="main"></div><nav class="mnav" aria-label="التنقل">' + mob + '</nav></div>';
  }

  var current = null;
  M.render = function () {
    var r = M.route();
    var app = document.getElementById('app');
    if (!app) return;
    window.__booted = true;
    if (!S.settings.setupDone) { app.innerHTML = ''; return M.views.setup(app); }
    if (M._locked) { return M.views.lock(app); }
    if (current && current.destroy) current.destroy();
    current = null;
    /* الاستوديو بملء الشاشة بدون القائمة */
    if (r.name === 'exam' && r.id) r.name = 'studio';
    if (r.name === 'studio' && M.views.studio) {
      app.innerHTML = '';
      try { current = M.views.studio(app, r) || null; } catch (e) { console.error(e); app.innerHTML = '<div class="content"><div class="alert bad">' + I('warn') + '<div>تعذّر فتح الاستوديو: ' + esc(e.message) + '</div></div><a class="btn" href="#/exams">رجوع</a></div>'; }
      return;
    }
    var view = M.COMING_SOON.indexOf(r.name) >= 0 ? M.views.soon : (M.views[r.name] || M.views.home);
    var activeKey = M.COMING_SOON.indexOf(r.name) >= 0 ? 'soon' : r.name;
    app.innerHTML = shell(activeKey);
    var main = document.getElementById('main');
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
      '<div class="brand" style="padding:0;border:0"><div class="brand-mark">' + I('exam', 20) + '</div><div><b>مرحباً بك في Exam Studio</b><span>بنك الأسئلة وتصميم الامتحانات — يعمل بدون إنترنت</span></div></div>' +
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
      '<div class="row">' + I('lock', 22) + '<h2>Exam Studio — ' + esc(M.me().name || '') + '</h2></div>' +
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
    var hr = new Date().getHours(), greet = hr < 12 ? 'صباح الخير' : 'مساء الخير';
    var cen = S.settings.center || {};
    var exams = S.exams.slice().sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    var idDone = [!!cen.logo, !!cen.name, !!M.docFor('exam')].filter(Boolean).length;
    main.innerHTML = '<div class="content home">' +
      '<section class="hero2"><div class="h2-t"><span>' + greet + '،</span><h1>' + esc(me.name || '') + '</h1><p>صمّم امتحانك بنفسك: اختر نوع كل سؤال واكتبه، وشاهد الورقة تتنسّق أمامك لحظة بلحظة.</p>' +
      '<div class="row"><button class="btn pri lg" id="h-newexam">' + I('plus') + ' امتحان جديد</button><a class="btn lg ghost-w" href="#/extract">' + I('file') + ' استخراج أسئلة من ملف أو صور</a><a class="btn lg ghost-w" href="#/generate">' + I('spark') + ' توليد أسئلة من محتوى</a></div></div>' +
      '<div class="h2-art" aria-hidden="true"><div class="mini-paper"><i class="mp-h"></i><i class="mp-l w70"></i><i class="mp-s"></i><i class="mp-l"></i><i class="mp-l w80"></i><i class="mp-o"></i><i class="mp-s"></i><i class="mp-l w60"></i><i class="mp-f"></i></div></div></section>' +
      M.safetyBanner() + '<div id="h-folderbar"></div>' +
      (!M.db.persistent() ? '<div class="alert bad">' + I('warn') + '<div>المتصفح لا يسمح بالحفظ الدائم في هذا الوضع (مثل التصفح الخاص) — البيانات ستضيع عند الإغلاق.</div></div>' : '') +
      (days > 7 && exams.length ? '<div class="alert warn">' + I('warn') + '<div style="flex:1">' + (lastB ? 'آخر نسخة احتياطية منذ ' + n(Math.floor(days)) + ' يوماً.' : 'لم تُؤخذ نسخة احتياطية بعد.') + ' خذ نسخة الآن واحفظها خارج الجهاز.</div><button class="btn sm" id="h-backup">نسخة احتياطية</button></div>' : '') +
      '<div id="h-jobs"></div>' + (idDone < 3 ? '<a class="id-cta" href="#/identity"><span class="ic">' + I('grid', 22) + '</span><div><b>أكمل هوية المؤسسة (' + n(idDone) + ' من ٣)</b><span>الشعار وبيانات الترويسة ووثيقة الجودة — تظهر تلقائياً في كل امتحان</span></div><span class="go">' + I('back', 18) + '</span></a>' : '') +
      '<div class="card flat"><div class="card-h" style="padding:14px 16px 6px"><h2 class="grow">آخر الامتحانات</h2><a class="btn sm ghost" href="#/exams">الكل</a></div>' +
      (exams.length ? '<div class="ex-grid">' + exams.slice(0, 6).map(function (e) { return M.examCard(e); }).join('') + '</div>'
        : '<div style="padding:4px 16px 18px"><div class="empty">لا توجد امتحانات بعد — اضغط «امتحان جديد».</div></div>') + '</div></div>';
    var hb = M.qs('#h-backup', main); if (hb) hb.onclick = function () { M.backup(); };
    M.qs('#h-newexam', main).onclick = function () { M.newExamWizard(); };
    M.bindExamCards && M.bindExamCards(main);
    M.bindSafety(main);
    if (M.extractJobs) M.extractJobs().then(function (js) { var box = M.qs('#h-jobs', main); if (!box || !js.length) return; box.innerHTML = '<div class="alert info">' + I('file') + '<div style="flex:1">لديك ' + n(js.length) + ' مهمة استخراج غير مكتملة — نتائجها محفوظة على الجهاز.</div>' + js.slice(0, 3).map(function (j) { return '<a class="btn sm" href="#/extract/' + j.id + '">' + esc((j.sources || []).map(function (x) { return x.name; }).join('، ').slice(0, 40) || 'مهمة') + '</a>'; }).join('') + '</div>'; });
    M.folderReconnectBar().then(function (h) { var fb = M.qs('#h-folderbar', main); if (fb && h) { fb.innerHTML = h; M.bindSafety(fb); } });
  };

  /* توليد الأسئلة: المرحلة القادمة */
  if (!M.views.generate) M.views.generate = function (main) {
    main.innerHTML = '<div class="content"><div class="soon-page"><span class="ic">' + I('spark', 40) + '</span><span class="chip info">قريباً</span><h1>توليد أسئلة من محتوى</h1><p>المرحلة القادمة: ترفع جزءاً من درس فيولّد أسئلة جديدة مبنية عليه، بإجابات ومراجعة قبل الحفظ.</p><a class="btn pri" href="#/extract">' + I('file') + ' استخراج أسئلة موجودة من ملف أو صور</a></div></div>';
  };
  /* قريباً: بنك الأسئلة */
  M.views.soon = function (main) {
    main.innerHTML = '<div class="content"><div class="soon-page"><span class="ic">' + I('bank', 40) + '</span><span class="chip info">قريباً</span><h1>بنك الأسئلة</h1>' +
      '<p>نطوّره في مرحلة قادمة: بنك مرتبط بالدروس ونواتج التعلم، ومراجعة واعتماد، وتوليد نماذج متكافئة تلقائياً.</p>' +
      '<p class="muted small">بياناتك السابقة في البنك محفوظة كما هي ولن تُحذف.</p><a class="btn pri" href="#/exams">' + I('exam') + ' اذهب إلى امتحاناتي</a></div></div>';
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
      '<div class="about-card"><img src="icons/icon-192.png" alt="" width="64" height="64"><div class="ab-t"><b>Exam Studio</b><span>استوديو الامتحانات · الإصدار <span class="p-code">' + esc(M.VERSION) + '</span></span></div>' + M.creditHTML() + '</div>' +
      (M.isAndroidApp ? '' : '<a class="btn apk-dl" href="https://github.com/starrnightt2030-oss/miyar/releases/latest/download/ExamStudio.apk" rel="noopener"><span class="apk-ic" aria-hidden="true">▼</span> تحميل تطبيق أندرويد (APK)</a>') +
      '<div class="row mob-only"><a class="btn" href="#/identity">' + I('grid') + ' هوية المؤسسة</a><a class="btn" href="#/docs">' + I('docs') + ' وثائق الجودة</a></div>' +
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
      '<a class="id-cta" href="#/identity"><span class="ic">' + I('grid', 22) + '</span><div><b>هوية المؤسسة</b><span>الشعارات وسطور الترويسة والعام الدراسي والتنسيق الافتراضي</span></div><span class="go">' + I('back', 18) + '</span></a>' +
      '<div class="card"><h2 style="margin-bottom:12px">المستخدم والجهاز</h2><div class="grid3">' +
      '<div class="field"><label for="st-un">الاسم</label><input id="st-un" class="inp" value="' + esc(me.name || '') + '"></div>' +
      '<div class="field"><label for="st-ur">الدور</label><select id="st-ur" class="inp">' + Object.keys(M.ROLES).map(function (k) { return '<option value="' + k + '"' + (k === me.role ? ' selected' : '') + '>' + M.ROLES[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="st-up">رمز الدخول (اتركه فارغاً لإلغائه)</label><input id="st-up" class="inp" type="password" inputmode="numeric" value="' + esc(me.pin || '') + '" autocomplete="new-password"></div></div>' +
      '<div class="small muted" style="margin-top:8px">معرّف الجهاز: <span class="p-code">' + esc(st.deviceId) + '</span></div></div>' +
      (M.securityCardHTML ? M.securityCardHTML() : '') +
      '<div class="card"><h2 style="margin-bottom:12px">الأرقام في الورقة</h2>' +
      '<div class="field"><span class="lbl">شكل الأرقام الافتراضي</span><div class="seg" id="st-dg"><button type="button" data-v="arabic" class="' + (st.digits !== 'english' ? 'on' : '') + '">هندية ١٢٣</button><button type="button" data-v="english" class="' + (st.digits === 'english' ? 'on' : '') + '">إنجليزية 123</button></div></div></div>' +
      '<div class="row"><button class="btn pri" id="st-save">' + I('check') + ' حفظ الإعدادات</button></div>' +
      '<div class="card"><h2 style="margin-bottom:6px">النسخ الاحتياطي</h2><p class="small muted" style="margin:0 0 12px">النسخة الاحتياطية ملف واحد فيه كل بيانات الجهاز. احفظه على فلاشة أو Drive. آخر نسخة: ' + (st.lastBackupAt ? n(M.fmtDate(st.lastBackupAt, true)) : 'لم تُؤخذ بعد') + '</p>' +
      '<div class="row"><button class="btn" id="st-bk">' + I('download') + ' أخذ نسخة احتياطية</button><button class="btn" id="st-rs">' + I('merge') + ' استعادة نسخة</button></div></div>' +
      '<div class="card flat"><div style="padding:14px 16px"><h2>سجل النشاط</h2><div class="small muted">سجل لا يُحذف: من فعل ماذا ومتى — دليل للمراجعة الداخلية</div></div><div class="scroll-x" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>العنصر</th><th>تفاصيل</th></tr></thead><tbody>' +
      S.log.slice(0, 300).map(function (e) { return '<tr><td class="small" style="white-space:nowrap">' + n(M.fmtDate(e.at, true)) + '</td><td>' + esc(e.by) + '<div class="small muted">' + esc(M.ROLES[e.role] || '') + '</div></td><td>' + esc(e.action) + '</td><td>' + esc(e.target) + '</td><td class="small muted">' + esc(e.detail) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<details class="card"><summary class="bold" style="cursor:pointer">متقدم: المزامنة الأونلاين وحزم النقل</summary><div class="row" style="margin-top:10px"><a class="btn" href="#/cloud">' + I('spark') + ' الأونلاين والإشعارات</a></div></details>' +
      '<div class="card"><h2 style="margin-bottom:6px;color:var(--bad)">منطقة الخطر</h2><p class="small muted" style="margin:0 0 12px">مسح كل البيانات من هذا الجهاز. خذ نسخة احتياطية أولاً.</p><button class="btn danger" id="st-wipe">' + I('trash') + ' مسح كل البيانات</button></div>' +
      '</div>';
    var digits = st.digits || 'arabic';
    M.qsa('#st-dg button', main).forEach(function (b) { b.onclick = function () { digits = b.dataset.v; M.qsa('#st-dg button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    if (admin && M.qs('#st-logo-up', main)) {
      M.qs('#st-logo-up', main).onclick = function () {
        M.pickFile('image/*').then(function (f) { if (!f[0]) return; return M.readFile(f[0], 'dataurl').then(function (d) { return M.shrinkImage(d, 400); }).then(function (d) { return M.setSetting('center', Object.assign({}, S.settings.center, { logo: d })); }).then(function () { M.render(); }); });
      };
      var rm = M.qs('#st-logo-rm', main); if (rm) rm.onclick = function () { M.setSetting('center', Object.assign({}, S.settings.center, { logo: '' })).then(M.render); };
    }
    M.qs('#st-save', main).onclick = function () {
      var pin = M.toWestern(M.qs('#st-up', main).value.trim());
      if (pin && !/^\d{4,}$/.test(pin)) { M.toast('رمز الدخول أرقام فقط (٤ على الأقل)', 'bad'); return; }
      var name = M.qs('#st-un', main).value.trim(); if (!name) { M.toast('الاسم مطلوب', 'bad'); return; }
      var newRole = M.qs('#st-ur', main).value;
      var jobs = [M.setSetting('user', { name: name, role: newRole, pin: pin }), M.setSetting('digits', digits)];
      if (newRole !== me.role) M.log('تغيير الدور', name, M.ROLES[me.role] + ' ← ' + M.ROLES[newRole]);
      Promise.all(jobs).then(function () { M.toast('تم حفظ الإعدادات', 'ok'); M.render(); });
    };
    M.bindAISettings(main);
    M.qs('#snd-on', main).onchange = function (e) { M.setSetting('soundOn', e.target.checked); if (e.target.checked) M.sound('success', true); };
    M.qs('#snd-vol', main).onchange = function (e) { M.setSetting('soundVol', Number(e.target.value)).then(function () { M.sound('notify', true); }); };
    M.qsa('[data-sndt]', main).forEach(function (b) { b.onclick = function () { M.sound(b.dataset.sndt, true); }; });
    if (M.bindSecurity) M.bindSecurity(main);
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
    var xl = M.qs('#st-xl', main); if (xl) xl.onclick = function () { M.exportBankExcel(S.questions.filter(function (q) { return q.status !== 'archived'; }), 'بنك-الأسئلة-كاملاً'); };
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
      if (M.lockEnabled ? M.lockEnabled() : M.me().pin) M._locked = true;
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
