/* حماية البيانات: تخزين دائم + نسخ داخلية + مجلد حفظ تلقائي + نسخة يومية للهاتف */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;
  var KEEP = 15;
  M.hasFolderAPI = !!window.showDirectoryPicker;

  /* ===== التخزين الدائم ===== */
  M.ensurePersist = function () {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).then(function (ok) {
      if (S.settings.persistGranted !== ok) M.setSetting('persistGranted', ok);
      return ok;
    }).catch(function () { return false; });
  };
  M.storageInfo = function () {
    var est = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({});
    var per = navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false);
    return Promise.all([est, per]).then(function (r) { return { usage: r[0].usage || 0, quota: r[0].quota || 0, persisted: r[1] }; }).catch(function () { return { persisted: false }; });
  };

  /* ===== النسخ الداخلية (لقطات) ===== */
  M.snapshot = function (reason) {
    return M.buildPack('backup').then(function (txt) {
      var rec = { id: M.uid(), at: M.now(), reason: reason || 'يدوية', size: txt.length, by: M.me().name || '', version: M.VERSION, questions: S.questions.length, text: txt };
      return M.db.put('snapshots', rec).then(function () { return M.db.all('snapshots'); }).then(function (all) {
        all.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
        return Promise.all(all.slice(KEEP).map(function (x) { return M.db.del('snapshots', x.id); }));
      }).then(function () { return rec; });
    });
  };
  M.listSnapshots = function () {
    return M.db.all('snapshots').then(function (all) { return all.sort(function (a, b) { return a.at < b.at ? 1 : -1; }); });
  };
  M.restoreSnapshot = function (id) {
    return M.db.all('snapshots').then(function (all) {
      var s = all.find(function (x) { return x.id === id; });
      if (!s) throw new Error('النسخة غير موجودة');
      return M.snapshot('قبل الاسترجاع').then(function () { return M.parsePack(s.text); }).then(M.restore).then(M.load);
    });
  };

  /* ===== مجلد الحفظ التلقائي (الكمبيوتر) ===== */
  M.folderState = function () {
    var h = S.settings.folderHandle;
    if (!h || !h.queryPermission) return Promise.resolve('none');
    return h.queryPermission({ mode: 'readwrite' }).catch(function () { return 'prompt'; });
  };
  M.pickFolder = function () {
    if (!M.hasFolderAPI) { M.toast('المتصفح لا يدعم اختيار مجلد — استخدم Chrome أو Edge على الكمبيوتر', 'bad'); return Promise.resolve(); }
    return window.showDirectoryPicker({ id: 'miyar-backup', mode: 'readwrite', startIn: 'documents' }).then(function (h) {
      return M.setSetting('folderHandle', h).then(function () { return M.saveToFolder(true); }).then(function () { M.toast('سيُحفظ عملك تلقائياً في مجلد «' + h.name + '»', 'ok'); M.log('ربط مجلد الحفظ التلقائي', h.name); });
    }).catch(function (e) { if (e && e.name !== 'AbortError') M.toast('تعذّر اختيار المجلد: ' + e.message, 'bad'); });
  };
  M.reconnectFolder = function () {
    var h = S.settings.folderHandle; if (!h) return Promise.resolve(false);
    return h.requestPermission({ mode: 'readwrite' }).then(function (p) { if (p === 'granted') { M.saveToFolder(true); M.toast('تم تفعيل الحفظ في المجلد', 'ok'); M.render(); } return p === 'granted'; });
  };
  function writeFile(dir, name, text) {
    return dir.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(text).then(function () { return w.close(); }); });
  }
  M.saveToFolder = function (force) {
    var h = S.settings.folderHandle;
    if (!h || !h.queryPermission) return Promise.resolve(false);
    return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p !== 'granted') return false;
      return M.buildPack('backup').then(function (txt) {
        var jobs = [writeFile(h, 'معيار-آخر-نسخة.miyar', txt)];
        var today = M.today();
        if (force || S.settings.lastFolderDaily !== today) { jobs.push(writeFile(h, 'معيار-' + today + '.miyar', txt)); M.setSetting('lastFolderDaily', today); }
        return Promise.all(jobs).then(function () { M.setSetting('lastFolderSave', M.now()); return true; });
      });
    }).catch(function (e) { console.warn('folder save', e); return false; });
  };

  /* ===== نسخة يومية للهاتف (مجلد التنزيلات) ===== */
  M.isMobile = function () { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || !M.hasFolderAPI; };
  M.phoneBackupDue = function () {
    if (M.hasFolderAPI && !M.isMobile()) return false;
    var today = M.today();
    return S.settings.lastPhoneBackup !== today && S.settings.lastChangeDay === today;
  };
  M.phoneBackup = function () {
    return M.buildPack('backup').then(function (txt) {
      var name = 'معيار-نسخة-' + M.today() + '.miyar';
      M.download(name, new Blob([txt], { type: 'application/octet-stream' }));
      M.setSetting('lastPhoneBackup', M.today()); M.setSetting('lastBackupAt', M.now());
      M.log('نسخة يومية', name);
    });
  };

  /* ===== التقاط أي تغيير في البيانات ===== */
  var folderSoon = M.debounce(function () { M.saveToFolder(false); }, 12000);
  var autoPhoneTried = false;
  M.onDataChange = function () {
    var today = M.today();
    if (S.settings.lastChangeDay !== today) M.setSetting('lastChangeDay', today);
    if (S.settings.lastAutoSnap !== today) {
      M.setSetting('lastAutoSnap', today);
      setTimeout(function () { M.snapshot('نسخة يومية تلقائية').catch(function () {}); }, 2000);
    }
    folderSoon();
    if (!autoPhoneTried && S.settings.autoPhoneBackup !== false && M.phoneBackupDue() && !(M.hasFolderAPI && S.settings.folderHandle)) {
      autoPhoneTried = true;
      setTimeout(function () { if (M.phoneBackupDue()) M.phoneBackup().then(function () { M.toast('حُفظت نسخة اليوم في مجلد التنزيلات على جهازك', 'ok'); }); }, 4000);
    }
  };
  function wrap(name) {
    var orig = M[name]; if (!orig) return;
    M[name] = function () { var r = orig.apply(this, arguments); Promise.resolve(r).then(function () { M.onDataChange(); }).catch(function () {}); return r; };
  }
  ['save', 'remove', 'applyPack', 'importBankExcel', 'importAIJson'].forEach(wrap);

  /* ===== شريط الحماية في الرئيسية ===== */
  M.safetyBanner = function () {
    var out = '';
    if (M.hasFolderAPI && !M.isMobile() && !S.settings.folderHandle) {
      out += '<div class="alert info">' + I('lock') + '<div style="flex:1">اربط مجلداً على الكمبيوتر ليُحفظ فيه عملك تلقائياً بعد كل تعديل — حماية كاملة حتى لو مُسحت بيانات المتصفح.</div><button class="btn sm" data-safety="folder">اختيار المجلد</button></div>';
    }
    if (M.phoneBackupDue()) {
      out += '<div class="alert warn">' + I('download') + '<div style="flex:1">احفظ نسخة اليوم على جهازك (تُحفظ في مجلد التنزيلات Download) — تحميك لو مُسح التطبيق أو بيانات المتصفح.</div><button class="btn sm" data-safety="phone">حفظ نسخة اليوم</button></div>';
    }
    return out;
  };
  M.bindSafety = function (root) {
    M.qsa('[data-safety]', root).forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.safety === 'folder') M.pickFolder().then(M.render);
        if (b.dataset.safety === 'reconnect') M.reconnectFolder();
        if (b.dataset.safety === 'phone') M.phoneBackup().then(function () { M.toast('تم الحفظ في التنزيلات', 'ok'); M.render(); });
      };
    });
  };
  /* تنبيه ثابت أعلى الصفحة عند الحاجة لإعادة تفعيل المجلد */
  M.folderReconnectBar = function () {
    return M.folderState().then(function (st) {
      if (st !== 'prompt') return '';
      return '<div class="alert warn" style="margin:12px 24px 0">' + I('lock') + '<div style="flex:1">الحفظ التلقائي في مجلد «' + esc(S.settings.folderHandle.name) + '» متوقف لحين السماح.</div><button class="btn sm" data-safety="reconnect">تفعيل الآن</button></div>';
    });
  };

  /* ===== قسم الحماية في الإعدادات ===== */
  M.safetySettingsHTML = function (info, folderSt, snaps) {
    var pct = info.quota ? Math.round(info.usage / info.quota * 1000) / 10 : 0;
    var h = '<div class="card" id="safety-card"><h2 style="margin-bottom:10px">حماية البيانات</h2><div style="display:flex;flex-direction:column;gap:10px">';
    h += '<div class="row"><span class="chip ' + (info.persisted ? 'ok' : 'warn') + '">' + (info.persisted ? 'التخزين الدائم مفعّل' : 'التخزين الدائم غير مفعّل') + '</span><span class="small muted">' + (info.persisted ? 'المتصفح لن يمسح بيانات التطبيق تلقائياً عند امتلاء المساحة.' : 'ثبّت التطبيق على الشاشة الرئيسية ليُفعَّل تلقائياً.') + (info.usage ? ' المستخدم: ' + n((info.usage / 1048576).toFixed(1)) + ' ميجا (' + n(pct) + '٪)' : '') + '</span></div>';
    if (M.hasFolderAPI && !M.isMobile()) {
      var fh = S.settings.folderHandle;
      h += '<div class="row"><b>مجلد الحفظ التلقائي:</b>' + (fh ? '<span class="chip ' + (folderSt === 'granted' ? 'ok' : 'warn') + '">' + esc(fh.name) + (folderSt === 'granted' ? ' — يعمل' : ' — يحتاج تفعيل') + '</span>' : '<span class="chip">غير مربوط</span>') +
        (S.settings.lastFolderSave ? '<span class="small muted">آخر حفظ: ' + n(M.fmtDate(S.settings.lastFolderSave, true)) + '</span>' : '') + '<span class="grow" style="flex:1"></span>' +
        (fh && folderSt !== 'granted' ? '<button class="btn sm" data-safety="reconnect">تفعيل</button>' : '') + '<button class="btn sm" data-safety="folder">' + (fh ? 'تغيير المجلد' : 'اختيار المجلد') + '</button></div>' +
        '<div class="small muted">يُكتب بعد كل تعديل ملف «معيار-آخر-نسخة.miyar»، ومعه نسخة بتاريخ كل يوم. ضع المجلد داخل OneDrive أو Google Drive ليتزامن تلقائياً.</div>';
    } else {
      h += '<label class="check"><input type="checkbox" id="sf-auto"' + (S.settings.autoPhoneBackup !== false ? ' checked' : '') + '> نسخة يومية تلقائية إلى مجلد التنزيلات (Download) في أول تعديل كل يوم</label>' +
        '<div class="row"><span class="small muted">آخر نسخة على الجهاز: ' + (S.settings.lastPhoneBackup ? n(S.settings.lastPhoneBackup) : 'لم تُحفظ بعد') + '</span><button class="btn sm" data-safety="phone">حفظ نسخة الآن</button></div>';
    }
    h += '<div><b>النسخ الداخلية</b> <span class="small muted">— آخر ' + n(KEEP) + ' نسخة: يومية تلقائية، وقبل كل تحديث أو استرجاع أو دمج.</span></div>';
    h += snaps.length ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>الوقت</th><th>السبب</th><th>الإصدار</th><th>الأسئلة</th><th></th></tr></thead><tbody>' + snaps.map(function (s) {
      return '<tr><td class="small">' + n(M.fmtDate(s.at, true)) + '</td><td>' + esc(s.reason) + '</td><td>' + esc(s.version || '') + '</td><td>' + n(s.questions || 0) + '</td><td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-snapdl="' + s.id + '">' + I('download', 16) + '</button><button class="btn sm" data-snaprs="' + s.id + '">استرجاع</button></div></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="small muted">لا توجد نسخ داخلية بعد.</div>';
    h += '<div class="row"><button class="btn sm" id="sf-snap">' + I('copy', 16) + ' أخذ نسخة داخلية الآن</button></div></div></div>';
    return h;
  };
  M.bindSafetySettings = function (root, snaps) {
    M.bindSafety(root);
    var a = M.qs('#sf-auto', root); if (a) a.onchange = function () { M.setSetting('autoPhoneBackup', a.checked); };
    var sn = M.qs('#sf-snap', root); if (sn) sn.onclick = function () { M.snapshot('يدوية').then(function () { M.toast('تم أخذ نسخة داخلية', 'ok'); M.render(); }); };
    M.qsa('[data-snapdl]', root).forEach(function (b) { b.onclick = function () { var s = snaps.find(function (x) { return x.id === b.dataset.snapdl; }); M.download('معيار-نسخة-' + s.at.slice(0, 10) + '.miyar', new Blob([s.text])); }; });
    M.qsa('[data-snaprs]', root).forEach(function (b) {
      b.onclick = function () {
        M.confirm('استرجاع نسخة داخلية', 'سيتم استبدال البيانات الحالية بهذه النسخة (تُحفظ نسخة من الحالي أولاً).', 'استرجاع', true).then(function (ok) {
          if (ok) M.restoreSnapshot(b.dataset.snaprs).then(function () { M.toast('تم الاسترجاع', 'ok'); M.render(); }).catch(function (e) { M.toast(e.message, 'bad'); });
        });
      };
    });
  };
})(window.M);
