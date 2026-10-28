/* الإرسال والتجميع + وثائق الجودة */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;

  /* ===== الإرسال / التجميع ===== */
  M.views.merge = function (main) {
    var admin = M.role() === 'admin';
    var since = S.settings.lastPackAt;
    var changedSince = since ? S.questions.filter(function (q) { return q.updatedAt > since; }).length : S.questions.length;
    var hist = S.packs.slice(0, 50).map(function (p) {
      return '<tr><td class="small" style="white-space:nowrap">' + n(M.fmtDate(p.at, true)) + '</td><td>' + esc((p.from && p.from.name) || '—') + '<div class="small muted">' + esc(M.ROLES[(p.from || {}).role] || '') + '</div></td><td>' + esc(p.fileName || '') + '</td>' +
        '<td>' + n(p.added) + '</td><td>' + n(p.updated) + '</td><td>' + n(p.dup) + '</td><td>' + n(p.conflicts) + '</td><td>' + (p.intact ? '<span class="chip ok">سليمة</span>' : '<span class="chip bad">بصمة غير مطابقة</span>') + '</td></tr>';
    }).join('');
    main.innerHTML = M.topbar(admin ? 'تجميع حزم المدرسين' : 'إرسال للأدمن', admin ? 'استيراد الحزم وفحصها ودمجها في بنك المدرسة' : 'حزمة ملف واحد تُرسل بالواتساب أو البريد أو الفلاشة') +
      '<div class="content">' +
      (!admin ? '<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center"><div style="flex:1;min-width:240px"><h2>إرسال عملك</h2><div class="muted small">الحزمة تحتوي المنهج والأسئلة والامتحانات على هذا الجهاز، ومعها بصمة تكشف أي تعديل أو تلف. ' + (since ? 'آخر إرسال: ' + n(M.fmtDate(since, true)) + ' · تغيّر بعده ' + n(changedSince) + ' سؤال.' : 'لم ترسل حزمة بعد.') + '</div></div>' +
        '<button class="btn pri" id="mg-send">' + I('send') + ' تصدير وإرسال الحزمة</button></div>' : '') +
      '<div class="drop" id="mg-drop" tabindex="0" role="button" aria-label="اختيار ملفات الحزم">' + I('merge', 34) + '<div><div class="bold">' + (admin ? 'اسحب ملفات الحزم هنا أو اضغط للاختيار' : 'استلام حزمة من الأدمن (ملاحظات أو بنك محدّث)') + '</div><div class="small muted">ملفات ‎.miyar‎ — يتم فحص البصمة والتكرار والتعارض قبل أي دمج، ولا يُحذف شيء.</div></div></div>' +
      '<div id="mg-result"></div>' +
      (admin && S.packs.length ? '<div class="card flat"><div style="padding:14px 16px"><h2>سجل الحزم المستلمة</h2></div><div class="scroll-x"><table class="tbl"><thead><tr><th>الوقت</th><th>المرسل</th><th>الملف</th><th>جديد</th><th>محدّث</th><th>مكرر</th><th>تعارض</th><th>الفحص</th></tr></thead><tbody>' + hist + '</tbody></table></div></div>' : '') +
      (admin ? '<div class="card"><h2 style="margin-bottom:8px">إرسال البنك المجمّع</h2><p class="small muted" style="margin:0 0 10px">لإرجاع ملاحظات المراجعة أو البنك المحدّث للمدرسين بنفس الطريقة.</p><button class="btn" id="mg-send">' + I('send') + ' تصدير حزمة</button></div>' : '') +
      '</div>';
    M.qs('#mg-send', main).onclick = function () { M.exportPack().then(function () { M.toast('تم تجهيز الحزمة', 'ok'); }); };
    var drop = M.qs('#mg-drop', main);
    var handle = function (files) { files = files.filter(function (f) { return /\.(miyar|json)$/i.test(f.name); }); if (!files.length) return M.toast('اختر ملفات ‎.miyar‎', 'bad'); processFiles(files, 0); };
    drop.onclick = function () { M.pickFile('.miyar,.json', true).then(handle); };
    drop.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); drop.click(); } };
    drop.ondragover = function (ev) { ev.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = function () { drop.classList.remove('over'); };
    drop.ondrop = function (ev) { ev.preventDefault(); drop.classList.remove('over'); handle(Array.prototype.slice.call(ev.dataTransfer.files)); };

    function processFiles(files, i) {
      if (i >= files.length) { M.render(); return; }
      var f = files[i];
      M.readFile(f).then(M.parsePack).then(function (p) {
        if (p.kind === 'backup') { M.toast('«' + f.name + '» نسخة احتياطية — تُستعاد من الإعدادات', 'bad'); return processFiles(files, i + 1); }
        var an = M.analyzePack(p);
        showAnalysis(f.name, p, an, function () { processFiles(files, i + 1); });
      }).catch(function (e) { M.toast(f.name + ': ' + e.message, 'bad'); processFiles(files, i + 1); });
    }

    function label(x) {
      var r = x.inc;
      if (x.store === 'questions') return M.TYPE[r.type] ? M.TYPE[r.type].label + ': ' + String(r.text || (r.pairs || []).map(function (p) { return p.a; }).join('، ')).slice(0, 80) : '';
      return ({ subjects: 'مادة', units: 'وحدة', lessons: 'درس', outcomes: 'ناتج', exams: 'امتحان' }[x.store] || '') + ': ' + (r.name || r.title || r.code || r.text || '');
    }

    function showAnalysis(name, p, an, next) {
      var cnt = function (arr, store) { return arr.filter(function (x) { return x.store === store; }).length; };
      var body = (p.intact ? '<div class="alert ok">' + I('check') + '<div>البصمة مطابقة — الملف سليم ولم يُعدّل.</div></div>' : '<div class="alert bad">' + I('warn') + '<div>بصمة الملف لا تطابق محتواه: قد يكون تالفاً أو عُدّل يدوياً. راجعه قبل الدمج.</div></div>') +
        '<div class="small muted">من: <b>' + esc((p.from && p.from.name) || '—') + '</b> (' + esc(M.ROLES[(p.from || {}).role] || '') + ') · ' + n(M.fmtDate(p.createdAt, true)) + '</div>' +
        '<table class="tbl"><thead><tr><th></th><th>أسئلة</th><th>منهج وامتحانات</th></tr></thead><tbody>' +
        '<tr><td>جديد</td><td>' + n(cnt(an.new, 'questions')) + '</td><td>' + n(an.new.length - cnt(an.new, 'questions')) + '</td></tr>' +
        '<tr><td>محدّث (أحدث من الموجود)</td><td>' + n(cnt(an.update, 'questions')) + '</td><td>' + n(an.update.length - cnt(an.update, 'questions')) + '</td></tr>' +
        '<tr><td>مكرر أو مشابه جداً لسؤال موجود</td><td>' + n(an.dup.length) + '</td><td>—</td></tr>' +
        '<tr><td>تعارض (عُدّل هنا وهناك)</td><td colspan="2">' + n(an.conflict.length) + '</td></tr>' +
        '<tr><td>مطابق / أقدم (يُتجاهل)</td><td colspan="2">' + n(an.same + an.older) + '</td></tr></tbody></table>';
      if (an.dup.length) body += '<details><summary class="bold" style="cursor:pointer">عرض المكرر (' + n(an.dup.length) + ')</summary><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' + an.dup.map(function (d) { return '<div class="item-row"><div class="qt">' + M.qText(d.inc) + '<div class="small muted" style="font-family:Plex Arabic">يشبه الموجود: ' + M.qText(d.local) + '</div></div></div>'; }).join('') + '</div></details>' +
        '<label class="check"><input type="checkbox" id="an-dup"> دمج المكرر أيضاً</label>';
      if (an.conflict.length) body += '<h3>التعارضات — اختر لكل عنصر</h3>' + an.conflict.map(function (c, i) {
        return '<div class="card" style="padding:10px"><div class="small bold">' + esc(label(c)) + '</div><div class="grid2" style="margin-top:6px"><div class="small"><b>الموجود هنا</b> (' + n(M.fmtDate(c.local.updatedAt, true)) + ' · ' + esc(c.local.updatedByName || '') + ')<div class="qt" style="font-family:Naskh">' + (c.store === 'questions' ? M.qText(c.local) : esc(c.local.name || c.local.title || '')) + '</div></div>' +
          '<div class="small"><b>الوارد</b> (' + n(M.fmtDate(c.inc.updatedAt, true)) + ' · ' + esc(c.inc.updatedByName || '') + ')<div class="qt" style="font-family:Naskh">' + (c.store === 'questions' ? M.qText(c.inc) : esc(c.inc.name || c.inc.title || '')) + '</div></div></div>' +
          '<div class="seg" data-cf="' + i + '" style="margin-top:6px"><button type="button" data-v="0" class="on">الإبقاء على الموجود</button><button type="button" data-v="1">أخذ الوارد</button></div></div>';
      }).join('');
      var total = an.new.length + an.update.length + an.conflict.length + an.dup.length;
      M.modal({ title: 'فحص الحزمة — ' + name, wide: true, body: body,
        foot: total ? '<button class="btn pri" data-ok>' + I('merge') + ' دمج</button><button class="btn" data-x>تخطي هذه الحزمة</button>' : '<button class="btn pri" data-x>لا جديد — إغلاق</button>',
        onMount: function (m, close) {
          M.qsa('[data-cf]', m).forEach(function (sg) { M.qsa('button', sg).forEach(function (b) { b.onclick = function () { an.conflict[+sg.dataset.cf].take = b.dataset.v === '1'; M.qsa('button', sg).forEach(function (x) { x.classList.toggle('on', x === b); }); }; }); });
          var ok = M.qs('[data-ok]', m);
          if (ok) ok.onclick = function () {
            var inc = M.qs('#an-dup', m);
            M.snapshot('قبل دمج حزمة ' + name).catch(function () {}).then(function () { return M.applyPack(p, an, { includeDup: inc && inc.checked, fileName: name }); }).then(function (c) { close(); M.toast('دُمج ' + n(c) + ' عنصر من «' + name + '»', 'ok'); });
          };
        },
        onClose: function () { setTimeout(next, 50); } });
    }
  };

  /* ===== وثائق الجودة ===== */
  M.views.docs = function (main) {
    var admin = M.can('docs');
    var list = S.docs.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    var rows = list.map(function (d) {
      return '<tr><td><b>' + esc(d.name) + '</b><div class="small muted">' + esc(M.DOC_TYPES[d.type] || '') + '</div></td><td><span class="p-code">' + esc(d.code) + '</span></td><td>' + n(d.version) + '</td><td>' + n(M.fmtDate(d.issueDate)) + '</td>' +
        '<td class="small">' + esc(d.preparedBy || '—') + ' / ' + esc(d.reviewedBy || '—') + ' / ' + esc(d.approvedBy || '—') + '</td>' +
        '<td>' + (d.active !== false ? '<span class="chip ok">سارية</span>' : '<span class="chip">موقوفة</span>') + '</td>' +
        '<td><div class="row" style="gap:4px;flex-wrap:nowrap">' + (d.file ? '<button class="btn sm" data-dl="' + d.id + '">' + I('download', 16) + ' الملف</button>' : '') + (admin ? '<button class="btn sm" data-ed="' + d.id + '">' + I('edit', 16) + '</button>' : '') + '</div></td></tr>';
    }).join('');
    main.innerHTML = M.topbar('وثائق الجودة', 'المعلومات الموثقة — تظهر بيانات الوثيقة السارية في ترويسة كل مخرج', admin ? '<button class="btn pri" id="dc-new">' + I('plus') + ' وثيقة</button>' : '') +
      '<div class="content">' + (!admin ? '<div class="alert info">' + I('lock') + '<div>إضافة الوثائق وتعديلها لمدير النظام فقط.</div></div>' : '') +
      (rows ? '<div class="card flat"><div class="scroll-x"><table class="tbl"><thead><tr><th>الوثيقة</th><th>الكود</th><th>الإصدار</th><th>تاريخ الإصدار</th><th>إعداد / مراجعة / اعتماد</th><th>الحالة</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : '<div class="empty">لم تُسجّل وثائق بعد. أضف وثيقة «ورقة امتحان» و«بنك أسئلة» و«جدول مواصفات» بالأسماء والأكواد المعتمدة لديكم.</div>') + '</div>';
    var nb = M.qs('#dc-new', main); if (nb) nb.onclick = function () { editDoc(null); };
    M.qsa('[data-ed]', main).forEach(function (b) { b.onclick = function () { editDoc(M.byId('docs', b.dataset.ed)); }; });
    M.qsa('[data-dl]', main).forEach(function (b) { b.onclick = function () { var d = M.byId('docs', b.dataset.dl); fetch(d.file).then(function (r) { return r.blob(); }).then(function (bl) { M.download(d.fileName || (d.code + '.pdf'), bl); }); }; });

    function editDoc(d) {
      var isNew = !d;
      d = d ? JSON.parse(JSON.stringify(d)) : { name: '', code: '', version: '01', issueDate: M.today(), type: 'exam', preparedBy: '', reviewedBy: '', approvedBy: '', active: true, history: [] };
      var hist = (d.history || []).map(function (h) { return '<tr><td>' + n(h.version) + '</td><td>' + n(M.fmtDate(h.issueDate)) + '</td><td>' + n(M.fmtDate(h.archivedAt, true)) + '</td><td class="small">' + esc(h.note || '') + '</td></tr>'; }).join('');
      M.modal({ title: isNew ? 'وثيقة جديدة' : 'تعديل الوثيقة', wide: true,
        body: '<div class="grid2"><div class="field"><label for="d-n">اسم الوثيقة</label><input id="d-n" class="inp" value="' + esc(d.name) + '"></div>' +
          '<div class="field"><label for="d-t">النوع (أين تُستخدم)</label><select id="d-t" class="inp">' + Object.keys(M.DOC_TYPES).map(function (k) { return '<option value="' + k + '"' + (k === d.type ? ' selected' : '') + '>' + M.DOC_TYPES[k] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="d-c">كود الوثيقة</label><input id="d-c" class="inp" dir="ltr" style="text-align:right" value="' + esc(d.code) + '"></div>' +
          '<div class="field"><label for="d-v">رقم الإصدار</label><input id="d-v" class="inp" value="' + esc(d.version) + '"' + (isNew ? '' : ' disabled') + '></div>' +
          '<div class="field"><label for="d-i">تاريخ الإصدار</label><input id="d-i" class="inp" type="date" value="' + esc(String(d.issueDate || '').slice(0, 10)) + '"' + (isNew ? '' : ' disabled') + '></div>' +
          '<label class="check" style="align-self:end"><input type="checkbox" id="d-a"' + (d.active !== false ? ' checked' : '') + '> سارية</label>' +
          '<div class="field"><label for="d-p">إعداد</label><input id="d-p" class="inp" value="' + esc(d.preparedBy) + '"></div>' +
          '<div class="field"><label for="d-r">مراجعة</label><input id="d-r" class="inp" value="' + esc(d.reviewedBy) + '"></div>' +
          '<div class="field"><label for="d-ap">اعتماد</label><input id="d-ap" class="inp" value="' + esc(d.approvedBy) + '"></div></div>' +
          '<div class="field"><span class="lbl">نسخة الوثيقة (PDF أو Word) — اختياري</span><div class="row"><span class="small" id="d-fn">' + esc(d.fileName || 'لا يوجد ملف') + '</span><button type="button" class="btn sm" id="d-f">رفع ملف</button></div></div>' +
          (!isNew ? '<div class="card" style="padding:12px"><div class="row"><b style="flex:1">إصدار جديد</b><button type="button" class="btn sm" id="d-bump">رفع الإصدار</button></div><div class="small muted">يحفظ الإصدار الحالي في السجل ويبدأ إصداراً جديداً بتاريخ اليوم.</div>' +
            (hist ? '<table class="tbl" style="margin-top:8px"><thead><tr><th>الإصدار السابق</th><th>تاريخه</th><th>أُرشف في</th><th>سبب التعديل</th></tr></thead><tbody>' + hist + '</tbody></table>' : '') + '</div>' : ''),
        foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" data-x>إلغاء</button>' + (!isNew ? '<button class="btn danger" id="d-del">حذف</button>' : ''),
        onMount: function (m, close) {
          M.qs('#d-f', m).onclick = function () {
            M.pickFile('.pdf,.doc,.docx,image/*').then(function (f) {
              if (!f[0]) return;
              if (f[0].size > 8 * 1024 * 1024) return M.toast('الملف أكبر من ٨ ميجا', 'bad');
              M.readFile(f[0], 'dataurl').then(function (u) { d.file = u; d.fileName = f[0].name; M.qs('#d-fn', m).textContent = f[0].name; });
            });
          };
          var bump = M.qs('#d-bump', m);
          if (bump) bump.onclick = function () {
            M.prompt('رفع الإصدار', 'سبب التعديل', '').then(function (note) {
              if (note == null) return;
              d.history = (d.history || []).concat([{ version: d.version, issueDate: d.issueDate, archivedAt: M.now(), note: note }]);
              var v = String(d.version), num = parseInt(M.toWestern(v), 10);
              d.version = isFinite(num) ? String(num + 1).padStart(v.length, '0') : v + '.1';
              d.issueDate = M.today();
              M.qs('#d-v', m).value = d.version; M.qs('#d-i', m).value = d.issueDate;
              M.toast('سيُحفظ الإصدار ' + d.version + ' عند الضغط على حفظ');
            });
          };
          M.qs('[data-ok]', m).onclick = function () {
            d.name = M.qs('#d-n', m).value.trim(); d.code = M.qs('#d-c', m).value.trim();
            if (!d.name || !d.code) return M.toast('الاسم والكود مطلوبان', 'bad');
            d.type = M.qs('#d-t', m).value; d.active = M.qs('#d-a', m).checked;
            if (isNew) { d.version = M.qs('#d-v', m).value.trim() || '01'; d.issueDate = M.qs('#d-i', m).value || M.today(); }
            d.preparedBy = M.qs('#d-p', m).value.trim(); d.reviewedBy = M.qs('#d-r', m).value.trim(); d.approvedBy = M.qs('#d-ap', m).value.trim();
            M.save('docs', d).then(function () { close(); M.toast('تم حفظ الوثيقة', 'ok'); M.render(); });
          };
          var del = M.qs('#d-del', m);
          if (del) del.onclick = function () {
            var used = S.exams.filter(function (x) { return x.docId === d.id; }).length;
            if (used) return M.toast('الوثيقة مستخدمة في ' + n(used) + ' امتحان — أوقفها بدلاً من حذفها', 'bad');
            M.confirm('حذف الوثيقة', 'حذف «' + d.name + '»؟', 'حذف', true).then(function (ok) { if (ok) { close(); M.remove('docs', d.id).then(M.render); } });
          };
        } });
    }
  };
})(window.M);
