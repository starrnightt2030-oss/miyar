/* الامتحانات: القائمة + توليد النماذج + المحرر بالمعاينة الحية */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;

  var EXAM_TITLES = ['امتحان نهاية الفصل الدراسي الأول', 'امتحان نهاية الفصل الدراسي الثاني', 'امتحان شهر أكتوبر', 'امتحان شهر نوفمبر', 'امتحان شهر فبراير', 'امتحان شهر مارس', 'اختبار قصير', 'امتحان الدور الثاني', 'نموذج استرشادي'];

  M.newExam = function (subjectId) {
    var sub = M.byId('subjects', subjectId) || {};
    return { id: M.uid(), subjectId: subjectId, title: EXAM_TITLES[0], className: sub.className || '', specialization: sub.specialization || '', year: S.settings.year, duration: 'ساعتان', totalGrade: '',
      docId: (M.docFor('exam') || {}).id || '', digits: S.settings.digits || 'arabic', lang: 'ar', paper: 'a4', fontSize: 14, color: '#1F2A44', compact: false, separator: 'none',
      showStudent: true, showGradeTable: true, showInstructions: true, showSign: true, instructions: 'أجب عن جميع الأسئلة في نفس الورقة.', shuffleOptions: false,
      sections: [], local: {}, mode: 'bank', examDate: '', footerNote: S.settings.footerNote != null ? S.settings.footerNote : 'مع أطيب التمنيات بالنجاح والتوفيق',
      status: 'draft', model: '', groupId: '', scopeLessonIds: [], shuffleSeed: M.uid(), preparedBy: M.me().name || '' };
  };

  /* ===== القائمة ===== */
  M.views.exams = function (main) {
    var list = S.exams.slice().sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    var groups = [], seen = {};
    list.forEach(function (e) {
      var k = e.groupId || e.id;
      if (!seen[k]) { seen[k] = { key: k, exams: [] }; groups.push(seen[k]); }
      seen[k].exams.push(e);
    });
    var rows = groups.map(function (g) {
      g.exams.sort(function (a, b) { return String(a.model).localeCompare(String(b.model), 'ar'); });
      var e0 = g.exams[0], sub = M.byId('subjects', e0.subjectId);
      return '<div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center"><div style="flex:1;min-width:220px"><b>' + esc(e0.title || 'امتحان') + '</b><div class="small muted">مادة ' + esc(sub ? sub.name : '') + ' · ' + esc(e0.className || '') + ' · ' + n(M.fmtDate(e0.updatedAt)) + '</div></div>' +
        '<div class="row" style="gap:6px">' + g.exams.map(function (e) {
          return '<a class="btn sm" href="#/exam/' + e.id + '">' + (e.model ? 'نموذج ' + esc(e.model) : 'فتح') + ' ' + (e.status === 'approved' ? '<span class="chip ok">معتمد</span>' : '<span class="chip warn">مسودة</span>') + '</a>';
        }).join('') + '</div></div>';
    }).join('');
    main.innerHTML = M.topbar('الامتحانات', n(list.length) + ' ورقة', '<button class="btn pri" id="ex-new">' + I('plus') + ' امتحان جديد</button>') +
      '<div class="content">' + (rows || '<div class="empty">لا توجد امتحانات بعد — اضغط «امتحان جديد» واختر: من بنك الأسئلة أو كتابة يدوية.</div>') + '</div>';
    M.qs('#ex-new', main).onclick = function () { M.newExamWizard(); };
  };

  /* ===== معالج امتحان جديد: من البنك (تلقائي أو اختيار يدوي) أو كتابة يدوية ===== */
  M.newExamWizard = function (preMode) {
    var mode = preMode || '';
    var subjOpts = S.subjects.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + (s.className ? ' — ' + esc(s.className) : '') + '</option>'; }).join('');
    var card = function (k, icon, t, d) { return '<button type="button" class="path-card' + (mode === k ? ' on' : '') + '" data-mode="' + k + '"><span class="pc-ic">' + I(icon, 26) + '</span><b>' + t + '</b><span>' + d + '</span></button>'; };
    M.modal({ title: 'امتحان جديد', wide: true,
      body: '<div class="path-grid">' +
        card('auto', 'spark', 'من البنك — تلقائياً', 'حدّد الدروس وهيكل الورقة، ويولّد التطبيق حتى ٣ نماذج متكافئة من الأسئلة المعتمدة') +
        card('bank', 'bank', 'من البنك — أختار بنفسي', 'أضيف الأسئلة الرئيسية وأختار فروعها من البنك، وأتحكم في الدرجات والترتيب') +
        card('manual', 'edit', 'يدوي — أكتب الأسئلة', 'أختار نوع كل سؤال وأكتبه مباشرة في الورقة (فرع واحد أو أجزاء أ، ب)، مع الرسومات والدرجات') + '</div>' +
        '<div id="nw-sub" class="grid2" style="margin-top:14px;display:none"><div class="field"><label for="nw-s">المادة</label><select id="nw-s" class="inp">' + subjOpts + '<option value="__other">مادة أخرى — أكتب اسمها</option></select></div>' +
        '<div class="field" id="nw-on-f" style="display:none"><label for="nw-on">اسم المادة</label><input id="nw-on" class="inp"></div>' +
        '<div class="field"><label for="nw-t">اسم الامتحان</label><input id="nw-t" class="inp" list="nw-tl" value="' + esc(EXAM_TITLES[0]) + '"><datalist id="nw-tl">' + EXAM_TITLES.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div></div>',
      foot: '<button class="btn pri" data-ok disabled>متابعة</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var ok = M.qs('[data-ok]', m), sub = M.qs('#nw-sub', m), sel = M.qs('#nw-s', m);
        var sync = function () {
          M.qsa('[data-mode]', m).forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
          sub.style.display = mode && mode !== 'auto' ? '' : 'none';
          M.qs('#nw-on-f', m).style.display = sel.value === '__other' ? '' : 'none';
          ok.disabled = !mode; ok.textContent = mode === 'auto' ? 'متابعة إلى التوليد' : 'إنشاء الامتحان';
        };
        if (!S.subjects.length) sel.value = '__other';
        M.qsa('[data-mode]', m).forEach(function (b) { b.onclick = function () { mode = b.dataset.mode; if (mode === 'auto' && !S.subjects.length) { M.toast('التوليد التلقائي يحتاج مادة وأسئلة معتمدة في البنك', 'bad'); mode = ''; } sync(); }; });
        sel.onchange = sync; sync();
        ok.onclick = function () {
          if (mode === 'auto') { close(); M.go('#/gen'); return; }
          var sid = sel.value === '__other' ? '' : sel.value, sname = M.qs('#nw-on', m).value.trim();
          if (!sid && !sname) return M.toast('اختر المادة أو اكتب اسمها', 'bad');
          var e = M.newExam(sid); e.mode = mode; e.title = M.qs('#nw-t', m).value.trim() || e.title;
          if (!sid) e.subjectName = sname;
          e.sections = [];
          M.save('exams', e).then(function () { close(); M.go('#/exam/' + e.id + '?step=questions'); });
        };
      } });
  };

  /* ===== توليد النماذج ===== */
  var BP_DEFAULT = [{ type: 'mcq', count: 5, itemGrade: 1 }, { type: 'tf', count: 5, itemGrade: 1 }, { type: 'complete', count: 4, itemGrade: 1 }, { type: 'reason', count: 2, itemGrade: 2 }, { type: 'essay', count: 1, itemGrade: 4 }];

  M.views.gen = function (main, r) {
    var subjects = S.subjects;
    if (!subjects.length) { main.innerHTML = M.topbar('توليد نماذج استرشادية', '', '', '#/exams') + '<div class="content"><div class="empty">أضف مادة وأسئلة معتمدة أولاً.</div></div>'; return; }
    var st = {
      subjectId: r.q.s || (M.lessonPath(r.q.l).subject || {}).id || subjects[0].id,
      lessonIds: [], models: 3,
      bp: JSON.parse(JSON.stringify(S.settings.lastBlueprint || BP_DEFAULT)),
      meta: { title: EXAM_TITLES[0], duration: 'ساعتان', docId: (M.docFor('exam') || {}).id || '' }
    };
    function initScope() {
      if (r.q.l) st.lessonIds = [r.q.l];
      else if (r.q.u) st.lessonIds = M.lessonsOf(r.q.u).map(function (l) { return l.id; });
      else st.lessonIds = M.lessonsOfSubject(st.subjectId).filter(function (l) { var u = M.byId('units', l.unitId); return u && Number(u.term) === 1; }).map(function (l) { return l.id; });
      if (!st.lessonIds.length) st.lessonIds = M.lessonsOfSubject(st.subjectId).map(function (l) { return l.id; });
    }
    initScope();

    function avail(type) { return S.questions.filter(function (q) { return q.type === type && q.status === 'approved' && st.lessonIds.indexOf(q.lessonId) >= 0; }).length; }

    function draw() {
      var units = M.unitsOf(st.subjectId);
      var scope = [1, 2].map(function (term) {
        var us = units.filter(function (u) { return Number(u.term) === term; }); if (!us.length) return '';
        return '<div style="margin-bottom:8px"><label class="check bold"><input type="checkbox" data-term="' + term + '"' + (us.every(function (u) { return M.lessonsOf(u.id).every(function (l) { return st.lessonIds.indexOf(l.id) >= 0; }); }) ? ' checked' : '') + '> ' + M.termLabel(term) + ' كاملاً</label>' +
          us.map(function (u) {
            var ls = M.lessonsOf(u.id);
            return '<div style="padding-inline-start:20px"><label class="check" style="font-weight:600"><input type="checkbox" data-unit="' + u.id + '"' + (ls.length && ls.every(function (l) { return st.lessonIds.indexOf(l.id) >= 0; }) ? ' checked' : '') + '> ' + esc(u.name) + '</label>' +
              '<div style="padding-inline-start:24px;display:flex;flex-wrap:wrap;gap:4px 14px">' + ls.map(function (l) {
                var c = S.questions.filter(function (q) { return q.lessonId === l.id && q.status === 'approved'; }).length;
                return '<label class="check small"><input type="checkbox" data-les="' + l.id + '"' + (st.lessonIds.indexOf(l.id) >= 0 ? ' checked' : '') + '> ' + esc(l.name) + ' <span class="muted">(' + n(c) + ' معتمد · ' + n(l.periods) + ' حصة)</span></label>';
              }).join('') + '</div></div>';
          }).join('') + '</div>';
      }).join('');
      var bpRows = st.bp.map(function (b, i) {
        var a = avail(b.type), need = b.count * st.models;
        return '<tr><td><select class="inp" data-bt="' + i + '" aria-label="النوع">' + M.TYPES.map(function (t) { return '<option value="' + t.id + '"' + (t.id === b.type ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="inp" style="width:80px" inputmode="numeric" data-bc="' + i + '" value="' + n(b.count) + '" aria-label="عدد الفروع"></td>' +
          '<td><input class="inp" style="width:80px" inputmode="decimal" data-bg="' + i + '" value="' + n(b.itemGrade) + '" aria-label="درجة الفرع"></td>' +
          '<td><b>' + n(b.count * b.itemGrade) + '</b></td>' +
          '<td><span class="chip ' + (a >= need ? 'ok' : a >= b.count ? 'warn' : 'bad') + '">' + n(a) + ' متاح / ' + n(need) + ' مطلوب</span></td>' +
          '<td><button class="btn icon ghost" data-bdel="' + i + '" aria-label="حذف">' + I('trash', 16) + '</button></td></tr>';
      }).join('');
      var total = st.bp.reduce(function (s, b) { return s + b.count * b.itemGrade; }, 0);
      var docs = S.docs.filter(function (d) { return d.type === 'exam'; });
      main.innerHTML = M.topbar('توليد نماذج استرشادية', 'من الأسئلة المعتمدة فقط · بنفس التنسيق وأسئلة مختلفة', '', '#/exams') +
        '<div class="content"><div class="card"><h2 style="margin-bottom:12px">١. المادة والنطاق</h2>' +
        '<div class="field" style="max-width:360px"><label for="g-s">المادة</label><select id="g-s" class="inp">' + subjects.map(function (s) { return '<option value="' + s.id + '"' + (s.id === st.subjectId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></div>' +
        '<div style="margin-top:12px" id="g-scope">' + (scope || '<div class="empty">لا توجد وحدات في هذه المادة</div>') + '</div></div>' +
        '<div class="card"><h2 style="margin-bottom:12px">٢. بيانات الورقة</h2><div class="grid3">' +
        '<div class="field"><label for="g-t">اسم الامتحان</label><input id="g-t" class="inp" list="g-tl" value="' + esc(st.meta.title) + '"><datalist id="g-tl">' + EXAM_TITLES.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label for="g-d">الزمن</label><input id="g-d" class="inp" value="' + esc(st.meta.duration) + '"></div>' +
        '<div class="field"><label for="g-doc">وثيقة الجودة</label><select id="g-doc" class="inp"><option value="">— بدون —</option>' + docs.map(function (d) { return '<option value="' + d.id + '"' + (d.id === st.meta.docId ? ' selected' : '') + '>' + esc(d.name + ' (' + d.code + ' — إصدار ' + d.version + ')') + '</option>'; }).join('') + '</select></div></div></div>' +
        '<div class="card"><div class="card-h"><h2 class="grow">٣. هيكل الورقة</h2><span class="chip">الدرجة الكلية: <b>' + n(total) + '</b></span></div><div class="scroll-x"><table class="tbl"><thead><tr><th>نوع السؤال</th><th>عدد الفروع</th><th>درجة الفرع</th><th>درجة السؤال</th><th>البنك</th><th></th></tr></thead><tbody>' + bpRows + '</tbody></table></div>' +
        '<button class="btn sm" id="g-add" style="margin-top:10px">' + I('plus', 16) + ' سؤال</button>' +
        '<div class="small muted" style="margin-top:10px">التوزيع على الدروس حسب عدد الحصص، وعلى المستويات المعرفية حسب النسب في الإعدادات (' + (S.settings.levelTargets || []).map(function (x, i) { return M.LEVELS[i] + ' ' + n(x) + '٪'; }).join('، ') + '). لا يتكرر سؤال بين النماذج.</div></div>' +
        '<div class="card"><h2 style="margin-bottom:12px">٤. عدد النماذج</h2><div class="seg" id="g-m">' + [1, 2, 3].map(function (k) { return '<button type="button" data-v="' + k + '" class="' + (st.models === k ? 'on' : '') + '">' + (k === 1 ? 'نموذج واحد' : n(k) + ' نماذج') + '</button>'; }).join('') + '</div></div>' +
        '<div class="row"><button class="btn pri" id="g-go">' + I('spark') + ' توليد</button></div></div>';
      bind();
    }
    function readMeta() { st.meta.title = M.qs('#g-t', main).value.trim(); st.meta.duration = M.qs('#g-d', main).value.trim(); st.meta.docId = M.qs('#g-doc', main).value; }
    function bind() {
      M.qs('#g-s', main).onchange = function (e) { readMeta(); st.subjectId = e.target.value; r.q = {}; initScope(); draw(); };
      M.qsa('[data-les]', main).forEach(function (c) { c.onchange = function () { readMeta(); var id = c.dataset.les; if (c.checked) { if (st.lessonIds.indexOf(id) < 0) st.lessonIds.push(id); } else st.lessonIds = st.lessonIds.filter(function (x) { return x !== id; }); draw(); }; });
      M.qsa('[data-unit]', main).forEach(function (c) { c.onchange = function () { readMeta(); var ids = M.lessonsOf(c.dataset.unit).map(function (l) { return l.id; }); st.lessonIds = st.lessonIds.filter(function (x) { return ids.indexOf(x) < 0; }); if (c.checked) st.lessonIds = st.lessonIds.concat(ids); draw(); }; });
      M.qsa('[data-term]', main).forEach(function (c) { c.onchange = function () { readMeta(); var ids = []; M.unitsOf(st.subjectId).filter(function (u) { return Number(u.term) === Number(c.dataset.term); }).forEach(function (u) { ids = ids.concat(M.lessonsOf(u.id).map(function (l) { return l.id; })); }); st.lessonIds = st.lessonIds.filter(function (x) { return ids.indexOf(x) < 0; }); if (c.checked) st.lessonIds = st.lessonIds.concat(ids); draw(); }; });
      M.qsa('[data-bt]', main).forEach(function (s) { s.onchange = function () { readMeta(); st.bp[+s.dataset.bt].type = s.value; draw(); }; });
      M.qsa('[data-bc]', main).forEach(function (s) { s.onchange = function () { readMeta(); st.bp[+s.dataset.bc].count = Math.max(1, Number(M.toWestern(s.value)) || 1); draw(); }; });
      M.qsa('[data-bg]', main).forEach(function (s) { s.onchange = function () { readMeta(); st.bp[+s.dataset.bg].itemGrade = Math.max(0.25, Number(M.toWestern(s.value)) || 1); draw(); }; });
      M.qsa('[data-bdel]', main).forEach(function (b) { b.onclick = function () { readMeta(); st.bp.splice(+b.dataset.bdel, 1); draw(); }; });
      M.qs('#g-add', main).onclick = function () { readMeta(); st.bp.push({ type: 'mcq', count: 4, itemGrade: 1 }); draw(); };
      M.qsa('#g-m button', main).forEach(function (b) { b.onclick = function () { readMeta(); st.models = Number(b.dataset.v); draw(); }; });
      M.qs('#g-go', main).onclick = function () {
        readMeta();
        if (!st.lessonIds.length) return M.toast('اختر درساً واحداً على الأقل', 'bad');
        if (!st.bp.length) return M.toast('أضف سؤالاً واحداً على الأقل لهيكل الورقة', 'bad');
        var sub = M.byId('subjects', st.subjectId) || {};
        var res = M.generateModels({ subjectId: st.subjectId, lessonIds: st.lessonIds, sections: st.bp, modelCount: st.models, seed: M.uid(),
          meta: { title: st.meta.title, duration: st.meta.duration, docId: st.meta.docId, className: sub.className || '', specialization: sub.specialization || '', year: S.settings.year, preparedBy: M.me().name || '' } });
        M.setSetting('lastBlueprint', st.bp);
        var proceed = function () {
          Promise.all(res.exams.map(function (e) { return M.save('exams', e, { log: false }); })).then(function () {
            M.log('توليد نماذج', st.meta.title, n(res.exams.length) + ' نموذج — مادة ' + (sub.name || ''));
            M.notifyDone('اكتمل توليد النماذج', n(res.exams.length) + ' نموذج جاهز للمراجعة'); M.toast('تم توليد ' + n(res.exams.length) + ' نموذج');
            M.go('#/exam/' + res.exams[0].id);
          });
        };
        if (res.shortages.length) {
          M.modal({ title: 'البنك لا يكفي لكل الفروع', body: '<div class="alert warn">' + I('warn') + '<div>بعض الأسئلة ستكون أقل من المطلوب. أضف واعتمد أسئلة أكثر، أو قلّل العدد، أو ولّد عدداً أقل من النماذج.</div></div><table class="tbl"><thead><tr><th>النموذج</th><th>النوع</th><th>المطلوب</th><th>المتاح</th></tr></thead><tbody>' +
            res.shortages.map(function (s) { return '<tr><td>' + esc(s.model || '—') + '</td><td>' + M.TYPE[s.type].label + '</td><td>' + n(s.need) + '</td><td>' + n(s.got) + '</td></tr>'; }).join('') + '</tbody></table>',
            foot: '<button class="btn pri" data-ok>متابعة رغم النقص</button><button class="btn" data-x>رجوع</button>', onMount: function (m, close) { M.qs('[data-ok]', m).onclick = function () { close(); proceed(); }; } });
        } else proceed();
      };
    }
    draw();
  };

  /* ===== مراجعة الورقة ===== */
  M.examChecks = function (e) {
    var out = [];
    var total = M.examTotal(e);
    if (!e.sections.length) out.push({ k: 'bad', t: 'الورقة بلا أسئلة' });
    if (e.totalGrade && Number(e.totalGrade) !== total) out.push({ k: 'bad', t: 'مجموع الدرجات ' + n(total) + ' لا يساوي الدرجة الكلية ' + n(e.totalGrade) });
    var notApproved = 0, broken = 0, missing = 0;
    e.sections.forEach(function (s) {
      if (!s.items.length) out.push({ k: 'warn', t: 'السؤال «' + (s.title || M.TYPE[s.type].label) + '» بلا فروع' });
      s.items.forEach(function (it) { var q = M.examQ(e, it.qid); if (!q) { missing++; return; } var loc = e.local && e.local[q.id]; if (!loc && q.status !== 'approved' && !(e.frozen && e.frozen[q.id])) notApproved++; if (M.validateQuestion(q).length) broken++; });
    });
    if (missing) out.push({ k: 'bad', t: n(missing) + ' فرع محذوف من البنك' });
    if (notApproved) out.push({ k: 'warn', t: n(notApproved) + ' فرع غير معتمد في البنك' });
    if (broken) out.push({ k: 'bad', t: n(broken) + ' فرع ناقص البيانات (إجابة صحيحة أو نموذج إجابة)' });
    if (e.mode === 'manual') { if (!e.docId && !M.docFor('exam')) out.push({ k: 'warn', t: 'لم تُحدد وثيقة جودة للورقة (تُضاف من «وثائق الجودة»)' }); return out; }
    var d = M.specData(e);
    d.levelGrades.forEach(function (g, i) { var pct = d.total ? g / d.total * 100 : 0; if (Math.abs(pct - d.targets[i]) > 10) out.push({ k: 'warn', t: 'مستوى «' + M.LEVELS[i] + '» ' + n(Math.round(pct)) + '٪ والمستهدف ' + n(d.targets[i]) + '٪' }); });
    d.rows.forEach(function (r) { if (r.actual === 0) out.push({ k: 'warn', t: 'درس «' + r.lesson.name + '» في النطاق بلا أسئلة' }); else if (r.targetGrade && Math.abs(r.actual - r.targetGrade) / r.targetGrade > 0.5 && Math.abs(r.actual - r.targetGrade) >= 2) out.push({ k: 'warn', t: 'درس «' + r.lesson.name + '» درجته ' + n(r.actual) + ' والمستهدف حسب الحصص ' + n(Math.round(r.targetGrade * 10) / 10) }); });
    if (!e.docId && !M.docFor('exam')) out.push({ k: 'warn', t: 'لم تُحدد وثيقة جودة للورقة (تُضاف من «وثائق الجودة»)' });
    if (e.paper === 'a3-booklet' && e._pageCount && e._pageCount % 4) out.push({ k: 'info', t: 'الكتيّب يحتاج مضاعفات ٤ صفحات — ستُضاف ' + n(4 - e._pageCount % 4) + ' صفحة مسودة في آخره' });
    if (e._pageCount && e.maxPages && e._pageCount > e.maxPages) out.push({ k: 'warn', t: 'الورقة ' + n(e._pageCount) + ' صفحات والحد ' + n(e.maxPages) });
    return out;
  };

  /* ===== محرر الامتحان ===== */
  M.views.exam = function (main, r) {
    var stored = M.byId('exams', r.id);
    if (!stored) { main.innerHTML = M.topbar('امتحان', '', '', '#/exams') + '<div class="content"><div class="empty">الامتحان غير موجود</div></div>'; return; }
    var e = JSON.parse(JSON.stringify(stored));
    var step = r.q.step || 'questions';
    var openSec = r.q.sec != null ? Number(r.q.sec) : 0, view = 'paper', pageIdx = 0;
    var locked = e.status === 'approved';
    var siblings = e.groupId ? S.exams.filter(function (x) { return x.groupId === e.groupId; }).sort(function (a, b) { return String(a.model).localeCompare(String(b.model), 'ar'); }) : [e];
    var sub = M.byId('subjects', e.subjectId) || {};

    var persist = M.debounce(function () { e.totalGrade = e.totalGrade || ''; M.save('exams', JSON.parse(JSON.stringify(e)), { log: false }); }, 400);
    function changed() { persist(); updPreview(); drawSide(); }

    function stepsHTML() {
      var st = [['info', 'بيانات الورقة'], ['questions', 'الأسئلة'], ['format', 'التنسيق'], ['review', 'المراجعة والاعتماد']];
      return '<div class="steps">' + st.map(function (s, i) { return '<button type="button" data-step="' + s[0] + '" class="' + (step === s[0] ? 'on' : '') + '"><span class="sn">' + n(i + 1) + '</span>' + s[1] + '</button>'; }).join('') + '</div>';
    }

    function infoHTML() {
      var docs = S.docs.filter(function (d) { return d.type === 'exam'; });
      return '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="grid2">' +
        '<div class="field"><label for="e-title">اسم الامتحان</label><input id="e-title" class="inp" data-e="title" list="e-tl" value="' + esc(e.title) + '"><datalist id="e-tl">' + EXAM_TITLES.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label for="e-model">رمز النموذج</label><input id="e-model" class="inp" data-e="model" value="' + esc(e.model) + '" placeholder="أ / ب / ج"></div>' +
        '<div class="field"><label for="e-class">الصف</label><input id="e-class" class="inp" data-e="className" value="' + esc(e.className) + '"></div>' +
        '<div class="field"><label for="e-spec">التخصص / الشعبة</label><input id="e-spec" class="inp" data-e="specialization" value="' + esc(e.specialization || '') + '"></div>' +
        '<div class="field"><label for="e-year">العام الدراسي</label><input id="e-year" class="inp" data-e="year" value="' + esc(e.year) + '"></div>' +
        '<div class="field"><label for="e-dur">الزمن</label><input id="e-dur" class="inp" data-e="duration" value="' + esc(e.duration) + '"></div>' +
        '<div class="field"><label for="e-total">الدرجة الكلية المطلوبة (للمطابقة)</label><input id="e-total" class="inp" inputmode="numeric" data-en="totalGrade" value="' + n(e.totalGrade || '') + '" placeholder="' + n(M.examTotal(e)) + '"></div>' +
        '<div class="field"><label for="e-max">الحد الأقصى للصفحات</label><input id="e-max" class="inp" inputmode="numeric" data-en="maxPages" value="' + n(e.maxPages || '') + '"></div>' +
        '<div class="field"><label for="e-doc">وثيقة الجودة (الترويسة)</label><select id="e-doc" class="inp" data-e="docId"><option value="">— الافتراضية —</option>' + docs.map(function (d) { return '<option value="' + d.id + '"' + (d.id === e.docId ? ' selected' : '') + '>' + esc(d.name + ' (' + d.code + ' — إصدار ' + d.version + ')') + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="e-date">تاريخ الامتحان (يُطبع في البيانات — اتركه فارغاً ليُكتب باليد)</label><input id="e-date" class="inp" type="date" data-e="examDate" value="' + esc(e.examDate || '') + '"></div>' +
        (!M.byId('subjects', e.subjectId) ? '<div class="field"><label for="e-sn">المادة</label><input id="e-sn" class="inp" data-e="subjectName" value="' + esc(e.subjectName || '') + '"></div>' : '') +
        '<div class="field" style="grid-column:1/-1"><label for="e-foot">جملة أسفل كل صفحة</label><input id="e-foot" class="inp" data-e="footerNote" value="' + esc(e.footerNote != null ? e.footerNote : 'مع أطيب التمنيات بالنجاح والتوفيق') + '" placeholder="مثال: مع أطيب التمنيات بالنجاح والتوفيق"></div>' +
        '<div class="field"><label for="e-prep">إعداد (للسجلات — لا يُطبع)</label><input id="e-prep" class="inp" data-e="preparedBy" value="' + esc(e.preparedBy || '') + '"></div>' +
        '<div class="field"><label for="e-rev">مراجعة</label><input id="e-rev" class="inp" data-e="reviewedBy" value="' + esc(e.reviewedBy || '') + '"></div>' +
        '<div class="field"><label for="e-app">اعتماد</label><input id="e-app" class="inp" data-e="approvedBy" value="' + esc(e.approvedBy || '') + '"></div></div>' +
        '<div class="field"><label for="e-ins">التعليمات</label><input id="e-ins" class="inp" data-e="instructions" value="' + esc(e.instructions || '') + '"></div>' +
        (!M.docFor('exam') ? '<div class="alert info">' + I('docs') + '<div>لا توجد وثيقة جودة من نوع «ورقة امتحان» بعد. ' + (M.can('docs') ? '<a href="#/docs">أضفها من وثائق الجودة</a>' : 'يضيفها مدير النظام') + ' لتظهر بياناتها في الترويسة.</div></div>' : '') + '</div>';
    }

    function sectionsHTML() {
      var si = M.secInfo(e), manual = e.mode === 'manual';
      var h = '<div class="row"><h2 class="grow" style="flex:1">أسئلة الورقة</h2><span class="chip">' + n(si.groups.length) + ' أسئلة · مجموع ' + n(M.examTotal(e)) + (e.totalGrade ? ' من ' + n(e.totalGrade) : '') + '</span></div>';
      if (!e.sections.length) h += '<div class="empty">' + (manual ? 'اختر نوع السؤال الأول من الأسفل، ثم اكتب فروعه.' : 'أضف سؤالاً رئيسياً من الأسفل، ثم اختر فروعه من البنك أو اكتبها.') + '</div>';
      e.sections.forEach(function (s, i) {
        var open = i === openSec, inf = si.info[i];
        var lbl = 'السؤال ' + M.ordinal(inf.main) + (inf.hasParts ? ' — الجزء (' + M.partLabel(e, inf.part) + ')' : '');
        h += '<div class="sec' + (open ? ' open' : '') + (s.part && i > 0 ? ' is-part' : '') + '"><div class="sec-h" data-open="' + i + '"><span class="sec-n">' + n(inf.main + 1) + (inf.hasParts ? '<small>' + M.partLabel(e, inf.part) + '</small>' : '') + '</span><div style="flex:1;min-width:0"><div class="small muted">' + lbl + '</div><div class="bold">' + esc(s.title || M.TYPE[s.type].title) + '</div><div class="small muted">' + M.TYPE[s.type].label + ' · ' + (s.items.length === 1 ? 'فرع واحد' : n(s.items.length) + ' فرع') + '</div></div><span class="chip">' + esc(M.toArabic(M.gradeWord(M.sectionGrade(e, s)))) + '</span>' + I(open ? 'up' : 'down', 16) + '</div>';
        if (open) {
          h += '<div class="sec-b">' +
            (inf.hasParts && inf.first ? '<div class="field"><label for="s-mt' + i + '">نص السؤال الرئيسي (فوق الأجزاء)</label><input id="s-mt' + i + '" class="inp paper-font" data-smt="' + i + '" value="' + esc(s.mainTitle || '') + '" placeholder="أجب عن الأسئلة الآتية:"></div>' : '') +
            '<div class="grid2"><div class="field"><label for="s-t' + i + '">عنوان ' + (inf.hasParts ? 'الجزء' : 'السؤال') + ' في الورقة</label><input id="s-t' + i + '" class="inp paper-font" data-st="' + i + '" value="' + esc(s.title || '') + '" placeholder="' + esc(M.TYPE[s.type].title) + '"></div>' +
            '<div class="field"><label for="s-g' + i + '">درجة موحدة لكل فرع (اختياري)</label><input id="s-g' + i + '" class="inp" inputmode="decimal" data-sg="' + i + '" placeholder="' + (manual ? 'من كل فرع' : 'من البنك') + '"></div></div>' +
            '<div class="row" style="gap:4px 16px">' + (i > 0 ? '<label class="check"><input type="checkbox" data-part="' + i + '"' + (s.part ? ' checked' : '') + '> جزء من السؤال السابق (أ، ب، ج…)</label>' : '') +
            (s.type === 'complete' ? '<label class="check"><input type="checkbox" data-wb="' + i + '"' + (s.wordBank !== false ? ' checked' : '') + '> بنك الكلمات في برواز</label>' : '') +
            (s.type === 'mcq' ? '<label class="check"><input type="checkbox" data-two="' + i + '"' + (s.layout === 'two' ? ' checked' : '') + '> فرعان في كل سطر</label>' : '') + '</div>';
          s.items.forEach(function (it, j) {
            var q = M.itemQ(e, it), loc = !!(e.local && e.local[it.qid]);
            var les = q && q.lessonId ? M.lessonPath(q.lessonId).lesson : null;
            var posL = { below: 'تحت', above: 'فوق', side: 'جانب يسار', 'side-start': 'جانب يمين', after: 'بعد الإجابة' };
            h += '<div class="item-row"><span class="bold">' + n(j + 1) + ')</span><div class="qt">' + (q ? M.qText(q) : '<span style="color:var(--bad)">سؤال محذوف من البنك</span>') +
              (q ? '<div class="row small muted" style="gap:6px;margin-top:4px;font-family:Plex Arabic">' + (loc ? '<span class="chip info">مكتوب في الورقة</span>' : '') + (les ? '<span class="chip">' + esc(les.name) + '</span>' : '') + (!loc ? '<span class="chip info">' + M.LEVELS[q.level] + '</span>' : '') + (!loc && q.status !== 'approved' ? M.statusChip(q.status) : '') + (q.figure ? '<span class="chip">' + I('t_image', 12) + ' شكل ' + n(Number(q.figureWidth) || 60) + '٪ · ' + posL[q.figurePos || 'below'] + '</span>' : '') + '</div>' : '') + '</div>' +
              '<input class="inp" style="width:64px;min-height:36px" inputmode="decimal" data-ig="' + i + ':' + j + '" value="' + n(M.itemGrade(e, it)) + '" aria-label="درجة الفرع" title="درجة الفرع">' +
              '<div class="row" style="gap:2px;flex-wrap:nowrap">' +
              (loc ? '<button class="btn icon ghost sm" data-iedit="' + i + ':' + j + '" aria-label="تعديل" title="تعديل">' + I('edit', 16) + '</button>' : '') +
              '<button class="btn icon ghost sm" data-ilay="' + i + ':' + j + '" aria-label="التخطيط والشكل" title="حجم الشكل وموضعه ومساحة الإجابة والدرجة">' + I('t_image', 16) + '</button>' +
              '<button class="btn icon ghost sm" data-iu="' + i + ':' + j + '" aria-label="لأعلى">' + I('up', 16) + '</button><button class="btn icon ghost sm" data-id="' + i + ':' + j + '" aria-label="لأسفل">' + I('down', 16) + '</button>' +
              (!loc ? '<button class="btn icon ghost sm" data-ialt="' + i + ':' + j + '" aria-label="بديل من البنك" title="بديل من البنك">' + I('shuffle', 16) + '</button>' : '') + '<button class="btn icon ghost sm" data-irm="' + i + ':' + j + '" aria-label="حذف">' + I('x', 16) + '</button></div></div>';
          });
          h += '<div class="row"><button class="btn sm pri" data-write="' + i + '">' + I('edit', 16) + ' كتابة فرع</button><button class="btn sm" data-pick="' + i + '">' + I('plus', 16) + ' من البنك</button><button class="btn sm" data-addpart="' + i + '">' + I('plus', 16) + ' إضافة جزء (' + M.partLabel(e, inf.hasParts ? si.groups[inf.main].secs.length : 1) + ')</button><span class="grow" style="flex:1"></span>' +
            '<button class="btn sm ghost" data-su="' + i + '" aria-label="تحريك لأعلى">' + I('up', 16) + '</button><button class="btn sm ghost" data-sd="' + i + '" aria-label="تحريك لأسفل">' + I('down', 16) + '</button><button class="btn sm danger" data-srm="' + i + '">' + I('trash', 16) + ' حذف</button></div></div>';
        }
        h += '</div>';
      });
      h += '<div class="card"><h3 style="margin-bottom:4px">أضف سؤالاً رئيسياً</h3><div class="small muted" style="margin-bottom:10px">اختر نوعه — ' + (manual ? 'ثم اكتب فروعه مباشرة' : 'ثم اختر فروعه من البنك أو اكتبها') + '. لسؤال له أجزاء (أ، ب) استخدم «إضافة جزء» داخل السؤال.</div><div class="types">' + M.TYPES.map(function (t) { return '<button type="button" data-addsec="' + t.id + '">' + I('t_' + t.id, 22) + t.label + '</button>'; }).join('') + '</div></div>';
      return h;
    }

    /* حفظ فوري قبل مغادرة المحرر لكتابة سؤال */
    function flush() { return M.save('exams', JSON.parse(JSON.stringify(e)), { log: false }); }
    function writeItem(si2, qid) { flush().then(function () { M.go('#/q/' + (qid || 'new') + '?exam=' + e.id + '&sec=' + si2 + (qid ? '' : '&type=' + e.sections[si2].type)); }); }
    function typePicker(title, cb) {
      M.modal({ title: title, body: '<div class="types">' + M.TYPES.map(function (t) { return '<button type="button" data-t="' + t.id + '">' + I('t_' + t.id, 22) + t.label + '</button>'; }).join('') + '</div>',
        onMount: function (m, close) { M.qsa('[data-t]', m).forEach(function (b) { b.onclick = function () { close(); cb(b.dataset.t); }; }); } });
    }
    /* تخطيط الفرع في هذه الورقة: حجم الشكل وموضعه ومحاذاته وتعليقه + مساحة الإجابة + الدرجة */
    function layoutDialog(si2, j) {
      var it = e.sections[si2].items[j], q = M.itemQ(e, it); if (!q) return;
      var base = M.examQ(e, it.qid);
      var L = Object.assign({}, it.lay || {});
      var cur = function (k, d) { return L[k] != null && L[k] !== '' ? L[k] : (base[k] != null && base[k] !== '' ? base[k] : d); };
      var pos = [['below', 'تحت السؤال'], ['above', 'فوق السؤال'], ['side', 'بجانبه — يسار'], ['side-start', 'بجانبه — يمين'], ['after', 'بعد مساحة الإجابة']];
      var al = [['start', 'يمين'], ['center', 'وسط'], ['end', 'يسار']];
      var hasLines = ['reason', 'essay', 'problem'].indexOf(q.type) >= 0, hasDraw = q.type === 'draw';
      M.modal({ title: 'تخطيط الفرع في الورقة', wide: true,
        body: '<div class="lay-grid"><div style="display:flex;flex-direction:column;gap:12px">' +
          (q.figure ? '<div class="field"><label for="ly-w">عرض الشكل: <b id="ly-wv">' + n(cur('figureWidth', 60)) + '٪</b></label><input id="ly-w" type="range" min="15" max="100" step="5" value="' + cur('figureWidth', 60) + '"></div>' +
            '<div class="field"><span class="lbl">موضع الشكل</span><div class="seg wrap" id="ly-pos">' + pos.map(function (p) { return '<button type="button" data-v="' + p[0] + '" class="' + (cur('figurePos', 'below') === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
            '<div class="field"><span class="lbl">محاذاة الشكل</span><div class="seg" id="ly-al">' + al.map(function (p) { return '<button type="button" data-v="' + p[0] + '" class="' + (cur('figureAlign', 'center') === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
            '<div class="field"><label for="ly-cap">تعليق تحت الشكل (اختياري)</label><input id="ly-cap" class="inp paper-font" value="' + esc(cur('figureCaption', '')) + '" placeholder="مثال: شكل (١)"></div>'
            : '<div class="alert info">' + I('t_image') + '<div>لا يوجد شكل في هذا الفرع. ' + (e.local && e.local[it.qid] ? 'أضفه من زر «تعديل».' : 'يُضاف الشكل من محرر السؤال في البنك.') + '</div></div>') +
          (hasLines ? '<div class="field"><label for="ly-l">سطور الإجابة</label><input id="ly-l" class="inp" inputmode="numeric" value="' + n(cur('lines', 3)) + '"></div>' : '') +
          (hasDraw ? '<div class="field"><label for="ly-d">ارتفاع مساحة الرسم (بكسل)</label><input id="ly-d" class="inp" inputmode="numeric" value="' + n(cur('drawHeight', 140)) + '"></div>' : '') +
          '<div class="field"><label for="ly-g">درجة الفرع</label><input id="ly-g" class="inp" inputmode="decimal" value="' + n(M.itemGrade(e, it)) + '"></div>' +
          '<button type="button" class="btn sm ghost" id="ly-reset" style="align-self:flex-start">الرجوع لإعدادات السؤال الأصلية</button></div>' +
          '<div class="lay-pv"><div class="small muted" style="margin-bottom:6px">معاينة</div><div id="ly-pv"></div></div></div>',
        foot: '<button class="btn pri" data-ok>تطبيق</button><button class="btn" data-x>إلغاء</button>',
        onMount: function (m, close) {
          var pv = function () {
            var qq = Object.assign({}, base); M.LAY_KEYS.forEach(function (k) { if (L[k] != null && L[k] !== '') qq[k] = L[k]; });
            M.qs('#ly-pv', m).innerHTML = M.renderQuestionPreview(qq, e.digits || 'arabic');
          };
          var w = M.qs('#ly-w', m);
          var setW = function (v) { L.figureWidth = v; if (w) { w.value = v; M.qs('#ly-wv', m).textContent = n(v) + '٪'; } };
          if (w) w.oninput = function () { setW(Number(w.value)); pv(); };
          M.qsa('#ly-pos button', m).forEach(function (b) { b.onclick = function () { L.figurePos = b.dataset.v; M.qsa('#ly-pos button', m).forEach(function (x) { x.classList.toggle('on', x === b); }); if ((b.dataset.v === 'side' || b.dataset.v === 'side-start') && Number(cur('figureWidth', 60)) > 50) setW(40); pv(); }; });
          M.qsa('#ly-al button', m).forEach(function (b) { b.onclick = function () { L.figureAlign = b.dataset.v; M.qsa('#ly-al button', m).forEach(function (x) { x.classList.toggle('on', x === b); }); pv(); }; });
          var cp = M.qs('#ly-cap', m); if (cp) cp.oninput = function () { L.figureCaption = cp.value; pv(); };
          var ln = M.qs('#ly-l', m); if (ln) ln.oninput = function () { L.lines = Math.max(0, Math.min(30, Number(M.toWestern(ln.value)) || 0)); pv(); };
          var dh = M.qs('#ly-d', m); if (dh) dh.oninput = function () { L.drawHeight = Math.max(40, Math.min(900, Number(M.toWestern(dh.value)) || 140)); pv(); };
          M.qs('#ly-reset', m).onclick = function () { close(); it.lay = null; changed(); };
          M.qs('[data-ok]', m).onclick = function () {
            var gv = String(M.qs('#ly-g', m).value).trim(), g = Number(M.toWestern(gv));
            if (gv !== '' && g >= 0) it.grade = g;
            it.lay = Object.keys(L).length ? L : null; close(); changed();
          };
          pv();
        } });
    }

    function formatHTML() {
      var fonts = [['', 'نسخ (افتراضي)'], ['"Plex Arabic"', 'بلكس عربي'], ['"Traditional Arabic","Naskh"', 'Traditional Arabic'], ['"Simplified Arabic","Naskh"', 'Simplified Arabic'], ['Arial', 'Arial'], ['"Times New Roman"', 'Times New Roman']];
      var colors = ['#1F2A44', '#0E7C6B', '#1E3A8A', '#7C2D12', '#4C1D95', '#111827'];
      var tg = function (k, label) { return '<label class="check"><input type="checkbox" data-tg="' + k + '"' + (e[k] !== false ? ' checked' : '') + '> ' + label + '</label>'; };
      var themes = [['classic', 'رسمي'], ['modern', 'حديث'], ['minimal', 'بسيط']];
      return '<div class="card" style="display:flex;flex-direction:column;gap:14px"><div class="grid2">' +
        '<div class="field"><label for="fm-paper">مقاس الورقة وطريقة الطباعة</label><select id="fm-paper" class="inp">' + Object.keys(M.PAPERS).map(function (k) { return '<option value="' + k + '"' + ((e.paper || 'a4') === k ? ' selected' : '') + '>' + M.PAPERS[k] + '</option>'; }).join('') + '</select>' +
        ((e.paper || 'a4') === 'a3-booklet' ? '<span class="small muted">الأسئلة ومساحات الإجابة على صفحات A4 تُرتَّب تلقائياً على ورق A3 ليُطوى كتيّباً. اطبع على الوجهين مع القلب من الحافة القصيرة.</span>' : (e.paper === 'a3-spread' ? '<span class="small muted">كل ورقة A3 تحمل صفحتين متتاليتين جنباً إلى جنب.</span>' : '')) + '</div>' +
        '<div class="field"><span class="lbl">تصميم الورقة</span><div class="seg" id="fm-theme">' + themes.map(function (t) { return '<button type="button" data-v="' + t[0] + '" class="' + ((e.theme || 'classic') === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">شكل الأرقام</span><div class="seg" id="fm-dg"><button type="button" data-v="arabic" class="' + (e.digits !== 'english' ? 'on' : '') + '">هندية ١٢٣</button><button type="button" data-v="english" class="' + (e.digits === 'english' ? 'on' : '') + '">إنجليزية 123</button></div></div>' +
        '<div class="field"><span class="lbl">لغة الأسئلة</span><div class="seg" id="fm-lang"><button type="button" data-v="ar" class="' + (e.lang !== 'en' ? 'on' : '') + '">عربي (أ ب ج)</button><button type="button" data-v="en" class="' + (e.lang === 'en' ? 'on' : '') + '">English (Q1 · A B C)</button></div></div>' +
        '<div class="field"><label for="fm-font">خط الورقة</label><select id="fm-font" class="inp">' + fonts.map(function (f) { return '<option value="' + esc(f[0]) + '"' + ((e.font || '') === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="fm-fs">حجم الخط</label><input id="fm-fs" class="inp" type="range" min="11" max="18" step="0.5" value="' + (e.fontSize || 14) + '"><span class="small muted" id="fm-fsv">' + n(e.fontSize || 14) + ' بكسل</span></div>' +
        '<div class="field"><span class="lbl">لون العناوين والإطارات</span><div class="row" style="gap:8px">' + colors.map(function (c) { return '<button type="button" data-color="' + c + '" aria-label="لون ' + c + '" style="width:34px;height:34px;border-radius:99px;border:3px solid ' + (e.color === c ? '#9CC9BF' : '#fff') + ';background:' + c + ';box-shadow:0 0 0 1px #D5D9E1"></button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="fm-sep">الفاصل بين الأسئلة</label><select id="fm-sep" class="inp"><option value="none"' + (e.separator !== 'dashed' ? ' selected' : '') + '>بدون</option><option value="dashed"' + (e.separator === 'dashed' ? ' selected' : '') + '>خط متقطع</option></select></div></div>' +
        '<div class="row" style="gap:4px 18px">' + tg('compact', 'وضع مضغوط (توفير الورق)').replace(' checked', e.compact ? ' checked' : '') + tg('showStudent', 'خانات بيانات الطالب') + tg('showGradeTable', 'جدول الدرجات') + tg('showInstructions', 'سطر التعليمات') + tg('showSign', 'توقيعات آخر الورقة') + '<label class="check"><input type="checkbox" id="fm-large"' + (e.largePrint ? ' checked' : '') + '> نسخة بخط كبير (لذوي الاحتياجات البصرية)</label></div>' +
        '<label class="check"><input type="checkbox" id="fm-sh"' + (e.shuffleOptions ? ' checked' : '') + '> خلط ترتيب اختيارات «اختر» في هذا النموذج (المفتاح يتعدل تلقائياً)</label>' +
        '</div>';
    }

    function reviewHTML() {
      var checks = M.examChecks(e);
      var h = '<div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>فحص الورقة قبل الاعتماد</h2>' +
        (checks.length ? checks.map(function (c) { return '<div class="alert ' + c.k + '">' + I('warn') + '<div>' + esc(c.t) + '</div></div>'; }).join('') : '<div class="alert ok">' + I('check') + '<div>الورقة سليمة ومطابقة لجدول المواصفات.</div></div>') + '</div>';
      h += '<div class="card"><h3 style="margin-bottom:10px">جدول المواصفات</h3><div class="scroll-x">' + specTable() + '</div></div>';
      if (locked) h += '<div class="alert ok">' + I('lock') + '<div>الورقة معتمدة' + (e.approvedAt ? ' بتاريخ ' + n(M.fmtDate(e.approvedAt, true)) : '') + ' ومجمّدة: تعديل الأسئلة في البنك لا يغيّرها.' + (M.can('approve') ? ' <button class="btn sm" id="rv-unlock">إلغاء الاعتماد للتعديل</button>' : '') + '</div></div>';
      else if (M.can('approve')) h += '<div class="row"><button class="btn pri" id="rv-approve"' + (checks.some(function (c) { return c.k === 'bad'; }) ? ' disabled' : '') + '>' + I('check') + ' اعتماد الورقة وتجميدها</button><span class="small muted">الاعتماد يحفظ نسخة ثابتة من الأسئلة ويسجّل استخدامها.</span></div>';
      else h += '<div class="small muted">اعتماد الورقة يتم بواسطة رئيس القسم أو مدير النظام.</div>';
      return h;
    }
    function specTable() {
      var d = M.specData(e);
      var h = '<table class="tbl"><thead><tr><th>الدرس</th><th>الحصص</th><th>الوزن</th><th>المستهدف</th>' + M.LEVELS.map(function (l) { return '<th>' + l + '</th>'; }).join('') + '<th>الفعلي</th></tr></thead><tbody>';
      d.rows.forEach(function (r) { h += '<tr><td>' + esc(r.lesson.name) + '</td><td>' + n(r.lesson.periods || 1) + '</td><td>' + n(Math.round(r.weight * 100)) + '٪</td><td>' + n(Math.round(r.targetGrade * 10) / 10) + '</td>' + r.grd.map(function (g, i) { return '<td>' + (r.cnt[i] ? n(g) + ' <span class="small muted">(' + n(r.cnt[i]) + ')</span>' : '—') + '</td>'; }).join('') + '<td><b>' + n(r.actual) + '</b></td></tr>'; });
      h += '<tr><th>المجموع</th><th></th><th>١٠٠٪</th><th>' + n(d.total) + '</th>' + d.levelGrades.map(function (g, i) { return '<th>' + n(g) + ' <span class="small">(' + n(Math.round(g / (d.total || 1) * 100)) + '٪ / ' + n(d.targets[i]) + '٪)</span></th>'; }).join('') + '<th>' + n(M.examTotal(e)) + '</th></tr>';
      return h + '</tbody></table>';
    }

    function drawSide() {
      var box = M.qs('#ex-side', main); if (!box) return;
      var html = step === 'info' ? infoHTML() : step === 'format' ? formatHTML() : step === 'review' ? reviewHTML() : sectionsHTML();
      if (locked && step !== 'review') html = '<div class="alert ok">' + I('lock') + '<div>الورقة معتمدة ومجمّدة — للعرض والطباعة فقط. لإجراء تعديل: «المراجعة والاعتماد» ثم «إلغاء الاعتماد».</div></div><fieldset disabled style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:14px">' + html + '</fieldset>';
      box.innerHTML = html;
      bindSide();
    }

    var lastPages = [];
    var updPreview = M.debounce(function () {
      var body = M.qs('#pv-pages', main); if (!body) return;
      var pages;
      try {
        var sz = 'a4';
        if (view === 'key') pages = M.renderKeyPages(e);
        else if (view === 'spec') pages = M.renderSpecPages(e);
        else { var sh = M.examSheets(e); pages = sh.items; sz = sh.size; }
      } catch (err) { console.error(err); body.innerHTML = '<div class="alert bad">تعذّر بناء المعاينة: ' + esc(err.message) + '</div>'; return; }
      lastPages = pages;
      if (pageIdx >= pages.length) pageIdx = pages.length - 1;
      var pw = sz === 'a3' ? 1588 : 794, ph = sz === 'a3' ? 1123 + 30 : 1123;
      var w = body.clientWidth - 8; var scale = Math.min(1, w / pw);
      body.innerHTML = pages.map(function (p) { return '<div style="width:' + Math.floor(pw * scale) + 'px;height:' + Math.floor(ph * scale) + 'px;margin:0 auto 14px;overflow:hidden"><div class="zoomwrap" style="width:' + pw + 'px;transform:scale(' + scale + ')">' + p + '</div></div>'; }).join('');
      M.qs('#pv-count', main).textContent = sz === 'a3' ? n(e._pageCount) + ' صفحات على ' + n(pages.length) + ' وجه A3' : n(pages.length) + (pages.length === 1 ? ' صفحة' : ' صفحات');
      if (view === 'paper' && e._pageCount !== stored._pageCount) { stored._pageCount = e._pageCount; }
    }, 200);

    var printMenu = '<div class="row" style="gap:6px">' +
      '<button class="btn" id="pr-paper">' + I('print') + ' طباعة / PDF</button>' +
      '<button class="btn" id="pr-word">' + I('download') + ' Word</button>' +
      '<button class="btn" id="pr-more">المزيد ▾</button></div>';
    var modelSw = siblings.length > 1 ? '<div class="seg">' + siblings.map(function (x) { return '<a href="#/exam/' + x.id + '" class="btn sm' + (x.id === e.id ? ' pri' : ' ghost') + '" style="min-height:34px;border:0">نموذج ' + esc(x.model || '') + '</a>'; }).join('') + '</div>' : '';
    main.innerHTML = M.topbar(esc(e.title || 'امتحان') + (e.model ? ' — نموذج ' + esc(e.model) : ''), 'مادة ' + esc(sub.name || '') + ' · ' + (locked ? '<span class="chip ok">معتمد</span>' : '<span class="chip warn">مسودة</span>'), modelSw + printMenu, '#/exams') +
      '<div class="content">' + stepsHTML() + '<div class="editor"><div class="form" id="ex-side"></div>' +
      '<aside class="preview"><div class="preview-h"><span class="live-dot"></span><b>المعاينة الحية</b><span class="small muted" id="pv-count"></span><span style="flex:1"></span>' +
      '<div class="seg" id="pv-view"><button type="button" data-v="paper" class="on">الورقة</button><button type="button" data-v="key">المفتاح</button><button type="button" data-v="spec">المواصفات</button></div>' +
      '<div class="seg" id="pv-dg"><button type="button" data-v="arabic" class="' + (e.digits !== 'english' ? 'on' : '') + '">١٢٣</button><button type="button" data-v="english" class="' + (e.digits === 'english' ? 'on' : '') + '">123</button></div></div>' +
      '<div class="preview-body" id="pv-pages"></div></aside></div></div>';

    M.qsa('[data-step]', main).forEach(function (b) { b.onclick = function () { step = b.dataset.step; M.qsa('[data-step]', main).forEach(function (x) { x.classList.toggle('on', x === b); }); drawSide(); }; });
    M.qsa('#pv-view button', main).forEach(function (b) { b.onclick = function () { view = b.dataset.v; M.qsa('#pv-view button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); updPreview(); }; });
    M.qsa('#pv-dg button', main).forEach(function (b) { b.onclick = function () { if (locked) return M.toast('الورقة معتمدة — ألغِ الاعتماد أولاً', 'bad'); e.digits = b.dataset.v; M.qsa('#pv-dg button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); changed(); }; });

    var docTitle = function (kind) { return (kind ? kind + ' - ' : '') + (e.title || 'امتحان') + (e.model ? ' - نموذج ' + e.model : ''); };
    M.qs('#pr-paper', main).onclick = function () { var sh = M.examSheets(e); M.printPages(sh.items, docTitle(''), sh.size); M.log('طباعة', docTitle('') + ' — ' + M.PAPERS[e.paper || 'a4']); if (sh.size === 'a3') M.toast('اطبع على ورق A3 أفقي — للكتيّب: طباعة على الوجهين مع القلب من الحافة القصيرة'); };
    M.qs('#pr-word', main).onclick = function () { M.renderExamPages(e); if ((e.paper || 'a4') !== 'a4') M.toast('ملف Word بصفحات A4 للتعديل — لطباعة A3 استخدم «طباعة / PDF»'); M.exportExamWord(e).catch(function (er) { M.toast('تعذّر التصدير: ' + er.message, 'bad'); }); };
    M.qs('#pr-more', main).onclick = function () {
      M.modal({ title: 'الطباعة والتصدير', body: '<div style="display:flex;flex-direction:column;gap:8px">' +
        [['kp', 'print', 'طباعة / PDF — مفتاح ونموذج الإجابة'], ['sp', 'print', 'طباعة / PDF — جدول المواصفات'], ['kw', 'download', 'Word — مفتاح ونموذج الإجابة'], ['sw', 'download', 'Word — جدول المواصفات'], ['sx', 'download', 'Excel — جدول المواصفات'],
          ['all', 'print', 'طباعة النماذج كلها (' + n(siblings.length) + ')'], ['same', 'copy', 'امتحان جديد بنفس التنسيق وأسئلة مختلفة']].map(function (a) { return '<button class="btn" data-a="' + a[0] + '" style="justify-content:flex-start">' + I(a[1]) + ' ' + a[2] + '</button>'; }).join('') + '</div>',
        onMount: function (m, close) {
          M.qsa('[data-a]', m).forEach(function (b) {
            b.onclick = function () {
              close(); var a = b.dataset.a;
              if (a === 'kp') M.printPages(M.renderKeyPages(e), docTitle('مفتاح الإجابة'));
              if (a === 'sp') M.printPages(M.renderSpecPages(e), docTitle('جدول المواصفات'));
              if (a === 'kw') M.exportKeyWord(e);
              if (a === 'sw') M.exportSpecWord(e);
              if (a === 'sx') M.exportSpecExcel(e);
              if (a === 'all') { var pg = [], size = 'a4'; siblings.forEach(function (x) { var sh = M.examSheets(x.id === e.id ? e : x); size = sh.size; pg = pg.concat(sh.items); }); M.printPages(pg, docTitle('كل النماذج'), size); }
              if (a === 'same') sameFormat();
            };
          });
        } });
    };

    function sameFormat() {
      var lessonIds = M.specData(e).rows.map(function (r) { return r.lesson.id; });
      var used = {}; siblings.forEach(function (x) { x.sections.forEach(function (s) { s.items.forEach(function (it) { used[it.qid] = 1; }); }); });
      var ne = JSON.parse(JSON.stringify(e));
      ne.id = M.uid(); ne.status = 'draft'; ne.frozen = null; ne.approvedAt = null; ne.shuffleSeed = M.uid(); delete ne.ver; delete ne.createdAt; delete ne.syncedAt;
      var labels = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
      ne.model = labels[siblings.length] || '';
      if (!ne.groupId) { ne.groupId = M.uid(); e.groupId = ne.groupId; stored.groupId = ne.groupId; M.save('exams', JSON.parse(JSON.stringify(e)), { log: false }); }
      var short = 0;
      ne.sections.forEach(function (s) {
        s.id = M.uid();
        s.items = s.items.map(function (it) {
          if (e.local && e.local[it.qid]) return it;
          var q = M.examQ(e, it.qid);
          var cands = S.questions.filter(function (c) { return c.type === s.type && c.status === 'approved' && !used[c.id] && lessonIds.indexOf(c.lessonId) >= 0; });
          cands.sort(function (a, b) { var sa = (a.lessonId === (q && q.lessonId) ? 0 : 2) + (Number(a.level) === Number(q && q.level) ? 0 : 1); var sb = (b.lessonId === (q && q.lessonId) ? 0 : 2) + (Number(b.level) === Number(q && q.level) ? 0 : 1); return sa - sb; });
          var pick = cands[0];
          if (!pick) { short++; return it; }
          used[pick.id] = 1;
          return { qid: pick.id, grade: it.grade != null && it.grade !== '' ? it.grade : M.itemGrade(e, it) };
        });
      });
      M.save('exams', ne).then(function () { M.toast(short ? 'أُنشئ النموذج — ' + n(short) + ' فرع بقي كما هو لعدم وجود بديل في البنك' : 'أُنشئ نموذج جديد بنفس التنسيق', short ? '' : 'ok'); M.go('#/exam/' + ne.id); });
    }

    function pickDialog(si) {
      var s = e.sections[si];
      var inExam = {}; e.sections.forEach(function (x) { x.items.forEach(function (it) { inExam[it.qid] = 1; }); });
      var lessonFilter = '';
      var pool = function () { return S.questions.filter(function (q) { return q.type === s.type && q.subjectId === e.subjectId && q.status !== 'archived' && !inExam[q.id] && (!lessonFilter || q.lessonId === lessonFilter); }).sort(function (a, b) { return (a.status === 'approved' ? 0 : 1) - (b.status === 'approved' ? 0 : 1) || (a.usedIn || []).length - (b.usedIn || []).length; }); };
      var listHTML = function () { var p = pool(); return p.length ? p.map(function (q) { return '<label class="item-row" style="cursor:pointer"><input type="checkbox" value="' + q.id + '" style="width:18px;height:18px;accent-color:var(--accent)"><div class="qt">' + M.qText(q) + '<div class="row small muted" style="gap:6px;margin-top:4px;font-family:Plex Arabic"><span class="chip">' + esc((M.lessonPath(q.lessonId).lesson || {}).name || '') + '</span><span class="chip info">' + M.LEVELS[q.level] + '</span>' + M.statusChip(q.status) + ((q.usedIn || []).length ? '<span class="chip">استُخدم ' + n(q.usedIn.length) + '</span>' : '') + '</div></div></label>'; }).join('') : '<div class="empty">لا توجد أسئلة متاحة من هذا النوع.</div>'; };
      M.modal({ title: 'إضافة فروع — ' + M.TYPE[s.type].label, wide: true,
        body: '<div class="field" style="max-width:360px"><label for="pk-l">الدرس</label><select id="pk-l" class="inp"><option value="">كل الدروس</option>' + M.lessonsOfSubject(e.subjectId).map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('') + '</select></div><div id="pk-list" style="display:flex;flex-direction:column;gap:8px">' + listHTML() + '</div>',
        foot: '<button class="btn pri" data-ok>إضافة المحدد</button><button class="btn" data-x>إلغاء</button>',
        onMount: function (m, close) {
          M.qs('#pk-l', m).onchange = function (ev) { lessonFilter = ev.target.value; M.qs('#pk-list', m).innerHTML = listHTML(); };
          M.qs('[data-ok]', m).onclick = function () {
            var ids = M.qsa('#pk-list input:checked', m).map(function (c) { return c.value; });
            ids.forEach(function (id) { s.items.push({ qid: id, grade: null }); var q = M.byId('questions', id); if (q && e.scopeLessonIds.indexOf(q.lessonId) < 0) e.scopeLessonIds.push(q.lessonId); });
            close(); changed();
          };
        } });
    }

    function altDialog(si, j) {
      var s = e.sections[si], it = s.items[j];
      var alts = M.alternatives(e, s, it.qid).slice(0, 30);
      M.modal({ title: 'بديل من البنك', wide: true,
        body: alts.length ? '<div style="display:flex;flex-direction:column;gap:8px">' + alts.map(function (q) { return '<button class="item-row" data-alt="' + q.id + '" style="text-align:start;cursor:pointer;border:1px solid var(--line)"><div class="qt">' + M.qText(q) + '<div class="row small muted" style="gap:6px;margin-top:4px;font-family:Plex Arabic"><span class="chip">' + esc((M.lessonPath(q.lessonId).lesson || {}).name || '') + '</span><span class="chip info">' + M.LEVELS[q.level] + '</span></div></div></button>'; }).join('') + '</div>' : '<div class="empty">لا يوجد بديل معتمد من نفس النوع.</div>',
        onMount: function (m, close) { M.qsa('[data-alt]', m).forEach(function (b) { b.onclick = function () { it.qid = b.dataset.alt; close(); changed(); }; }); } });
    }

    var rememberFoot = M.debounce(function (v) { M.setSetting('footerNote', v); }, 800);
    function parseIJ(v) { var p = v.split(':'); return [Number(p[0]), Number(p[1])]; }
    function bindSide() {
      var box = M.qs('#ex-side', main);
      M.qsa('[data-e]', box).forEach(function (el) { el.oninput = el.onchange = function () { e[el.dataset.e] = el.value; if (el.dataset.e === 'footerNote') rememberFoot(el.value); changed2(); }; });
      M.qsa('[data-en]', box).forEach(function (el) { el.oninput = function () { var v = Number(M.toWestern(el.value)); e[el.dataset.en] = v > 0 ? v : ''; changed2(); }; });
      M.qsa('[data-open]', box).forEach(function (el) { el.onclick = function () { var i = Number(el.dataset.open); openSec = openSec === i ? -1 : i; drawSide(); }; });
      M.qsa('[data-st]', box).forEach(function (el) { el.oninput = function () { e.sections[+el.dataset.st].title = el.value; changed2(); }; });
      M.qsa('[data-smt]', box).forEach(function (el) { el.oninput = function () { e.sections[+el.dataset.smt].mainTitle = el.value; changed2(); }; });
      M.qsa('[data-part]', box).forEach(function (el) { el.onchange = function () { e.sections[+el.dataset.part].part = el.checked; changed(); }; });
      M.qsa('[data-write]', box).forEach(function (el) { el.onclick = function () { writeItem(+el.dataset.write); }; });
      M.qsa('[data-iedit]', box).forEach(function (el) { el.onclick = function () { var ij = parseIJ(el.dataset.iedit); writeItem(ij[0], e.sections[ij[0]].items[ij[1]].qid); }; });
      M.qsa('[data-ilay]', box).forEach(function (el) { el.onclick = function () { var ij = parseIJ(el.dataset.ilay); layoutDialog(ij[0], ij[1]); }; });
      M.qsa('[data-addpart]', box).forEach(function (el) { el.onclick = function () {
        var i = +el.dataset.addpart, si = M.secInfo(e), g = si.groups[si.info[i].main], at = g.secs[g.secs.length - 1] + 1;
        typePicker('نوع الجزء (' + M.partLabel(e, g.secs.length) + ')', function (t) {
          e.sections.splice(at, 0, { id: M.uid(), type: t, title: '', items: [], part: true, wordBank: true, layout: 'auto' });
          openSec = at; changed();
        });
      }; });
      M.qsa('[data-sg]', box).forEach(function (el) { el.onchange = function () { var v = Number(M.toWestern(el.value)); if (v > 0) { e.sections[+el.dataset.sg].items.forEach(function (it) { it.grade = v; }); changed(); } }; });
      M.qsa('[data-wb]', box).forEach(function (el) { el.onchange = function () { e.sections[+el.dataset.wb].wordBank = el.checked; changed2(); }; });
      M.qsa('[data-two]', box).forEach(function (el) { el.onchange = function () { e.sections[+el.dataset.two].layout = el.checked ? 'two' : 'auto'; changed2(); }; });
      M.qsa('[data-ig]', box).forEach(function (el) { el.onchange = function () { var ij = parseIJ(el.dataset.ig); var v = Number(M.toWestern(el.value)); e.sections[ij[0]].items[ij[1]].grade = v >= 0 ? v : null; changed(); }; });
      M.qsa('[data-iu]', box).forEach(function (el) { el.onclick = function () { var ij = parseIJ(el.dataset.iu), a = e.sections[ij[0]].items; if (ij[1] > 0) { var t = a[ij[1]]; a[ij[1]] = a[ij[1] - 1]; a[ij[1] - 1] = t; changed(); } }; });
      M.qsa('[data-id]', box).forEach(function (el) { el.onclick = function () { var ij = parseIJ(el.dataset.id), a = e.sections[ij[0]].items; if (ij[1] < a.length - 1) { var t = a[ij[1]]; a[ij[1]] = a[ij[1] + 1]; a[ij[1] + 1] = t; changed(); } }; });
      M.qsa('[data-irm]', box).forEach(function (el) { el.onclick = function () { var ij = parseIJ(el.dataset.irm); var rm = e.sections[ij[0]].items.splice(ij[1], 1)[0]; if (rm && e.local && e.local[rm.qid]) delete e.local[rm.qid]; changed(); }; });
      M.qsa('[data-ialt]', box).forEach(function (el) { el.onclick = function () { var ij = parseIJ(el.dataset.ialt); altDialog(ij[0], ij[1]); }; });
      M.qsa('[data-pick]', box).forEach(function (el) { el.onclick = function () { pickDialog(+el.dataset.pick); }; });
      M.qsa('[data-su]', box).forEach(function (el) { el.onclick = function () { var i = +el.dataset.su; if (i > 0) { var t = e.sections[i]; e.sections[i] = e.sections[i - 1]; e.sections[i - 1] = t; openSec = i - 1; changed(); } }; });
      M.qsa('[data-sd]', box).forEach(function (el) { el.onclick = function () { var i = +el.dataset.sd; if (i < e.sections.length - 1) { var t = e.sections[i]; e.sections[i] = e.sections[i + 1]; e.sections[i + 1] = t; openSec = i + 1; changed(); } }; });
      M.qsa('[data-srm]', box).forEach(function (el) { el.onclick = function () { var i = +el.dataset.srm; M.confirm('حذف السؤال', 'حذف «' + (e.sections[i].title || M.TYPE[e.sections[i].type].label) + '» من الورقة؟ (الأسئلة تبقى في البنك)', 'حذف', true).then(function (ok) { if (ok) { e.sections.splice(i, 1); openSec = -1; changed(); } }); }; });
      M.qsa('[data-addsec]', box).forEach(function (el) { el.onclick = function () { e.sections.push({ id: M.uid(), type: el.dataset.addsec, title: '', items: [], wordBank: true, layout: 'auto' }); openSec = e.sections.length - 1; changed(); if (e.mode === 'manual') writeItem(openSec); else pickDialog(openSec); }; });
      /* التنسيق */
      M.qsa('#fm-dg button', box).forEach(function (b) { b.onclick = function () { e.digits = b.dataset.v; M.qsa('#pv-dg button', main).forEach(function (x) { x.classList.toggle('on', x.dataset.v === e.digits); }); changed(); }; });
      M.qsa('#fm-lang button', box).forEach(function (b) { b.onclick = function () { e.lang = b.dataset.v; if (e.lang === 'en') e.digits = 'english'; changed(); }; });
      var ff = M.qs('#fm-font', box); if (ff) ff.onchange = function () { e.font = ff.value; changed2(); };
      var fs = M.qs('#fm-fs', box); if (fs) fs.oninput = function () { e.fontSize = Number(fs.value); M.qs('#fm-fsv', box).textContent = n(fs.value) + ' بكسل'; changed2(); };
      M.qsa('[data-color]', box).forEach(function (b) { b.onclick = function () { e.color = b.dataset.color; changed(); }; });
      var sp = M.qs('#fm-sep', box); if (sp) sp.onchange = function () { e.separator = sp.value; changed2(); };
      M.qsa('[data-tg]', box).forEach(function (c) { c.onchange = function () { e[c.dataset.tg] = c.checked; changed2(); }; });
      var fp = M.qs('#fm-paper', box); if (fp) fp.onchange = function () { e.paper = fp.value; changed(); };
      M.qsa('#fm-theme button', box).forEach(function (b) { b.onclick = function () { e.theme = b.dataset.v; changed(); }; });
      var fl = M.qs('#fm-large', box); if (fl) fl.onchange = function () { e.largePrint = fl.checked; changed2(); };
      var sh = M.qs('#fm-sh', box); if (sh) sh.onchange = function () { e.shuffleOptions = sh.checked; changed2(); };
      /* الاعتماد */
      var ap = M.qs('#rv-approve', box);
      if (ap) ap.onclick = function () {
        M.confirm('اعتماد الورقة', 'سيتم تجميد نسخة من الأسئلة الحالية داخل الورقة وتسجيل استخدامها. متابعة؟', 'اعتماد').then(function (ok) {
          if (!ok) return;
          e.frozen = {};
          var jobs = [];
          e.sections.forEach(function (s) { s.items.forEach(function (it) {
            var q = M.byId('questions', it.qid); if (!q) return;
            e.frozen[q.id] = JSON.parse(JSON.stringify(q));
            q.usedIn = (q.usedIn || []).filter(function (x) { return x !== e.id; }).concat([e.id]);
            jobs.push(M.save('questions', q, { log: false, keepVer: true }));
          }); });
          e.status = 'approved'; e.approvedAt = M.now(); e.approvedBy = e.approvedBy || M.me().name;
          locked = true;
          jobs.push(M.save('exams', JSON.parse(JSON.stringify(e)), { log: false }));
          Promise.all(jobs).then(function () { M.log('اعتماد امتحان', docTitle('')); M.toast('اعتُمدت الورقة', 'ok'); M.render(); });
        });
      };
      var ul = M.qs('#rv-unlock', box);
      if (ul) ul.onclick = function () { M.confirm('إلغاء الاعتماد', 'ستعود الورقة مسودة وتقرأ الأسئلة من البنك مباشرة.', 'إلغاء الاعتماد', true).then(function (ok) { if (!ok) return; e.status = 'draft'; e.frozen = null; locked = false; M.save('exams', JSON.parse(JSON.stringify(e)), { log: false }).then(function () { M.log('إلغاء اعتماد امتحان', docTitle('')); M.render(); }); }); };
    }
    /* تغيير لا يحتاج إعادة رسم اللوحة الجانبية (يحافظ على مؤشر الكتابة) */
    function changed2() { persist(); updPreview(); }

    drawSide();
    updPreview();
    var onResize = M.debounce(updPreview, 200);
    window.addEventListener('resize', onResize);
    return { destroy: function () { window.removeEventListener('resize', onResize); } };
  };
})(window.M);
