/* المرحلة ٥: الخادم الأونلاين (Supabase) — حسابات + مزامنة لحظية ثنائية الاتجاه + إشعارات فورية
   التطبيق يظل يعمل أوفلاين بالكامل؛ أي تعديل يُرفع تلقائياً عند توفر الإنترنت */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;
  var SYNC = ['subjects', 'units', 'lessons', 'outcomes', 'questions', 'exams', 'docs', 'log'];
  var LOCAL_ONLY = ['cloudAt', 'cloudErr', 'cloudErrAt', 'images'];
  var C = M.cloud = { ready: false, client: null, user: null, profile: null, status: 'off', lastSync: null, errors: 0, busy: false };

  function setStatus(st) { C.status = st; var d = M.qs('#cloud-dot'); if (d) { d.className = 'cloud-dot ' + st; d.title = statusLabel(); } }
  function statusLabel() {
    return { off: 'الأونلاين غير مفعّل', out: 'غير مسجّل الدخول', pending: 'بانتظار موافقة المدير', online: 'متصل ومتزامن', syncing: 'جاري المزامنة…', offline: 'بدون إنترنت — ستُرفع التعديلات لاحقاً', error: 'خطأ في المزامنة' }[C.status] || '';
  }
  C.statusLabel = statusLabel;

  var stampOf = function (r, store) { return store === 'log' ? r.at : r.updatedAt; };
  var dirty = function (r, store) { var t = stampOf(r, store); return !!t && (!r.cloudAt || t > r.cloudAt) && !(r.cloudErr && r.cloudErrAt === t); };

  /* ===== الإعداد ===== */
  C.config = function () {
    var man = S.settings.cloudConfigManual;
    if (man && man.url && man.anonKey) return Promise.resolve(man);
    if (location.protocol.indexOf('http') !== 0) return Promise.resolve(S.settings.cloudConfig || null);
    return fetch('config.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
      if (cfg && cfg.url && cfg.anonKey) { if (JSON.stringify(cfg) !== JSON.stringify(S.settings.cloudConfig)) M.setSetting('cloudConfig', cfg); return cfg; }
      return S.settings.cloudConfig || null;
    }).catch(function () { return S.settings.cloudConfig || null; });
  };

  C.init = function () {
    return C.config().then(function (cfg) {
      if (!cfg || !cfg.url || !window.supabase) { setStatus('off'); return; }
      C.cfg = cfg;
      C.client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'miyar-auth' } });
      C.ready = true;
      C.client.auth.onAuthStateChange(function (ev, session) {
        if (ev === 'SIGNED_OUT') { C.user = null; C.profile = null; stop(); setStatus('out'); }
      });
      return C.client.auth.getSession().then(function (r) {
        var s = r.data && r.data.session;
        if (!s) { setStatus('out'); return; }
        C.user = s.user;
        return afterLogin();
      });
    }).catch(function (e) { console.warn('cloud init', e); setStatus('error'); });
  };

  function loadProfile() {
    return C.client.from('profiles').select('*').eq('id', C.user.id).single().then(function (r) {
      if (r.error) throw r.error;
      C.profile = r.data;
      var me = M.me();
      if (C.profile.approved && (me.role !== C.profile.role || (C.profile.name && me.name !== C.profile.name))) {
        M.setSetting('user', Object.assign({}, me, { role: C.profile.role, name: C.profile.name || me.name }));
      }
      return C.profile;
    });
  }
  function afterLogin() {
    return loadProfile().then(function (p) {
      if (!p.approved) { setStatus('pending'); watchProfile(); return; }
      start();
    }).catch(function (e) { console.warn(e); setStatus(navigator.onLine ? 'error' : 'offline'); });
  }

  /* ===== الحساب ===== */
  C.signUp = function (name, email, pass) {
    return C.client.auth.signUp({ email: email, password: pass, options: { data: { name: name } } }).then(function (r) {
      if (r.error) throw r.error;
      if (!r.data.session) return 'confirm';
      C.user = r.data.user;
      M.log('إنشاء حساب أونلاين', email);
      return afterLogin().then(function () {
        if (C.profile && !C.profile.approved) C.invoke('notify', { kind: 'signup', toRoles: ['admin'], title: 'طلب حساب جديد في معيار', body: name + ' (' + email + ') ينتظر موافقتك', url: './index.html#/cloud' }).catch(function () {});
        return 'ok';
      });
    });
  };
  C.signIn = function (email, pass) {
    return C.client.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      if (r.error) throw r.error;
      C.user = r.data.user; M.log('تسجيل دخول أونلاين', email);
      return afterLogin();
    });
  };
  C.signOut = function () { stop(); return C.client.auth.signOut().then(function () { C.user = null; C.profile = null; setStatus('out'); }); };

  C.invoke = function (fn, body) {
    if (!C.client) return Promise.reject(new Error('الخادم غير متصل'));
    return C.client.functions.invoke(fn, { body: body }).then(function (r) {
      if (r.error) {
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { var e = j && j.error; throw new Error((typeof e === 'string' ? e : e && e.message) || r.error.message); }, function () { throw r.error; });
        throw r.error;
      }
      return r.data;
    });
  };

  /* ===== المزامنة ===== */
  var timer = null, chan = null, profChan = null;
  function start() {
    setStatus(navigator.onLine ? 'syncing' : 'offline');
    fetch(C.cfg.url + '/functions/v1/generate').then(function (r) { return r.json(); }).then(function (j) { C.aiProviders = j.providers || []; }).catch(function () {});
    C.sync().then(function () { subscribe(); });
    clearInterval(timer);
    timer = setInterval(function () { if (navigator.onLine) C.sync(); }, 60 * 1000);
    if (('Notification' in window) && Notification.permission === 'granted') C.enablePush(true).catch(function () {});
  }
  function stop() { clearInterval(timer); timer = null; if (chan) { C.client.removeChannel(chan); chan = null; } if (profChan) { C.client.removeChannel(profChan); profChan = null; } }
  window.addEventListener('online', function () { if (C.profile && C.profile.approved) C.sync(); });
  window.addEventListener('offline', function () { if (C.profile && C.profile.approved) setStatus('offline'); });

  function payload(store, r) {
    var d = {}; Object.keys(r).forEach(function (k) { if (LOCAL_ONLY.indexOf(k) < 0) d[k] = r[k]; });
    return { id: r.id, store: store, subject_id: r.subjectId || null, data: d, updated_at: stampOf(r, store), deleted: false };
  }
  function markSynced(store, r, at) {
    r.cloudAt = at; delete r.cloudErr; delete r.cloudErrAt;
    if (!r.ownerId && C.user) r.ownerId = C.user.id;
    return M.db.put(store, r);
  }

  C.dirtyCount = function () { return SYNC.reduce(function (s, st) { return s + S[st].filter(function (r) { return dirty(r, st); }).length; }, 0) + (S.settings.tombstones || []).length; };

  C.push = function () {
    var isAdmin = C.profile && C.profile.role === 'admin';
    var jobs = [];
    SYNC.forEach(function (store) {
      if (store === 'docs' && !isAdmin) return;
      var rows = S[store].filter(function (r) { return dirty(r, store); });
      /* دفعات بحجم معقول */
      var batch = [], size = 0;
      var flush = function (list) {
        if (!list.length) return;
        var b = list.slice();
        jobs.push(C.client.from('records').upsert(b.map(function (r) { return payload(store, r); })).then(function (res) {
          if (!res.error) return Promise.all(b.map(function (r) { return markSynced(store, r, stampOf(r, store)); }));
          /* فشل الدفعة: نحاول سجلاً سجلاً لنعرف المرفوض */
          return Promise.all(b.map(function (r) {
            return C.client.from('records').upsert([payload(store, r)]).then(function (one) {
              if (one.error) { r.cloudErr = /row-level security|violates/i.test(one.error.message) ? 'لا تملك صلاحية تعديل هذا العنصر (أنشأه مستخدم آخر)' : one.error.message; r.cloudErrAt = stampOf(r, store); C.errors++; return M.db.put(store, r); }
              return markSynced(store, r, stampOf(r, store));
            });
          }));
        }));
      };
      rows.forEach(function (r) {
        var s = JSON.stringify(r).length;
        if (size + s > 1500000 && batch.length) { flush(batch); batch = []; size = 0; }
        batch.push(r); size += s;
      });
      flush(batch);
    });
    var tomb = (S.settings.tombstones || []).slice();
    if (tomb.length) {
      jobs.push(C.client.from('records').upsert(tomb.map(function (t) { return { id: t.id, store: t.store, data: {}, updated_at: t.at, deleted: true }; })).then(function (res) {
        if (!res.error) M.setSetting('tombstones', (S.settings.tombstones || []).filter(function (t) { return !tomb.some(function (x) { return x.id === t.id; }); }));
      }));
    }
    return Promise.all(jobs);
  };

  var changedSinceRender = false;
  function applyRow(row) {
    if (SYNC.indexOf(row.store) < 0) return Promise.resolve();
    var store = row.store, local = M.byId(store, row.id);
    if (row.deleted) {
      if (local && !dirty(local, store)) { S[store] = S[store].filter(function (x) { return x.id !== row.id; }); changedSinceRender = true; return M.db.del(store, row.id); }
      return Promise.resolve();
    }
    var inc = row.data || {}; inc.id = row.id;
    inc.cloudAt = stampOf(inc, store); inc.ownerId = row.created_by;
    if (local && local.images && !inc.images) inc.images = local.images;
    var put = function () {
      var i = S[store].findIndex(function (x) { return x.id === inc.id; });
      if (i >= 0) S[store][i] = inc; else S[store].push(inc);
      changedSinceRender = true;
      return M.db.put(store, inc);
    };
    if (!local) return put();
    if (!dirty(local, store)) return stampOf(inc, store) >= stampOf(local, store) ? put() : Promise.resolve();
    /* تعديل هنا وهناك: الأحدث يفوز، والآخر يُحفظ في التعارضات */
    if (stampOf(inc, store) > stampOf(local, store)) {
      return M.db.put('conflicts', { id: M.uid(), at: M.now(), store: store, recId: local.id, kept: 'remote', data: local, by: row.updated_by }).then(put);
    }
    return M.db.put('conflicts', { id: M.uid(), at: M.now(), store: store, recId: local.id, kept: 'local', data: inc, by: row.updated_by });
  }

  C.pull = function () {
    var since = S.settings.cloudPullAt || '1970-01-01T00:00:00Z';
    var page = function (from) {
      return C.client.from('records').select('*').gt('server_at', from).order('server_at', { ascending: true }).limit(400).then(function (r) {
        if (r.error) throw r.error;
        var rows = r.data || [];
        return rows.reduce(function (p, row) { return p.then(function () { return applyRow(row); }); }, Promise.resolve()).then(function () {
          if (!rows.length) return from;
          var last = rows[rows.length - 1].server_at;
          return M.setSetting('cloudPullAt', last).then(function () { return rows.length === 400 ? page(last) : last; });
        });
      });
    };
    return page(since);
  };

  C.sync = function () {
    if (!C.client || !C.profile || !C.profile.approved) return Promise.resolve();
    if (C.busy) return C.busy;
    if (!navigator.onLine) { setStatus('offline'); return Promise.resolve(); }
    setStatus('syncing'); C.errors = 0; changedSinceRender = false;
    C.busy = C.push().then(C.pull).then(function () {
      C.lastSync = M.now(); M.setSetting('cloudLastSync', C.lastSync);
      var stuck = SYNC.some(function (st) { return S[st].some(function (r) { return r.cloudErr; }); });
      setStatus(C.errors || stuck ? 'error' : 'online');
      if (changedSinceRender) refreshView();
    }).catch(function (e) { console.warn('sync', e); setStatus(navigator.onLine ? 'error' : 'offline'); C.lastError = e.message; })
      .then(function () { C.busy = null; });
    return C.busy;
  };
  var syncSoon = M.debounce(function () { C.sync(); }, 2500);

  function refreshView() {
    var r = M.route();
    if (['q', 'exam', 'gen'].indexOf(r.name) >= 0 || M.qs('.overlay')) { M.toast('وصلت تحديثات من الخادم — ستظهر عند التنقل'); M.refreshNav(); return; }
    M.render();
  }

  function subscribe() {
    if (chan) return;
    chan = C.client.channel('records-live').on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, function (p) {
      var row = p.new || {};
      if (C.user && row.updated_by === C.user.id) return;
      syncSoon();
    }).subscribe();
    if (C.profile.role === 'admin') {
      profChan = C.client.channel('profiles-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, function (p) {
        M.sound('notify'); M.toast('طلب حساب جديد: ' + ((p.new && p.new.name) || '') + ' — راجع صفحة الأونلاين');
      }).subscribe();
    }
  }
  function watchProfile() {
    if (profChan) return;
    profChan = C.client.channel('me-live').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + C.user.id }, function () {
      loadProfile().then(function (p) { if (p.approved) { M.sound('notify'); M.toast('تمت الموافقة على حسابك — بدأت المزامنة', 'ok'); C.client.removeChannel(profChan); profChan = null; start(); M.render(); } });
    }).subscribe();
  }

  /* التقاط التعديلات المحلية */
  var origSave = M.save, origRemove = M.remove;
  M.save = function (store, rec, opts) {
    var p = origSave.apply(this, arguments);
    if (C.profile && C.profile.approved && SYNC.indexOf(store) >= 0) p.then(syncSoon);
    return p;
  };
  M.remove = function (store, id) {
    if (SYNC.indexOf(store) >= 0 && C.ready) {
      var t = (S.settings.tombstones || []).concat([{ store: store, id: id, at: M.now() }]);
      M.setSetting('tombstones', t);
    }
    var p = origRemove.apply(this, arguments);
    if (C.profile && C.profile.approved) p.then(syncSoon);
    return p;
  };
  var origApply = M.applyPack;
  M.applyPack = function () { return origApply.apply(this, arguments).then(function (x) { syncSoon(); return x; }); };

  /* ===== الإشعارات ===== */
  function b64ToU8(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  C.enablePush = function (silent) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { if (!silent) M.toast('الإشعارات الفورية غير مدعومة على هذا المتصفح — على الآيفون ثبّت التطبيق على الشاشة الرئيسية أولاً', 'bad'); return Promise.resolve(false); }
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { if (!silent) M.toast('لم يُسمح بالإشعارات — فعّلها من إعدادات المتصفح', 'bad'); return false; }
      return Promise.all([navigator.serviceWorker.ready, fetch(C.cfg.url + '/functions/v1/notify').then(function (r) { return r.json(); })]).then(function (x) {
        var reg = x[0], pub = x[1].publicKey;
        if (!pub) throw new Error('مفاتيح الإشعارات غير مضبوطة على الخادم');
        return reg.pushManager.getSubscription().then(function (sub) {
          return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(pub) });
        });
      }).then(function (sub) {
        var j = sub.toJSON();
        return C.client.from('push_subs').upsert({ endpoint: j.endpoint, user_id: C.user.id, sub: j, ua: navigator.userAgent.slice(0, 200) }).then(function (r) {
          if (r.error) throw r.error;
          M.setSetting('pushOn', true);
          if (!silent) M.toast('تم تفعيل الإشعارات الفورية على هذا الجهاز', 'ok');
          return true;
        });
      });
    }).catch(function (e) { if (!silent) M.toast('تعذّر تفعيل الإشعارات: ' + e.message, 'bad'); return false; });
  };
  C.notify = function (msg) {
    if (!C.profile || !C.profile.approved || !navigator.onLine) return Promise.resolve();
    return C.invoke('notify', msg).catch(function (e) { console.warn('notify', e); });
  };
  /* تجميع إشعارات الاعتماد المتتالية في إشعار واحد */
  var agg = {};
  function queue(key, build) {
    agg[key] = agg[key] || { n: 0, timer: null };
    agg[key].n++;
    clearTimeout(agg[key].timer);
    agg[key].timer = setTimeout(function () { var cnt = agg[key].n; delete agg[key]; C.notify(build(cnt)); }, 4000);
  }
  var origStatus = M.setStatus;
  M.setStatus = function (q, status, note) {
    return origStatus.apply(this, arguments).then(function (r) {
      var me = C.user && C.user.id, owner = q.ownerId;
      var subj = (M.byId('subjects', q.subjectId) || {}).name || '';
      if (status === 'review') queue('review', function (c) { return { kind: 'review', toRoles: ['head', 'admin'], title: 'أسئلة جديدة للمراجعة', body: (M.me().name || '') + ' أرسل ' + c + ' سؤال — ' + subj, url: './index.html#/review' }; });
      if (status === 'returned' && owner && owner !== me) C.notify({ kind: 'returned', toUsers: [owner], title: 'سؤال أُعيد إليك بملاحظة', body: note || '', url: './index.html#/q/' + q.id });
      if (status === 'approved' && owner && owner !== me) queue('ok-' + owner, function (c) { return { kind: 'approved', toUsers: [owner], title: 'تم اعتماد أسئلتك', body: 'اعتُمد ' + c + ' سؤال — ' + subj, url: './index.html#/bank' }; });
      return r;
    });
  };

  /* رسائل الإشعارات أثناء فتح التطبيق */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (!e.data || e.data.type !== 'PUSH') return;
      var d = e.data.data || {};
      if (d.kind === 'update') { M.checkUpdate(); return; }
      M.sound('notify'); M.toast(d.title + (d.body ? ' — ' + d.body : ''));
      syncSoon();
    });
  }

  /* ===== صفحة الأونلاين ===== */
  M.views.cloud = function (main) {
    var h = '';
    if (!C.ready) {
      h = '<div class="card"><h2 style="margin-bottom:8px">الخادم الأونلاين غير مُعدّ بعد</h2><p class="muted" style="margin:0 0 10px">بعد تجهيز الخادم مرة واحدة (دليل SETUP-ONLINE.md في المستودع) يتصل كل مدرس تلقائياً. يمكن لمدير النظام إدخال بيانات الاتصال يدوياً هنا.</p>' +
        '<div class="grid2"><div class="field"><label for="cf-u">رابط المشروع (Project URL)</label><input id="cf-u" class="inp" dir="ltr" placeholder="https://xxxx.supabase.co" value="' + esc((S.settings.cloudConfigManual || {}).url || '') + '"></div>' +
        '<div class="field"><label for="cf-k">المفتاح العام (anon key)</label><input id="cf-k" class="inp" dir="ltr" value="' + esc((S.settings.cloudConfigManual || {}).anonKey || '') + '"></div></div>' +
        '<div class="row" style="margin-top:10px"><button class="btn pri" id="cf-save">حفظ والاتصال</button></div></div>';
    } else if (!C.user) {
      h = '<div class="card" style="max-width:520px"><div class="seg" id="au-tab" style="margin-bottom:12px"><button type="button" data-v="in" class="on">تسجيل الدخول</button><button type="button" data-v="up">حساب جديد</button></div>' +
        '<div class="field" id="au-name-f" style="display:none"><label for="au-name">الاسم كما يظهر في الورق</label><input id="au-name" class="inp" value="' + esc(M.me().name || '') + '"></div>' +
        '<div class="field"><label for="au-email">البريد الإلكتروني</label><input id="au-email" class="inp" dir="ltr" type="email" autocomplete="email"></div>' +
        '<div class="field"><label for="au-pass">كلمة المرور (٨ أحرف على الأقل)</label><input id="au-pass" class="inp" dir="ltr" type="password" autocomplete="current-password"></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn pri" id="au-go">دخول</button></div>' +
        '<p class="small muted" style="margin:12px 0 0">أول حساب يُنشأ على الخادم يصبح مدير النظام تلقائياً. باقي الحسابات تنتظر موافقته وتحديد دور كل شخص.</p></div>';
    } else if (!C.profile || !C.profile.approved) {
      h = '<div class="card"><div class="alert warn">' + I('lock') + '<div>حسابك (' + esc(C.user.email) + ') بانتظار موافقة مدير النظام. ستبدأ المزامنة تلقائياً فور الموافقة.</div></div><div class="row" style="margin-top:10px"><button class="btn" id="au-out">تسجيل الخروج</button></div></div>';
    } else {
      var dc = C.dirtyCount();
      var errs = [];
      SYNC.forEach(function (st) { S[st].forEach(function (r) { if (r.cloudErr) errs.push({ st: st, r: r }); }); });
      h = '<div class="card"><div class="card-h"><span id="cloud-dot2" class="cloud-dot ' + C.status + '"></span><h2 class="grow">' + statusLabel() + '</h2><span class="chip">' + esc(C.profile.name || C.user.email) + ' · ' + esc(M.ROLES[C.profile.role]) + '</span></div>' +
        '<div class="grid3"><div class="stat"><span class="small muted">آخر مزامنة</span><b style="font-size:16px">' + (S.settings.cloudLastSync ? n(M.fmtDate(S.settings.cloudLastSync, true)) : '—') + '</b></div>' +
        '<div class="stat"><span class="small muted">تعديلات لم تُرفع</span><b>' + n(dc) + '</b></div><div class="stat"><span class="small muted">مرفوضة من الخادم</span><b style="color:' + (errs.length ? 'var(--bad)' : 'inherit') + '">' + n(errs.length) + '</b></div></div>' +
        (C.lastError ? '<div class="alert bad" style="margin-top:10px">' + I('warn') + '<div>' + esc(C.lastError) + '</div></div>' : '') +
        (errs.length ? '<details style="margin-top:10px"><summary class="bold" style="cursor:pointer">عرض المرفوض</summary><div class="small">' + errs.slice(0, 30).map(function (x) { return '<div>' + esc(x.st) + ': ' + esc(String(x.r.name || x.r.title || x.r.text || x.r.id).slice(0, 60)) + ' — ' + esc(x.r.cloudErr) + '</div>'; }).join('') + '</div><div class="small muted">غالباً سجل أنشأه شخص آخر ولا تملك صلاحية تعديله — رئيس القسم أو المدير يملك ذلك.</div><button class="btn sm" id="cl-revert" style="margin-top:8px">استرجاع نسخة الخادم لهذه العناصر</button></details>' : '') +
        '<div class="row" style="margin-top:12px"><button class="btn pri" id="cl-sync">' + I('merge') + ' مزامنة الآن</button><button class="btn" id="cl-push">' + I('spark') + ' ' + (S.settings.pushOn && ('Notification' in window) && Notification.permission === 'granted' ? 'الإشعارات الفورية مفعّلة — تحديث' : 'تفعيل الإشعارات الفورية') + '</button><button class="btn" id="au-out">تسجيل الخروج</button></div></div>' +
        '<div id="cl-conf"></div>';
      if (C.profile.role === 'admin') h += '<div id="cl-admin" style="display:flex;flex-direction:column;gap:16px"><div class="card"><div class="small muted">جاري تحميل الحسابات…</div></div></div>';
    }
    main.innerHTML = M.topbar('الأونلاين والإشعارات', 'مزامنة لحظية بين كل الأجهزة — والتطبيق يعمل بدون إنترنت أيضاً') + '<div class="content">' + h + '</div>';

    var on = function (id, fn) { var el = M.qs('#' + id, main); if (el) el.onclick = fn; };
    on('cf-save', function () {
      var u = M.qs('#cf-u', main).value.trim().replace(/\/$/, ''), k = M.qs('#cf-k', main).value.trim();
      if (!/^https:\/\/.+/.test(u) || !k) return M.toast('أدخل الرابط والمفتاح', 'bad');
      M.setSetting('cloudConfigManual', { url: u, anonKey: k }).then(C.init).then(M.render);
    });
    var mode = 'in';
    M.qsa('#au-tab button', main).forEach(function (b) { b.onclick = function () { mode = b.dataset.v; M.qsa('#au-tab button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); M.qs('#au-name-f', main).style.display = mode === 'up' ? '' : 'none'; M.qs('#au-go', main).textContent = mode === 'up' ? 'إنشاء الحساب' : 'دخول'; }; });
    on('au-go', function () {
      var em = M.qs('#au-email', main).value.trim(), pw = M.qs('#au-pass', main).value, nm = (M.qs('#au-name', main) || {}).value;
      if (!em || pw.length < 8) return M.toast('أدخل البريد وكلمة مرور ٨ أحرف على الأقل', 'bad');
      var b = this; b.disabled = true;
      (mode === 'up' ? C.signUp((nm || '').trim() || M.me().name, em, pw) : C.signIn(em, pw)).then(function (res) {
        if (res === 'confirm') M.toast('أرسلنا رسالة تأكيد إلى بريدك — افتحها ثم سجّل الدخول', 'ok');
        M.render();
      }).catch(function (e) { b.disabled = false; M.toast(trErr(e.message), 'bad'); });
    });
    on('au-out', function () { M.confirm('تسجيل الخروج', 'ستتوقف المزامنة على هذا الجهاز، وتبقى بياناتك عليه.', 'خروج').then(function (ok) { if (ok) C.signOut().then(M.render); }); });
    on('cl-sync', function () { C.sync().then(function () { M.toast(C.errors ? 'تمت المزامنة مع ' + n(C.errors) + ' مرفوض' : 'تمت المزامنة', C.errors ? 'bad' : 'ok'); M.render(); }); });
    on('cl-revert', function () {
      M.confirm('استرجاع نسخة الخادم', 'ستُلغى تعديلاتك المرفوضة وتُستبدل بالنسخة المعتمدة على الخادم.', 'استرجاع').then(function (ok) {
        if (!ok) return;
        var jobs = [];
        SYNC.forEach(function (st) { S[st].filter(function (r) { return r.cloudErr; }).forEach(function (r) { S[st] = S[st].filter(function (x) { return x.id !== r.id; }); jobs.push(M.db.del(st, r.id)); }); });
        Promise.all(jobs).then(function () { return M.setSetting('cloudPullAt', '1970-01-01T00:00:00Z'); }).then(C.sync).then(function () { M.toast('تم الاسترجاع', 'ok'); M.render(); });
      });
    });
    on('cl-push', function () { C.enablePush(false).then(M.render); });

    if (C.profile && C.profile.approved) {
      M.db.all('conflicts').then(function (list) {
        var box = M.qs('#cl-conf', main); if (!box || !list.length) return;
        list.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
        box.innerHTML = '<div class="card flat"><div style="padding:14px 16px"><h2>نسخ محفوظة من التعارضات (' + n(list.length) + ')</h2><div class="small muted">عند تعديل نفس العنصر على جهازين، تُعتمد النسخة الأحدث وتُحفظ الأخرى هنا — يمكنك استرجاعها.</div></div><div class="scroll-x"><table class="tbl"><tbody>' +
          list.slice(0, 50).map(function (c) { return '<tr><td class="small">' + n(M.fmtDate(c.at, true)) + '</td><td>' + esc(c.store) + '</td><td>' + esc(String(c.data.name || c.data.title || c.data.text || '').slice(0, 70)) + '</td><td class="small muted">' + (c.kept === 'remote' ? 'نسختك المحلية' : 'نسخة الخادم') + '</td><td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-cfr="' + c.id + '">استرجاع هذه النسخة</button><button class="btn sm ghost" data-cfd="' + c.id + '">تجاهل</button></div></td></tr>'; }).join('') + '</tbody></table></div></div>';
        M.qsa('[data-cfr]', box).forEach(function (b) { b.onclick = function () { var c = list.find(function (x) { return x.id === b.dataset.cfr; }); var rec = JSON.parse(JSON.stringify(c.data)); delete rec.cloudAt; M.save(c.store, rec).then(function () { return M.db.del('conflicts', c.id); }).then(function () { M.toast('تم الاسترجاع', 'ok'); M.render(); }); }; });
        M.qsa('[data-cfd]', box).forEach(function (b) { b.onclick = function () { M.db.del('conflicts', b.dataset.cfd).then(M.render); }; });
      });
    }
    if (C.profile && C.profile.approved && C.profile.role === 'admin') adminPanel(main);
  };

  function trErr(m) {
    if (/Invalid login/i.test(m)) return 'البريد أو كلمة المرور غير صحيحة';
    if (/already registered/i.test(m)) return 'هذا البريد مسجّل بالفعل — استخدم تسجيل الدخول';
    if (/Email not confirmed/i.test(m)) return 'لم يتم تأكيد البريد بعد — افتح رسالة التأكيد';
    if (/fetch|network/i.test(m)) return 'تعذّر الاتصال بالخادم — تحقق من الإنترنت';
    return m;
  }

  function adminPanel(main) {
    var month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    Promise.all([
      C.client.from('profiles').select('*').order('created_at', { ascending: true }),
      C.client.from('ai_usage').select('model,input_tokens,output_tokens').gte('at', month.toISOString())
    ]).then(function (r) {
      var users = r[0].data || [], usage = r[1].data || [];
      var byModel = {};
      usage.forEach(function (u) { var k = u.model || '—'; byModel[k] = byModel[k] || { n: 0, t: 0 }; byModel[k].n++; byModel[k].t += (u.input_tokens || 0) + (u.output_tokens || 0); });
      var pend = users.filter(function (u) { return !u.approved; }).length;
      var box = M.qs('#cl-admin', main); if (!box) return;
      box.innerHTML = '<div class="card flat"><div style="padding:14px 16px"><h2>الحسابات ' + (pend ? '<span class="chip warn">' + n(pend) + ' بانتظار الموافقة</span>' : '') + '</h2></div><div class="scroll-x"><table class="tbl"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th></th></tr></thead><tbody>' +
        users.map(function (u) {
          var self = u.id === C.user.id;
          return '<tr><td>' + esc(u.name || '—') + '</td><td dir="ltr" style="text-align:right">' + esc(u.email || '') + '</td><td><select class="inp" data-urole="' + u.id + '" style="min-height:36px"' + (self ? ' disabled' : '') + '>' + Object.keys(M.ROLES).map(function (k) { return '<option value="' + k + '"' + (k === u.role ? ' selected' : '') + '>' + M.ROLES[k] + '</option>'; }).join('') + '</select></td>' +
            '<td>' + (u.approved ? '<span class="chip ok">معتمد</span>' : '<span class="chip warn">ينتظر</span>') + '</td><td>' + (self ? '' : '<button class="btn sm' + (u.approved ? '' : ' pri') + '" data-uapp="' + u.id + '" data-v="' + (u.approved ? '0' : '1') + '">' + (u.approved ? 'إيقاف' : 'موافقة') + '</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><h2 style="margin-bottom:10px">إشعار فوري لكل المستخدمين</h2><div class="grid2"><div class="field"><label for="bc-t">العنوان</label><input id="bc-t" class="inp" placeholder="مثال: آخر موعد لتسليم بنوك الأسئلة"></div><div class="field"><label for="bc-b">النص</label><input id="bc-b" class="inp"></div></div><div class="row" style="margin-top:10px"><button class="btn pri" id="bc-go">' + I('send') + ' إرسال الآن</button></div></div>' +
        '<div class="card"><h2 style="margin-bottom:6px">استخدام الذكاء الاصطناعي هذا الشهر</h2>' + (usage.length ? '<table class="tbl"><thead><tr><th>المزود والنموذج</th><th>الطلبات</th><th>التوكنز</th></tr></thead><tbody>' + Object.keys(byModel).map(function (k) { return '<tr><td class="p-code">' + esc(k) + '</td><td>' + n(byModel[k].n) + '</td><td>' + n(byModel[k].t.toLocaleString('en')) + '</td></tr>'; }).join('') + '</tbody></table><div class="small muted">التكلفة الفعلية تظهر في لوحة حساب المزود.</div>' : '<div class="small muted">لا يوجد استخدام هذا الشهر.</div>') + '</div>';
      M.qsa('[data-uapp]', box).forEach(function (b) {
        b.onclick = function () {
          var approve = b.dataset.v === '1', u = users.find(function (x) { return x.id === b.dataset.uapp; });
          C.client.from('profiles').update({ approved: approve }).eq('id', u.id).then(function (res) {
            if (res.error) return M.toast(res.error.message, 'bad');
            M.log(approve ? 'موافقة على حساب' : 'إيقاف حساب', u.name + ' ' + u.email);
            if (approve) C.notify({ kind: 'account', toUsers: [u.id], title: 'تمت الموافقة على حسابك في معيار', body: 'افتح التطبيق لبدء المزامنة', url: './index.html#/cloud' });
            M.render();
          });
        };
      });
      M.qsa('[data-urole]', box).forEach(function (s) {
        s.onchange = function () { C.client.from('profiles').update({ role: s.value }).eq('id', s.dataset.urole).then(function (res) { if (res.error) return M.toast(res.error.message, 'bad'); M.log('تغيير دور', s.dataset.urole, M.ROLES[s.value]); M.toast('تم تغيير الدور', 'ok'); }); };
      });
      M.qs('#bc-go', box).onclick = function () {
        var t = M.qs('#bc-t', box).value.trim(); if (!t) return M.toast('اكتب العنوان', 'bad');
        C.invoke('notify', { all: true, kind: 'announce', title: t, body: M.qs('#bc-b', box).value.trim() }).then(function (r) { M.toast('أُرسل إلى ' + n(r.sent || 0) + ' جهاز', 'ok'); M.log('إشعار للجميع', t); }).catch(function (e) { M.toast(e.message, 'bad'); });
      };
    });
  }
})(window.M);
