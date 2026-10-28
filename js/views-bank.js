/* بنك الأسئلة: المنهج + الأسئلة + محرر السؤال + المراجعة */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;

  function qText(q) {
    if (q.type === 'match') return q.pairs.filter(function (p) { return p.a; }).map(function (p) { return M.richText(p.a, 'arabic') + ' ← ' + M.richText(p.b, 'arabic'); }).join(' · ') || '<span class="muted">توصيل بدون أزواج</span>';
    return (q.text ? M.richText(q.text, 'arabic', { answers: true }) : '') + (q.figure ? ' <span class="chip">' + M.icon('t_image', 14) + ' شكل</span>' : '') || '<span class="muted">بدون نص</span>';
  }
  M.qText = qText;

  /* ===== نوافذ المنهج ===== */
  M.editUnit = function (subjectId, u) {
    var isNew = !u; u = u || { subjectId: subjectId, name: '', term: 1, order: M.unitsOf(subjectId).length + 1 };
    M.modal({
      title: isNew ? 'وحدة جديدة' : 'تعديل الوحدة',
      body: '<div class="field"><label for="u-n">اسم الوحدة</label><input id="u-n" class="inp" value="' + esc(u.name) + '" placeholder="الوحدة الأولى: ..."></div>' +
        '<div class="grid2"><div class="field"><label for="u-t">الفصل الدراسي</label><select id="u-t" class="inp"><option value="1"' + (u.term != 2 ? ' selected' : '') + '>الأول</option><option value="2"' + (u.term == 2 ? ' selected' : '') + '>الثاني</option></select></div>' +
        '<div class="field"><label for="u-o">الترتيب</label><input id="u-o" class="inp" inputmode="numeric" value="' + n(u.order) + '"></div></div>',
      foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qs('[data-ok]', m).onclick = function () {
          var nm = M.qs('#u-n', m).value.trim(); if (!nm) return M.toast('اكتب اسم الوحدة', 'bad');
          u.name = nm; u.term = Number(M.qs('#u-t', m).value); u.order = Number(M.toWestern(M.qs('#u-o', m).value)) || 1;
          M.save('units', u).then(function () { close(); M.go(M.link('bank', '', { s: subjectId, u: u.id })); });
        };
      }
    });
  };
  M.editLesson = function (unit, l) {
    var isNew = !l; l = l || { unitId: unit.id, subjectId: unit.subjectId, name: '', periods: 2, order: M.lessonsOf(unit.id).length + 1, content: '' };
    M.modal({
      title: isNew ? 'درس جديد' : 'تعديل الدرس',
      body: '<div class="field"><label for="l-n">عنوان الدرس</label><input id="l-n" class="inp" value="' + esc(l.name) + '"></div>' +
        '<div class="grid2"><div class="field"><label for="l-p">عدد الحصص (يحدد الوزن النسبي)</label><input id="l-p" class="inp" inputmode="numeric" value="' + n(l.periods) + '"></div>' +
        '<div class="field"><label for="l-o">الترتيب</label><input id="l-o" class="inp" inputmode="numeric" value="' + n(l.order) + '"></div></div>',
      foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qs('[data-ok]', m).onclick = function () {
          var nm = M.qs('#l-n', m).value.trim(); if (!nm) return M.toast('اكتب عنوان الدرس', 'bad');
          l.name = nm; l.periods = Number(M.toWestern(M.qs('#l-p', m).value)) || 1; l.order = Number(M.toWestern(M.qs('#l-o', m).value)) || 1;
          M.save('lessons', l).then(function () { close(); M.go(M.link('bank', '', { s: unit.subjectId, u: unit.id, l: l.id })); });
        };
      }
    });
  };
  M.editOutcome = function (lesson, o, after) {
    var isNew = !o;
    var unit = M.byId('units', lesson.unitId);
    var nextCode = (unit ? unit.order : 1) + '-' + (M.outcomesOf(lesson.id).length + 1);
    o = o || { lessonId: lesson.id, code: 'ن.ت ' + nextCode, text: '' };
    M.modal({
      title: isNew ? 'ناتج تعلم جديد' : 'تعديل ناتج التعلم',
      body: '<div class="field"><label for="o-c">الكود</label><input id="o-c" class="inp" value="' + esc(o.code) + '"></div>' +
        '<div class="field"><label for="o-t">نص الناتج</label><textarea id="o-t" class="inp" placeholder="أن يكون الطالب قادراً على ...">' + esc(o.text) + '</textarea></div>',
      foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qs('[data-ok]', m).onclick = function () {
          var t = M.qs('#o-t', m).value.trim(); if (!t) return M.toast('اكتب نص الناتج', 'bad');
          o.code = M.qs('#o-c', m).value.trim(); o.text = t;
          M.save('outcomes', o).then(function () { close(); if (after) after(o); else M.render(); });
        };
      }
    });
  };

  function delCurriculum(store, rec, back) {
    var used = 0;
    if (store === 'lessons') used = S.questions.filter(function (q) { return q.lessonId === rec.id; }).length;
    if (store === 'units') used = M.lessonsOf(rec.id).length;
    if (store === 'subjects') used = M.unitsOf(rec.id).length;
    if (used) return M.toast('لا يمكن الحذف: يحتوي على ' + n(used) + ' عنصر. احذفها أو انقلها أولاً', 'bad');
    M.confirm('حذف', 'حذف «' + (rec.name || rec.code) + '» نهائياً؟', 'حذف', true).then(function (ok) { if (ok) M.remove(store, rec.id).then(function () { M.go(back); }); });
  }

  /* ===== مصفوفة التغطية ===== */
  M.matrixHTML = function (cov) {
    if (!cov.length) return '<div class="empty">لا توجد دروس بعد.</div>';
    var h = '<div class="scroll-x"><div class="matrix" style="grid-template-columns:minmax(150px,1.6fr) repeat(4,minmax(64px,1fr)) 80px"><span class="h" style="text-align:start">الدرس</span>';
    M.LEVELS.forEach(function (l) { h += '<span class="h">' + l + '</span>'; });
    h += '<span class="h">المعتمد</span>';
    cov.forEach(function (r) {
      h += '<span class="rn">' + esc(r.lesson.name) + '</span>';
      r.byLevel.forEach(function (c) { h += '<span class="c ' + (c === 0 ? 'zero' : c < 3 ? 'low' : 'ok') + '">' + n(c) + '</span>'; });
      h += '<span class="c" style="font-weight:700">' + n(r.approved) + (r.all > r.approved ? '<span class="small muted"> / ' + n(r.all) + '</span>' : '') + '</span>';
    });
    return h + '</div></div><div class="small muted" style="margin-top:8px">الأرقام = الأسئلة المعتمدة. أحمر = لا يوجد، برتقالي = أقل من ٣ أسئلة. العمود الأخير: المعتمد / الإجمالي.</div>';
  };

  /* ===== بطاقة السؤال ===== */
  M.qCard = function (q, opts) {
    opts = opts || {};
    var p = M.lessonPath(q.lessonId), o = M.byId('outcomes', q.outcomeId);
    return '<article class="qcard" data-q="' + q.id + '">' +
      (opts.select ? '<input type="checkbox" class="qsel" data-id="' + q.id + '" aria-label="تحديد" style="width:18px;height:18px;margin-top:4px;accent-color:var(--accent)">' : '') +
      '<div style="flex:1;min-width:0"><div class="row" style="gap:6px;margin-bottom:6px">' + M.typeChip(q.type) + (q.source === 'ai' ? '<span class="chip warn">مقترح آلياً</span>' : '') + '</div>' +
      '<div class="qt">' + qText(q) + '</div>' +
      (q.type === 'mcq' ? '<div class="small" style="margin-top:4px">' + q.options.map(function (op, i) { return '<span style="margin-inline-end:14px;' + (i === Number(q.correct) ? 'color:var(--accent-d);font-weight:700' : '') + '">' + M.AR_LETTERS[i] + ') ' + M.richText(op, 'arabic') + '</span>'; }).join('') + '</div>' : '') +
      '<div class="meta">' + (p.lesson ? '<span class="chip">' + esc(p.lesson.name) + '</span>' : '<span class="chip bad">بدون درس</span>') + (o ? '<span class="chip">' + esc(o.code) + '</span>' : '') +
      '<span class="chip info">' + M.LEVELS[q.level] + '</span><span class="chip">' + M.DIFFS[q.difficulty] + '</span><span class="chip">' + esc(M.toArabic(M.gradeWord(q.grade))) + '</span>' +
      ((q.usedIn || []).length ? '<span class="chip">استُخدم ' + n(q.usedIn.length) + ' مرة</span>' : '') + '</div>' +
      (q.status === 'returned' && q.reviewNote ? '<div class="alert bad" style="margin-top:8px">' + I('warn') + '<div>ملاحظة المراجع: ' + esc(q.reviewNote) + '</div></div>' : '') + '</div>' +
      '<div class="side-a">' + M.statusChip(q.status) + '<div class="row" style="gap:4px"><a class="btn sm" href="#/q/' + q.id + '">' + I('edit', 16) + ' تعديل</a><button class="btn sm icon" data-more="' + q.id + '" aria-label="خيارات">⋯</button></div>' +
      '<span class="small muted">إصدار ' + n(q.ver || 1) + ' · ' + esc(q.createdBy || '') + '</span></div></article>';
  };

  M.qMenu = function (q, after) {
    var can = M.can('approve');
    var acts = [];
    if (q.status === 'draft' || q.status === 'returned') acts.push(['submit', 'إرسال للمراجعة']);
    if (can && q.status !== 'approved') acts.push(['approve', 'اعتماد']);
    if (can && (q.status === 'review' || q.status === 'approved')) acts.push(['return', 'إعادة بملاحظة']);
    acts.push(['dup', 'نسخ السؤال']);
    if (q.status !== 'archived') acts.push(['archive', 'أرشفة (إيقاف الاستخدام)']); else acts.push(['unarchive', 'إلغاء الأرشفة']);
    if (q.status !== 'approved' && !(q.usedIn || []).length) acts.push(['delete', 'حذف نهائي']);
    M.modal({
      title: 'خيارات السؤال',
      body: '<div class="qt" style="font-family:Naskh,serif;font-size:16px">' + qText(q) + '</div><div style="display:flex;flex-direction:column;gap:8px">' +
        acts.map(function (a) { return '<button class="btn' + (a[0] === 'delete' ? ' danger' : '') + '" data-a="' + a[0] + '" style="justify-content:flex-start">' + a[1] + '</button>'; }).join('') + '</div>',
      onMount: function (m, close) {
        M.qsa('[data-a]', m).forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.a; close();
            var done = after || M.render;
            if (a === 'submit') { var e = M.validateQuestion(q); if (e.length) return M.toast('أكمل السؤال أولاً: ' + e.join('، '), 'bad'); M.setStatus(q, 'review').then(done); }
            if (a === 'approve') { var e2 = M.validateQuestion(q); if (e2.length) return M.toast('لا يمكن الاعتماد: ' + e2.join('، '), 'bad'); M.setStatus(q, 'approved', '').then(done); }
            if (a === 'return') M.prompt('إعادة بملاحظة', 'ملاحظة المراجع للمدرس', '').then(function (note) { if (note) M.setStatus(q, 'returned', note).then(done); });
            if (a === 'dup') { var c = JSON.parse(JSON.stringify(q)); c.id = M.uid(); c.status = 'draft'; c.usedIn = []; delete c.ver; delete c.createdAt; delete c.syncedAt; c.reviewNote = ''; M.save('questions', c).then(function () { M.go('#/q/' + c.id); }); }
            if (a === 'archive') M.setStatus(q, 'archived').then(done);
            if (a === 'unarchive') M.setStatus(q, 'draft').then(done);
            if (a === 'delete') M.confirm('حذف السؤال', 'حذف هذا السؤال نهائياً؟', 'حذف', true).then(function (ok) { if (ok) M.remove('questions', q.id).then(done); });
          };
        });
      }
    });
  };

  /* ===== شاشة البنك ===== */
  M.views.bank = function (main, r) {
    var q = r.q;
    var subjects = S.subjects.slice().sort(function (a, b) { return String(a.name).localeCompare(b.name, 'ar'); });
    var sid = q.s || (q.l && (M.lessonPath(q.l).subject || {}).id) || (q.u && (M.byId('units', q.u) || {}).subjectId) || (subjects[0] && subjects[0].id) || '';
    var subject = M.byId('subjects', sid);
    var unit = q.u ? M.byId('units', q.u) : null;
    var lesson = q.l ? M.byId('lessons', q.l) : null;
    if (lesson && !unit) unit = M.byId('units', lesson.unitId);
    var filt = { type: q.t || '', status: q.st || '', level: q.lv || '', text: q.x || '' };

    /* الشجرة */
    var tree = '';
    subjects.forEach(function (s) {
      var cnt = S.questions.filter(function (x) { return x.subjectId === s.id && x.status !== 'archived'; }).length;
      tree += '<a class="t l1' + (s.id === sid && !unit ? ' on' : '') + '" href="' + M.link('bank', '', { s: s.id }) + '">' + esc(s.name) + '<span class="n">' + n(cnt) + '</span></a>';
      if (s.id !== sid) return;
      [1, 2].forEach(function (term) {
        var us = M.unitsOf(s.id).filter(function (u) { return Number(u.term) === term; });
        if (!us.length) return;
        tree += '<div class="term">' + M.termLabel(term) + '</div>';
        us.forEach(function (u) {
          var uc = S.questions.filter(function (x) { var l = M.byId('lessons', x.lessonId); return l && l.unitId === u.id && x.status !== 'archived'; }).length;
          tree += '<a class="t l2' + (unit && unit.id === u.id && !lesson ? ' on' : '') + '" href="' + M.link('bank', '', { s: s.id, u: u.id }) + '">' + esc(u.name) + '<span class="n">' + n(uc) + '</span></a>';
          M.lessonsOf(u.id).forEach(function (l) {
            var lc = S.questions.filter(function (x) { return x.lessonId === l.id && x.status !== 'archived'; }).length;
            tree += '<a class="t l3' + (lesson && lesson.id === l.id ? ' on' : '') + '" href="' + M.link('bank', '', { s: s.id, u: u.id, l: l.id }) + '">' + esc(l.name) + '<span class="n">' + n(lc) + '</span></a>';
          });
        });
      });
    });

    var scopeLessons = lesson ? [lesson] : unit ? M.lessonsOf(unit.id) : subject ? M.lessonsOfSubject(subject.id) : [];
    var scopeIds = scopeLessons.map(function (l) { return l.id; });
    var all = subject ? S.questions.filter(function (x) {
      if (x.subjectId !== subject.id) return false;
      if ((lesson || unit) && scopeIds.indexOf(x.lessonId) < 0) return false;
      return true;
    }) : [];
    var shown = all.filter(function (x) {
      if (filt.type && x.type !== filt.type) return false;
      if (filt.status ? x.status !== filt.status : x.status === 'archived') return false;
      if (filt.level !== '' && String(x.level) !== String(filt.level)) return false;
      if (filt.text && M.norm(x.text + ' ' + (x.options || []).join(' ')).indexOf(M.norm(filt.text)) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });

    var title = lesson ? esc(lesson.name) : unit ? esc(unit.name) : subject ? 'مادة ' + esc(subject.name) : 'بنك الأسئلة';
    var sub = lesson ? esc(unit ? unit.name : '') + ' · ' + n(lesson.periods) + ' حصة' : unit ? M.termLabel(unit.term) + ' · ' + n(M.lessonsOf(unit.id).length) + ' دروس' : subject ? esc(subject.className || '') : '';
    var actions = subject ? '<button class="btn" id="b-imp">' + I('merge') + ' استيراد Excel</button><button class="btn" id="b-xl">' + I('download') + ' Excel</button><button class="btn" id="b-wd">' + I('download') + ' Word</button>' +
      '<a class="btn pri" href="' + M.link('gen', '', { s: sid, u: unit ? unit.id : '', l: lesson ? lesson.id : '' }) + '">' + I('spark') + ' توليد ٣ نماذج</a>' : '';

    var body = '';
    if (!subject) {
      body = '<div class="empty">' + (subjects.length ? 'اختر مادة' : 'لا توجد مواد بعد') + '<div style="margin-top:12px"><button class="btn pri" id="b-addsub">' + I('plus') + ' إضافة مادة</button></div></div>';
    } else {
      /* بطاقة الرأس حسب المستوى */
      var headCard = '<div class="card"><div class="card-h"><div class="grow"><h2>' + title + '</h2><div class="small muted">' + sub + '</div></div>';
      if (lesson) headCard += '<button class="btn sm" id="b-edl">' + I('edit', 16) + ' تعديل الدرس</button><button class="btn sm danger" id="b-dll">' + I('trash', 16) + '</button>';
      else if (unit) headCard += '<button class="btn sm" id="b-addl">' + I('plus', 16) + ' درس</button><button class="btn sm" id="b-edu">' + I('edit', 16) + ' تعديل الوحدة</button><button class="btn sm danger" id="b-dlu">' + I('trash', 16) + '</button>';
      else headCard += '<button class="btn sm" id="b-addu">' + I('plus', 16) + ' وحدة</button><button class="btn sm" id="b-eds">' + I('edit', 16) + ' تعديل المادة</button><button class="btn sm danger" id="b-dls">' + I('trash', 16) + '</button>';
      headCard += '</div>';
      var apC = all.filter(function (x) { return x.status === 'approved'; }).length, rvC = all.filter(function (x) { return x.status === 'review'; }).length, drC = all.filter(function (x) { return x.status === 'draft' || x.status === 'returned'; }).length;
      headCard += '<div class="grid4"><div class="stat"><span class="small muted">الأسئلة</span><b>' + n(all.filter(function (x) { return x.status !== 'archived'; }).length) + '</b></div><div class="stat"><span class="small muted">معتمد</span><b style="color:var(--accent-d)">' + n(apC) + '</b></div><div class="stat"><span class="small muted">قيد المراجعة</span><b style="color:var(--info)">' + n(rvC) + '</b></div><div class="stat"><span class="small muted">مسودة / مُعاد</span><b style="color:var(--warn)">' + n(drC) + '</b></div></div></div>';
      body += headCard;

      if (lesson) {
        var outs = M.outcomesOf(lesson.id);
        body += '<div class="card"><div class="card-h"><h3 class="grow">نواتج التعلم</h3><button class="btn sm" id="b-addo">' + I('plus', 16) + ' ناتج</button></div>' +
          (outs.length ? outs.map(function (o) { var c = S.questions.filter(function (x) { return x.outcomeId === o.id && x.status !== 'archived'; }).length; return '<div class="row" style="padding:6px 0;border-bottom:1px solid #EEF0F4;gap:10px"><span class="chip">' + esc(o.code) + '</span><span style="flex:1">' + esc(o.text) + '</span><span class="small muted">' + n(c) + ' سؤال</span><button class="btn sm ghost" data-eo="' + o.id + '">' + I('edit', 16) + '</button><button class="btn sm ghost" data-do="' + o.id + '" aria-label="حذف">' + I('trash', 16) + '</button></div>'; }).join('') : '<div class="small muted">لم تُضف نواتج تعلم بعد. ربط الأسئلة بالنواتج مطلوب لمصفوفة التغطية.</div>') + '</div>';
        body += M.lessonImagesCard(lesson);
        body += '<div class="card"><div class="card-h"><h3 class="grow">محتوى الدرس (نص اختياري)</h3><button class="btn sm" id="b-ai">' + I('spark', 16) + ' توليد من النص</button></div>' +
          '<textarea id="b-content" class="inp" style="min-height:110px" placeholder="الصق هنا محتوى الدرس أو ملخصه (اختياري) — يُستخدم لاقتراح الأسئلة">' + esc(lesson.content || '') + '</textarea>' +
          '<div class="row" style="margin-top:8px"><button class="btn sm" id="b-savec">حفظ المحتوى</button></div></div>';
        body += '<div class="card"><h3 style="margin-bottom:10px">أضف سؤالاً على هذا الدرس</h3><div class="types">' +
          M.TYPES.map(function (t) { return '<a href="' + M.link('q', 'new', { type: t.id, l: lesson.id }) + '" class="btn" style="flex-direction:column;min-height:76px;gap:4px;font-size:13px">' + I('t_' + t.id, 22) + t.label + '</a>'; }).join('') + '</div></div>';
      } else {
        body += '<div class="card"><h3 style="margin-bottom:10px">مصفوفة التغطية — الدروس × المستويات المعرفية</h3>' + M.matrixHTML(M.coverage(subject.id, scopeIds)) + '</div>';
      }

      /* الفلاتر */
      body += '<div class="row" style="gap:8px"><div class="seg" id="b-ft"><button type="button" data-v="" class="' + (!filt.type ? 'on' : '') + '">كل الأنواع</button>' +
        M.TYPES.filter(function (t) { return all.some(function (x) { return x.type === t.id; }); }).map(function (t) { return '<button type="button" data-v="' + t.id + '" class="' + (filt.type === t.id ? 'on' : '') + '">' + t.label + '</button>'; }).join('') + '</div>' +
        '<select id="b-fs" class="inp" style="width:auto;min-height:38px" aria-label="الحالة"><option value="">كل الحالات</option>' + Object.keys(M.STATUS).map(function (k) { return '<option value="' + k + '"' + (filt.status === k ? ' selected' : '') + '>' + M.STATUS[k].label + '</option>'; }).join('') + '</select>' +
        '<select id="b-fl" class="inp" style="width:auto;min-height:38px" aria-label="المستوى"><option value="">كل المستويات</option>' + M.LEVELS.map(function (l, i) { return '<option value="' + i + '"' + (String(filt.level) === String(i) ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>' +
        '<input id="b-fx" class="inp" style="width:220px;min-height:38px" placeholder="بحث في النص…" value="' + esc(filt.text) + '" aria-label="بحث">' +
        '<span class="small muted">' + n(shown.length) + ' سؤال</span></div>';
      body += '<div id="b-list" style="display:flex;flex-direction:column;gap:10px">' + (shown.length ? shown.slice(0, 80).map(function (x) { return M.qCard(x); }).join('') : '<div class="empty">لا توجد أسئلة مطابقة.</div>') + '</div>' +
        (shown.length > 80 ? '<button class="btn" id="b-more">عرض المزيد (' + n(shown.length - 80) + ')</button>' : '');
    }

    main.innerHTML = M.topbar(title, sub, actions) + '<div class="content"><div class="split">' +
      '<aside class="aside card" style="padding:10px"><div class="row" style="justify-content:space-between;padding:4px 6px 8px"><b>المنهج</b><button class="btn sm" id="b-addsub2">' + I('plus', 16) + ' مادة</button></div><nav class="tree" aria-label="المنهج">' + (tree || '<div class="small muted" style="padding:8px">لا توجد مواد</div>') + '</nav>' +
      (subject && !M.unitsOf(subject.id).length ? '<button class="btn sm" id="b-addu2" style="margin:8px">' + I('plus', 16) + ' أول وحدة</button>' : '') + '</aside>' +
      '<div class="body">' + body + '</div></div></div>';

    /* ربط الأحداث */
    var on = function (id, fn) { var el = M.qs('#' + id, main); if (el) el.onclick = fn; };
    on('b-addsub', function () { M.editSubject(null); }); on('b-addsub2', function () { M.editSubject(null); });
    on('b-eds', function () { M.editSubject(subject); });
    on('b-dls', function () { delCurriculum('subjects', subject, '#/bank'); });
    on('b-addu', function () { M.editUnit(sid, null); }); on('b-addu2', function () { M.editUnit(sid, null); });
    on('b-edu', function () { M.editUnit(sid, unit); });
    on('b-dlu', function () { delCurriculum('units', unit, M.link('bank', '', { s: sid })); });
    on('b-addl', function () { M.editLesson(unit, null); });
    on('b-edl', function () { M.editLesson(unit, lesson); });
    on('b-dll', function () { delCurriculum('lessons', lesson, M.link('bank', '', { s: sid, u: unit.id })); });
    on('b-addo', function () { M.editOutcome(lesson, null); });
    M.qsa('[data-eo]', main).forEach(function (b) { b.onclick = function () { M.editOutcome(lesson, M.byId('outcomes', b.dataset.eo)); }; });
    M.qsa('[data-do]', main).forEach(function (b) {
      b.onclick = function () {
        var o = M.byId('outcomes', b.dataset.do);
        var used = S.questions.filter(function (x) { return x.outcomeId === o.id; }).length;
        if (used) return M.toast('الناتج مرتبط بـ ' + n(used) + ' سؤال — عدّلها أولاً', 'bad');
        M.confirm('حذف ناتج التعلم', 'حذف «' + o.code + '»؟', 'حذف', true).then(function (ok) { if (ok) M.remove('outcomes', o.id).then(M.render); });
      };
    });
    if (lesson) M.bindLessonImages(main, lesson);
    on('b-savec', function () { lesson.content = M.qs('#b-content', main).value; M.save('lessons', lesson).then(function () { M.toast('تم حفظ المحتوى', 'ok'); }); });
    on('b-ai', function () { lesson.content = M.qs('#b-content', main).value; M.save('lessons', lesson, { log: false }); M.aiDialog2(lesson); });
    on('b-xl', function () { M.exportBankExcel(shown, 'بنك-' + (lesson ? lesson.name : unit ? unit.name : subject.name)); });
    on('b-wd', function () { M.exportBankWord(shown, 'بنك أسئلة ' + (lesson ? lesson.name : unit ? unit.name : 'مادة ' + subject.name)); });
    on('b-imp', function () {
      M.pickFile('.xlsx,.xls,.csv').then(function (f) {
        if (!f[0]) return;
        return M.readFile(f[0], 'buffer').then(function (buf) { return M.importBankExcel(new Uint8Array(buf), { subjectId: sid, unitId: unit && unit.id, lessonId: lesson && lesson.id }); }).then(function (res) {
          M.toast('تم استيراد ' + n(res.created) + ' سؤال كمسودة' + (res.skipped ? ' (تخطي ' + n(res.skipped) + ' موجود)' : ''), 'ok'); M.render();
        });
      }).catch(function (e) { M.toast('تعذّر الاستيراد: ' + e.message, 'bad'); });
    });
    var setQ = function (k, v) { var nq = Object.assign({}, q); nq[k] = v; M.go(M.link('bank', '', nq)); };
    M.qsa('#b-ft button', main).forEach(function (b) { b.onclick = function () { setQ('t', b.dataset.v); }; });
    var fs = M.qs('#b-fs', main); if (fs) fs.onchange = function () { setQ('st', fs.value); };
    var fl = M.qs('#b-fl', main); if (fl) fl.onchange = function () { setQ('lv', fl.value); };
    var fx = M.qs('#b-fx', main); if (fx) fx.onkeydown = function (e) { if (e.key === 'Enter') setQ('x', fx.value.trim()); };
    var more = M.qs('#b-more', main);
    if (more) more.onclick = function () { M.qs('#b-list', main).insertAdjacentHTML('beforeend', shown.slice(80).map(function (x) { return M.qCard(x); }).join('')); more.remove(); bindCards(); };
    function bindCards() { M.qsa('[data-more]', main).forEach(function (b) { b.onclick = function () { M.qMenu(M.byId('questions', b.dataset.more)); }; }); }
    bindCards();
  };

  /* ===== اقتراح الأسئلة ===== */
  M.aiDialog = function (lesson) {
    var sel = ['mcq', 'tf', 'complete', 'reason'];
    M.modal({
      title: 'اقتراح أسئلة من محتوى الدرس', wide: true,
      body: '<div class="alert info">' + I('spark') + '<div>١) اختر الأنواع والعدد. ٢) انسخ الطلب والصقه في Claude أو أي مساعد ذكاء اصطناعي. ٣) الصق الرد هنا. كل الأسئلة تدخل <b>مسودة</b> وتحتاج مراجعتك واعتمادك قبل الاستخدام.</div></div>' +
        (!lesson.content ? '<div class="alert warn">' + I('warn') + '<div>لم يُكتب محتوى الدرس بعد — الاقتراح يكون أدق مع المحتوى.</div></div>' : '') +
        '<div class="field"><span class="lbl">الأنواع</span><div class="row" id="ai-types" style="gap:6px">' + M.TYPES.filter(function (t) { return t.id !== 'image'; }).map(function (t) { return '<label class="check chip" style="min-height:34px"><input type="checkbox" value="' + t.id + '"' + (sel.indexOf(t.id) >= 0 ? ' checked' : '') + '>' + t.label + '</label>'; }).join('') + '</div></div>' +
        '<div class="field" style="max-width:200px"><label for="ai-n">عدد الأسئلة لكل نوع</label><input id="ai-n" class="inp" inputmode="numeric" value="٥"></div>' +
        '<div class="field"><label for="ai-p">الطلب الجاهز</label><textarea id="ai-p" class="inp" style="min-height:160px;font-size:13px" readonly></textarea></div>' +
        '<div class="row"><button class="btn" id="ai-copy">' + I('copy') + ' نسخ الطلب</button></div>' +
        '<div class="field"><label for="ai-r">الصق الرد هنا (JSON)</label><textarea id="ai-r" class="inp" style="min-height:140px;font-size:13px;direction:ltr;text-align:left"></textarea></div>',
      foot: '<button class="btn pri" id="ai-imp">استيراد كمسودات</button><button class="btn" data-x>إغلاق</button>',
      onMount: function (m, close) {
        var upd = function () {
          var types = M.qsa('#ai-types input:checked', m).map(function (i) { return i.value; });
          M.qs('#ai-p', m).value = M.aiPrompt(lesson, types, Number(M.toWestern(M.qs('#ai-n', m).value)) || 5);
        };
        upd();
        M.qsa('#ai-types input', m).forEach(function (i) { i.onchange = upd; }); M.qs('#ai-n', m).oninput = upd;
        M.qs('#ai-copy', m).onclick = function () {
          var t = M.qs('#ai-p', m);
          (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(function () { M.toast('تم النسخ', 'ok'); }).catch(function () { t.select(); document.execCommand('copy'); M.toast('تم النسخ', 'ok'); });
        };
        M.qs('#ai-imp', m).onclick = function () {
          M.importAIJson(M.qs('#ai-r', m).value, lesson.id).then(function (c) { close(); M.toast('أضيف ' + n(c) + ' سؤال كمسودة للمراجعة', 'ok'); M.render(); }).catch(function (e) { M.toast(e.message, 'bad'); });
        };
      }
    });
  };

  /* ===== محرر السؤال ===== */
  var SYMBOLS = ['×', '÷', '−', '±', '=', '≠', '≤', '≥', '√', '∛', 'π', '°', '²', '³', '½', '¼', '¾', '∞', '∠', '△', '∥', '⊥', 'س', 'ص', 'ع', 'جا', 'جتا', 'ظا', 'نق', 'Ω', 'μ', 'Δ', '→', '⇌'];

  M.views.q = function (main, r) {
    var isNew = r.id === 'new';
    var q = isNew ? M.newQuestion(r.q.type || 'mcq', r.q.l || '') : JSON.parse(JSON.stringify(M.byId('questions', r.id) || {}));
    if (!q.id) { main.innerHTML = '<div class="content"><div class="empty">السؤال غير موجود</div></div>'; return; }
    var orig = isNew ? null : M.byId('questions', r.id);
    var digits = S.settings.digits || 'arabic';
    var lastField = null;
    var p = M.lessonPath(q.lessonId);
    var subjectId = q.subjectId || (p.subject && p.subject.id) || '';

    function lessonOptions() {
      var h = '<option value="">— اختر الدرس —</option>';
      S.subjects.forEach(function (s) {
        if (subjectId && s.id !== subjectId) return;
        M.unitsOf(s.id).forEach(function (u) {
          h += '<optgroup label="' + esc(s.name + ' — ' + u.name) + '">' + M.lessonsOf(u.id).map(function (l) { return '<option value="' + l.id + '"' + (l.id === q.lessonId ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</optgroup>';
        });
      });
      return h;
    }
    function outcomeOptions() {
      return '<option value="">— بدون —</option>' + (q.lessonId ? M.outcomesOf(q.lessonId).map(function (o) { return '<option value="' + o.id + '"' + (o.id === q.outcomeId ? ' selected' : '') + '>' + esc(o.code + ' — ' + o.text) + '</option>'; }).join('') : '');
    }
    function seg(id, list, val) { return '<div class="seg" id="' + id + '">' + list.map(function (l, i) { return '<button type="button" data-v="' + i + '" class="' + (Number(val) === i ? 'on' : '') + '">' + l + '</button>'; }).join('') + '</div>'; }

    function typeFields() {
      var t = q.type, h = '';
      var txtLabel = { mcq: 'نص السؤال', tf: 'العبارة', complete: 'العبارة — ضع الإجابة بين [[ و ]]', match: 'تعليمة إضافية (اختياري)', term: 'العبارة / التعريف', reason: 'الظاهرة المطلوب تعليلها', essay: 'نص السؤال', draw: 'نص السؤال', image: 'نص السؤال', problem: 'نص المسألة' }[t];
      h += '<div class="field"><label for="f-text">' + txtLabel + '</label><textarea id="f-text" class="inp paper-font" data-k="text">' + esc(q.text) + '</textarea>' +
        (t === 'complete' ? '<div class="row" style="gap:6px"><button type="button" class="btn sm" id="f-mkblank">تحويل الكلمات المحددة إلى فراغ</button><span class="small muted">مثال: محيط المربع = [[٤ × طول الضلع]]</span></div>' : '') + '</div>';
      if (t === 'mcq') {
        h += '<div class="field"><span class="lbl">الاختيارات — اضغط الحرف لتحديد الإجابة الصحيحة</span><div id="f-opts" style="display:flex;flex-direction:column;gap:8px">' +
          q.options.map(function (o, i) { return '<div class="opt-row"><button type="button" class="mark' + (Number(q.correct) === i ? ' on' : '') + '" data-correct="' + i + '" aria-label="الإجابة الصحيحة ' + M.AR_LETTERS[i] + '">' + M.AR_LETTERS[i] + '</button><input class="inp paper-font" data-opt="' + i + '" value="' + esc(o) + '" aria-label="الاختيار ' + M.AR_LETTERS[i] + '">' + (q.options.length > 2 ? '<button type="button" class="btn icon ghost" data-delopt="' + i + '" aria-label="حذف">' + I('x', 16) + '</button>' : '') + '</div>'; }).join('') +
          '</div>' + (q.options.length < 6 ? '<button type="button" class="btn sm" id="f-addopt" style="align-self:flex-start">' + I('plus', 16) + ' اختيار</button>' : '') + '</div>';
      }
      if (t === 'tf') {
        h += '<div class="field"><span class="lbl">الإجابة</span><div class="seg" id="f-ans"><button type="button" data-v="1" class="' + (q.answer ? 'on' : '') + '">صحيحة ✓</button><button type="button" data-v="0" class="' + (!q.answer ? 'on' : '') + '">خطأ ✗</button></div></div>' +
          (!q.answer ? '<div class="field"><label for="f-corr">تصويب العبارة</label><input id="f-corr" class="inp paper-font" data-k="correction" value="' + esc(q.correction) + '"></div>' : '');
      }
      if (t === 'match') {
        h += '<div class="field"><span class="lbl">الأزواج: العمود (أ) ← العمود (ب)</span><div style="display:flex;flex-direction:column;gap:8px">' +
          q.pairs.map(function (pr, i) { return '<div class="opt-row"><span class="mark">' + n(i + 1) + '</span><input class="inp paper-font" data-pa="' + i + '" value="' + esc(pr.a) + '" aria-label="عنصر أ ' + (i + 1) + '"><span>←</span><input class="inp paper-font" data-pb="' + i + '" value="' + esc(pr.b) + '" aria-label="عنصر ب ' + (i + 1) + '">' + (q.pairs.length > 2 ? '<button type="button" class="btn icon ghost" data-delpair="' + i + '" aria-label="حذف">' + I('x', 16) + '</button>' : '') + '</div>'; }).join('') +
          '</div><button type="button" class="btn sm" id="f-addpair" style="align-self:flex-start">' + I('plus', 16) + ' زوج</button></div>';
      }
      if (t === 'match' || t === 'complete') {
        h += '<div class="field"><label for="f-extras">' + (t === 'match' ? 'بدائل زائدة في العمود (ب)' : 'كلمات زائدة في بنك الكلمات') + ' — افصل بينها بـ «؛»</label><input id="f-extras" class="inp paper-font" value="' + esc((q.extras || []).join(' ؛ ')) + '"></div>';
      }
      if (t === 'term') h += '<div class="field"><label for="f-term">المصطلح الصحيح</label><input id="f-term" class="inp paper-font" data-k="term" value="' + esc(q.term) + '"></div>';
      if (t === 'image') {
        h += '<div class="field"><span class="lbl">الصورة</span><div class="row">' + (q.image ? '<img src="' + q.image + '" alt="" style="max-height:160px;border:1px solid var(--line);border-radius:8px">' : '') +
          '<button type="button" class="btn sm" id="f-img">' + (q.image ? 'تغيير الصورة' : 'رفع صورة') + '</button><button type="button" class="btn sm" id="f-drawimg">' + (q.imageShapes ? 'تعديل الرسم' : 'رسمها بأداة الرسم') + '</button>' + (q.image ? '<button type="button" class="btn sm danger" id="f-imgrm">إزالة</button>' : '') + '</div></div>' +
          '<div class="field"><span class="lbl">الأجزاء المرقّمة في الصورة وأسماؤها (للمفتاح)</span><div style="display:flex;flex-direction:column;gap:8px">' +
          q.labels.map(function (l, i) { return '<div class="opt-row"><input class="inp" style="width:70px" data-ln="' + i + '" value="' + esc(l.n) + '" aria-label="الرقم"><input class="inp paper-font" data-lname="' + i + '" value="' + esc(l.name) + '" aria-label="الاسم"><button type="button" class="btn icon ghost" data-dellab="' + i + '" aria-label="حذف">' + I('x', 16) + '</button></div>'; }).join('') +
          '</div><button type="button" class="btn sm" id="f-addlab" style="align-self:flex-start">' + I('plus', 16) + ' جزء</button></div>';
      }
      if (t === 'draw') {
        h += '<div class="grid2"><div class="field"><label for="f-dh">ارتفاع مساحة الرسم (بكسل)</label><input id="f-dh" class="inp" inputmode="numeric" data-kn="drawHeight" value="' + n(q.drawHeight) + '"></div>' +
          '<label class="check" style="align-self:end"><input type="checkbox" id="f-dg"' + (q.drawGrid !== false ? ' checked' : '') + '> شبكة مربعات</label></div>';
      }
      if (t === 'reason' || t === 'essay' || t === 'problem') {
        h += '<div class="field" style="max-width:220px"><label for="f-lines">عدد سطور الإجابة في الورقة</label><input id="f-lines" class="inp" inputmode="numeric" data-kn="lines" value="' + n(q.lines) + '"></div>';
      }
      if (t !== 'mcq' && t !== 'tf' && t !== 'match' && t !== 'complete') {
        h += '<div class="field"><label for="f-model">نموذج الإجابة وتوزيع الدرجات' + (t === 'term' ? ' (اختياري)' : '') + '</label><textarea id="f-model" class="inp paper-font" data-k="modelAnswer" placeholder="مثال: ١) ... (درجة) ٢) ... (درجة)">' + esc(q.modelAnswer) + '</textarea></div>';
      }
      return h;
    }

    function formHTML() {
      return '<div class="card"><div class="grid2">' +
        '<div class="field"><label for="f-lesson">الدرس</label><select id="f-lesson" class="inp">' + lessonOptions() + '</select></div>' +
        '<div class="field"><label for="f-out">ناتج التعلم</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select id="f-out" class="inp">' + outcomeOptions() + '</select><button type="button" class="btn icon" id="f-addout" aria-label="ناتج جديد"' + (q.lessonId ? '' : ' disabled') + '>' + I('plus', 16) + '</button></div></div></div>' +
        '<div class="grid3" style="margin-top:12px"><div class="field"><span class="lbl">المستوى المعرفي</span>' + seg('f-level', M.LEVELS, q.level) + '</div>' +
        '<div class="field"><span class="lbl">الصعوبة</span>' + seg('f-diff', M.DIFFS, q.difficulty) + '</div>' +
        '<div class="field"><label for="f-grade">الدرجة</label><input id="f-grade" class="inp" inputmode="decimal" data-kn="grade" value="' + n(q.grade) + '"></div></div></div>' +
        '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row" style="gap:6px">' + I('t_' + q.type, 20) + '<h3>' + M.TYPE[q.type].label + '</h3>' + (isNew ? '<span class="grow"></span><button type="button" class="btn sm" id="f-chtype">تغيير النوع</button>' : '') + '</div>' +
        '<div class="symbar" aria-label="رموز رياضية وعلمية"><button type="button" class="btn sm pri" id="f-math" style="font-family:Naskh,serif">∑ معادلة</button>' + SYMBOLS.map(function (s) { return '<button type="button" class="btn sm" data-sym="' + esc(s) + '" style="min-width:36px;padding:0 6px;font-family:Naskh,serif">' + esc(s) + '</button>'; }).join('') + '</div>' +
        typeFields() + '</div>' +
        '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row"><h3 style="flex:1">شكل مرفق بالسؤال (اختياري)</h3><button type="button" class="btn sm" id="f-drawfig">' + I('t_draw', 16) + ' ' + (q.figureShapes ? 'تعديل الرسم' : 'رسم شكل') + '</button><button type="button" class="btn sm" id="f-upfig">' + I('t_image', 16) + ' رفع صورة</button>' + (q.figure ? '<button type="button" class="btn sm danger" id="f-rmfig">إزالة</button>' : '') + '</div>' +
        (q.figure ? '<div class="row" style="align-items:flex-start"><img src="' + q.figure + '" alt="الشكل" style="max-width:260px;max-height:180px;border:1px solid var(--line);border-radius:8px;background:#fff"><div class="field" style="min-width:200px"><label for="f-figw">عرض الشكل في الورقة: <span id="f-figwv">' + n(q.figureWidth || 60) + '٪</span></label><input id="f-figw" type="range" min="25" max="100" step="5" value="' + (q.figureWidth || 60) + '"></div></div>' : '<div class="small muted">ارسم شكلاً هندسياً أو مستوى إحداثياً أو خط أعداد، أو ارفع صورة؛ يظهر تحت نص السؤال في الورقة.</div>') + '</div>' +
        (q.reviewNote && q.status === 'returned' ? '<div class="alert bad">' + I('warn') + '<div>ملاحظة المراجع: ' + esc(q.reviewNote) + '</div></div>' : '') +
        (q.evidence ? '<div class="small" style="background:#FFFBEB;border-inline-start:3px solid #D97706;padding:8px 12px;border-radius:8px"><b>الدليل من الكتاب' + (q.evidencePage ? ' (صفحة ' + n(q.evidencePage) + ')' : '') + ': </b>' + esc(q.evidence) + '</div>' : '') +
        '<div id="f-errs"></div>' +
        '<div class="row"><button class="btn pri" id="f-save">' + I('check') + ' حفظ</button><button class="btn" id="f-submit">حفظ وإرسال للمراجعة</button>' +
        (M.can('approve') ? '<button class="btn" id="f-approve">حفظ واعتماد</button>' : '') +
        '<button class="btn" id="f-savenew">حفظ وسؤال جديد</button>' + (!isNew && q.status !== 'approved' && !(q.usedIn || []).length ? '<button class="btn danger" id="f-del">' + I('trash', 16) + ' حذف</button>' : '') + '</div>';
    }

    function previewHTML() {
      return '<div class="preview-h"><span class="live-dot"></span><b>معاينة السؤال في الورقة</b><span class="grow" style="flex:1"></span><div class="seg" id="pv-dg"><button type="button" data-v="arabic" class="' + (digits === 'arabic' ? 'on' : '') + '">١٢٣</button><button type="button" data-v="english" class="' + (digits === 'english' ? 'on' : '') + '">123</button></div></div>' +
        '<div class="preview-body" id="pv-body"></div><div style="padding:10px 14px;border-top:1px solid #EEF0F4" class="small"><b>الإجابة: </b><span id="pv-ans"></span></div>';
    }

    var title = (isNew ? 'سؤال جديد' : 'تعديل سؤال') + ' — ' + M.TYPE[q.type].label;
    main.innerHTML = M.topbar(title, (p.lesson ? esc(p.subject ? p.subject.name : '') + ' · ' + esc(p.lesson.name) : '') + (isNew ? '' : ' · إصدار ' + n(q.ver || 1) + ' · ' + (M.STATUS[q.status] || {}).label), '', p.lesson ? M.link('bank', '', { s: subjectId, l: q.lessonId }) : '#/bank') +
      '<div class="content"><div class="editor"><div class="form" id="f-form">' + formHTML() + '</div><aside class="preview" id="f-pv">' + previewHTML() + '</aside></div></div>';

    function readForm() {
      var f = M.qs('#f-form', main);
      M.qsa('[data-k]', f).forEach(function (el) { q[el.dataset.k] = el.value; });
      M.qsa('[data-kn]', f).forEach(function (el) { var v = Number(M.toWestern(el.value)); q[el.dataset.kn] = isFinite(v) ? v : 0; });
      M.qsa('[data-opt]', f).forEach(function (el) { q.options[+el.dataset.opt] = el.value; });
      M.qsa('[data-pa]', f).forEach(function (el) { q.pairs[+el.dataset.pa].a = el.value; });
      M.qsa('[data-pb]', f).forEach(function (el) { q.pairs[+el.dataset.pb].b = el.value; });
      M.qsa('[data-ln]', f).forEach(function (el) { q.labels[+el.dataset.ln].n = el.value; });
      M.qsa('[data-lname]', f).forEach(function (el) { q.labels[+el.dataset.lname].name = el.value; });
      var ex = M.qs('#f-extras', f); if (ex) q.extras = ex.value.split(/[؛;]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var dg = M.qs('#f-dg', f); if (dg) q.drawGrid = dg.checked;
      q.lessonId = M.qs('#f-lesson', f).value;
      q.outcomeId = M.qs('#f-out', f).value;
      var lp = M.lessonPath(q.lessonId); if (lp.subject) q.subjectId = lp.subject.id;
    }
    function updPreview() {
      M.qs('#pv-body', main).innerHTML = M.renderQuestionPreview(q, digits);
      var a = q.type === 'match' ? q.pairs.filter(function (x) { return x.a; }).map(function (x) { return x.a + ' ← ' + x.b; }).join(' · ') : M.answerText(q);
      M.qs('#pv-ans', main).innerHTML = a ? M.richText(a, digits, { answers: true }) : '—';
    }
    var liveUpd = M.debounce(function () { readForm(); updPreview(); }, 150);

    function rebuild() { M.qs('#f-form', main).innerHTML = formHTML(); bind(); updPreview(); }
    function bind() {
      var f = M.qs('#f-form', main);
      f.oninput = liveUpd; f.onchange = liveUpd;
      f.addEventListener('focusin', function (e) { if (e.target.matches('input.inp,textarea.inp')) lastField = e.target; });
      M.qsa('[data-sym]', f).forEach(function (b) {
        b.onmousedown = function (e) { e.preventDefault(); };
        b.onclick = function () {
          var el = lastField || M.qs('#f-text', f); if (!el) return;
          var s = el.selectionStart || el.value.length, en = el.selectionEnd || s;
          el.value = el.value.slice(0, s) + b.dataset.sym + el.value.slice(en);
          el.focus(); el.selectionStart = el.selectionEnd = s + b.dataset.sym.length; liveUpd();
        };
      });
      M.qs('#f-lesson', f).onchange = function () { readForm(); q.outcomeId = ''; M.qs('#f-out', f).innerHTML = outcomeOptions(); M.qs('#f-addout', f).disabled = !q.lessonId; updPreview(); };
      M.qs('#f-addout', f).onclick = function () { readForm(); var l = M.byId('lessons', q.lessonId); if (l) M.editOutcome(l, null, function (o) { q.outcomeId = o.id; M.qs('#f-out', f).innerHTML = outcomeOptions(); }); };
      ['f-level', 'f-diff'].forEach(function (id) {
        M.qsa('#' + id + ' button', f).forEach(function (b) { b.onclick = function () { q[id === 'f-level' ? 'level' : 'difficulty'] = Number(b.dataset.v); M.qsa('#' + id + ' button', f).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      });
      M.qsa('[data-correct]', f).forEach(function (b) { b.onclick = function () { readForm(); q.correct = Number(b.dataset.correct); rebuild(); }; });
      M.qsa('[data-delopt]', f).forEach(function (b) { b.onclick = function () { readForm(); var i = +b.dataset.delopt; q.options.splice(i, 1); if (q.correct >= q.options.length || q.correct === i) q.correct = 0; else if (q.correct > i) q.correct--; rebuild(); }; });
      var ao = M.qs('#f-addopt', f); if (ao) ao.onclick = function () { readForm(); q.options.push(''); rebuild(); };
      M.qsa('#f-ans button', f).forEach(function (b) { b.onclick = function () { readForm(); q.answer = b.dataset.v === '1'; rebuild(); }; });
      var ap = M.qs('#f-addpair', f); if (ap) ap.onclick = function () { readForm(); q.pairs.push({ a: '', b: '' }); rebuild(); };
      M.qsa('[data-delpair]', f).forEach(function (b) { b.onclick = function () { readForm(); q.pairs.splice(+b.dataset.delpair, 1); rebuild(); }; });
      var al = M.qs('#f-addlab', f); if (al) al.onclick = function () { readForm(); q.labels.push({ n: String(q.labels.length + 1), name: '' }); rebuild(); };
      M.qsa('[data-dellab]', f).forEach(function (b) { b.onclick = function () { readForm(); q.labels.splice(+b.dataset.dellab, 1); rebuild(); }; });
      var im = M.qs('#f-img', f); if (im) im.onclick = function () { readForm(); M.pickFile('image/*').then(function (fl) { if (!fl[0]) return; return M.readFile(fl[0], 'dataurl').then(function (d) { return M.shrinkImage(d, 1000); }).then(function (d) { q.image = d; rebuild(); }); }); };
      var mt = M.qs('#f-math', f); if (mt) { mt.onmousedown = function (e) { e.preventDefault(); }; mt.onclick = function () {
        var el = lastField || M.qs('#f-text', f); readForm();
        M.mathEditor('', function (ins) { var s0 = el.selectionStart != null ? el.selectionStart : el.value.length; el.value = el.value.slice(0, s0) + ins + el.value.slice(el.selectionEnd || s0); el.focus(); liveUpd(); });
      }; }
      var df = M.qs('#f-drawfig', f); if (df) df.onclick = function () { readForm(); M.drawEditor({ shapes: q.figureShapes, grid: q.figureGrid }, function (r) { q.figure = r.image; q.figureShapes = r.shapes; q.figureGrid = r.grid; q.figureWidth = q.figureWidth || 60; rebuild(); }); };
      var uf = M.qs('#f-upfig', f); if (uf) uf.onclick = function () { readForm(); M.pickFile('image/*').then(function (fl) { if (!fl[0]) return; return M.readFile(fl[0], 'dataurl').then(function (d) { return M.shrinkImage(d, 1200); }).then(function (d) { q.figure = d; q.figureShapes = null; q.figureWidth = q.figureWidth || 60; rebuild(); }); }); };
      var rf = M.qs('#f-rmfig', f); if (rf) rf.onclick = function () { readForm(); q.figure = ''; q.figureShapes = null; rebuild(); };
      var fw = M.qs('#f-figw', f); if (fw) fw.oninput = function () { q.figureWidth = Number(fw.value); M.qs('#f-figwv', f).textContent = n(fw.value) + '٪'; updPreview(); };
      var dimg = M.qs('#f-drawimg', f); if (dimg) dimg.onclick = function () { readForm(); M.drawEditor({ shapes: q.imageShapes }, function (r) { q.image = r.image; q.imageShapes = r.shapes; rebuild(); }); };
      var ir = M.qs('#f-imgrm', f); if (ir) ir.onclick = function () { readForm(); q.image = ''; rebuild(); };
      var mb = M.qs('#f-mkblank', f); if (mb) mb.onclick = function () {
        var el = M.qs('#f-text', f), s = el.selectionStart, e = el.selectionEnd;
        if (s === e) return M.toast('حدّد الكلمات التي ستصبح فراغاً أولاً', 'bad');
        el.value = el.value.slice(0, s) + '[[' + el.value.slice(s, e) + ']]' + el.value.slice(e); liveUpd();
      };
      var ct = M.qs('#f-chtype', f); if (ct) ct.onclick = function () {
        M.modal({ title: 'نوع السؤال', body: '<div class="types">' + M.TYPES.map(function (t) { return '<button type="button" data-t="' + t.id + '" class="' + (t.id === q.type ? 'on' : '') + '">' + I('t_' + t.id, 22) + t.label + '</button>'; }).join('') + '</div>',
          onMount: function (m, close) { M.qsa('[data-t]', m).forEach(function (b) { b.onclick = function () { close(); readForm(); var nq = M.newQuestion(b.dataset.t, q.lessonId); nq.id = q.id; nq.text = q.text; nq.level = q.level; nq.difficulty = q.difficulty; nq.outcomeId = q.outcomeId; q = nq; main.querySelector('.topbar h1').textContent = 'سؤال جديد — ' + M.TYPE[q.type].label; rebuild(); }; }); } });
      };
      var go = function (status, then) {
        readForm();
        var errs = M.validateQuestion(q);
        if (status !== 'draft' && errs.length) { M.qs('#f-errs', main).innerHTML = '<div class="alert bad">' + I('warn') + '<div>' + errs.map(esc).join('<br>') + '</div></div>'; return; }
        if (!q.lessonId) { M.qs('#f-errs', main).innerHTML = '<div class="alert bad">' + I('warn') + '<div>اختر الدرس</div></div>'; return; }
        var wasApproved = orig && orig.status === 'approved';
        if (status === 'draft') { if (wasApproved && M.can('approve')) status = 'approved'; else if (wasApproved) status = 'review'; else if (q.status === 'review' || q.status === 'approved') status = q.status; }
        q.status = status;
        if (status === 'approved') { q.approvedBy = M.me().name; q.approvedAt = M.now(); q.reviewNote = ''; }
        M.save('questions', q).then(function () {
          if (wasApproved && status === 'review') M.toast('عُدّل سؤال معتمد — رجع لحالة «قيد المراجعة» وارتفع رقم إصداره', 'ok');
          else M.toast(status === 'review' ? 'تم الحفظ والإرسال للمراجعة' : status === 'approved' ? 'تم الحفظ والاعتماد' : 'تم الحفظ', 'ok');
          then();
        });
      };
      var back = function () { M.go(M.link('bank', '', { s: q.subjectId, l: q.lessonId })); };
      M.qs('#f-save', main).onclick = function () { go('draft', back); };
      M.qs('#f-submit', main).onclick = function () { go('review', back); };
      var fa = M.qs('#f-approve', main); if (fa) fa.onclick = function () { go('approved', back); };
      M.qs('#f-savenew', main).onclick = function () { go('draft', function () { M.go(M.link('q', 'new', { type: q.type, l: q.lessonId, n: Date.now() })); }); };
      var fd = M.qs('#f-del', main); if (fd) fd.onclick = function () { M.confirm('حذف السؤال', 'حذف هذا السؤال نهائياً؟', 'حذف', true).then(function (ok) { if (ok) M.remove('questions', q.id).then(back); }); };
    }
    bind();
    M.qsa('#pv-dg button', main).forEach(function (b) { b.onclick = function () { digits = b.dataset.v; M.qsa('#pv-dg button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); updPreview(); }; });
    updPreview();
  };

  /* ===== المراجعة ===== */
  M.views.review = function (main) {
    if (!M.can('approve')) { main.innerHTML = M.topbar('المراجعة والاعتماد') + '<div class="content"><div class="empty">هذه الشاشة لرئيس القسم ومدير النظام.</div></div>'; return; }
    var list = M.pendingReview().sort(function (a, b) { return a.updatedAt < b.updatedAt ? -1 : 1; });
    var bySub = {};
    list.forEach(function (q) { (bySub[q.subjectId] = bySub[q.subjectId] || []).push(q); });
    var h = '';
    Object.keys(bySub).forEach(function (sid) {
      var s = M.byId('subjects', sid);
      h += '<h2>' + esc(s ? s.name : 'بدون مادة') + ' <span class="small muted">(' + n(bySub[sid].length) + ')</span></h2>';
      h += bySub[sid].map(function (q) {
        var errs = M.validateQuestion(q);
        return '<div class="card" style="display:flex;flex-direction:column;gap:10px" data-rq="' + q.id + '"><div class="row"><input type="checkbox" class="qsel" data-id="' + q.id + '" aria-label="تحديد" style="width:18px;height:18px;accent-color:var(--accent)">' + M.typeChip(q.type) +
          '<span class="chip">' + esc((M.lessonPath(q.lessonId).lesson || {}).name || '—') + '</span><span class="chip info">' + M.LEVELS[q.level] + '</span><span class="small muted">بواسطة ' + esc(q.createdBy || q.updatedByName || '') + ' · إصدار ' + n(q.ver || 1) + '</span>' + (q.source === 'ai' ? '<span class="chip warn">مقترح آلياً — راجع الدقة العلمية</span>' : '') + '</div>' +
          '<div style="background:#E9EBF0;border-radius:10px;padding:10px">' + M.renderQuestionPreview(q, S.settings.digits) + '</div>' +
          '<div class="small"><b>الإجابة / النموذج: </b>' + M.richText(q.type === 'match' ? q.pairs.map(function (x) { return x.a + ' ← ' + x.b; }).join(' · ') : M.answerText(q), 'arabic', { answers: true }) + '</div>' +
          (q.evidence ? '<div class="small" style="background:#FFFBEB;border-inline-start:3px solid #D97706;padding:6px 10px;border-radius:6px"><b>الدليل من الكتاب' + (q.evidencePage ? ' (صفحة ' + n(q.evidencePage) + ')' : '') + ': </b>' + esc(q.evidence) + '</div>' : '') +
          (errs.length ? '<div class="alert warn">' + I('warn') + '<div>' + errs.map(esc).join('، ') + '</div></div>' : '') +
          '<div class="row"><button class="btn pri sm" data-ok="' + q.id + '"' + (errs.length ? ' disabled' : '') + '>' + I('check', 16) + ' اعتماد</button><button class="btn sm" data-ret="' + q.id + '">إعادة بملاحظة</button><a class="btn sm" href="#/q/' + q.id + '">' + I('edit', 16) + ' تعديل</a></div></div>';
      }).join('');
    });
    main.innerHTML = M.topbar('المراجعة والاعتماد', n(list.length) + ' سؤال بانتظار المراجعة', list.length ? '<button class="btn pri" id="rv-bulk">اعتماد المحدد</button>' : '') +
      '<div class="content">' + (h || '<div class="empty">لا توجد أسئلة بانتظار المراجعة.</div>') + '</div>';
    var refresh = function () { M.refreshNav(); M.render(); };
    M.qsa('[data-ok]', main).forEach(function (b) { b.onclick = function () { M.setStatus(M.byId('questions', b.dataset.ok), 'approved', '').then(refresh); }; });
    M.qsa('[data-ret]', main).forEach(function (b) { b.onclick = function () { M.prompt('إعادة بملاحظة', 'ملاحظتك للمدرس', '').then(function (note) { if (note) M.setStatus(M.byId('questions', b.dataset.ret), 'returned', note).then(refresh); }); }; });
    var bulk = M.qs('#rv-bulk', main);
    if (bulk) bulk.onclick = function () {
      var ids = M.qsa('.qsel:checked', main).map(function (c) { return c.dataset.id; });
      if (!ids.length) return M.toast('حدّد أسئلة أولاً', 'bad');
      var ok = ids.map(function (id) { return M.byId('questions', id); }).filter(function (q) { return !M.validateQuestion(q).length; });
      Promise.all(ok.map(function (q) { return M.setStatus(q, 'approved', ''); })).then(function () { M.toast('اعتُمد ' + n(ok.length) + ' سؤال' + (ok.length < ids.length ? ' — وتُرك ' + n(ids.length - ok.length) + ' ناقص' : ''), 'ok'); refresh(); });
    };
  };
})(window.M);
