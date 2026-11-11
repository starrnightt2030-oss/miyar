/* ===== استوديو الامتحان =====
   الورقة والتحرير في شاشة واحدة: الكمبيوتر وعرض الموبايل الأفقي جنباً إلى جنب،
   والموبايل الرأسي: الأسئلة فوق والورقة تحتها. كل تعديل يظهر على الورقة لحظياً. */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;

  M.TEMPLATES = [
    { id: 'classic', name: 'رسمي كلاسيكي' }, { id: 'modern', name: 'حديث' }, { id: 'minimal', name: 'بسيط — يوفّر الحبر' },
    { id: 'frame', name: 'إطار رسمي' }, { id: 'band', name: 'شريط ملوّن' }, { id: 'elegant', name: 'أنيق — خط نسخ' }
  ];
  M.ACCENTS = [['#1F2A44', 'كحلي'], ['#1D4ED8', 'أزرق'], ['#B91C1C', 'أحمر'], ['#0F766E', 'أخضر'], ['#6D28D9', 'بنفسجي'], ['#111827', 'أسود']];
  var SEPS = [['none', 'بدون'], ['space', 'مسافة'], ['dotted', 'خط منقّط'], ['line', 'خط متصل'], ['box', 'مربع لكل فرع']];
  var POS = [['above', 'فوق'], ['below', 'تحت'], ['side-start', 'يمين'], ['side', 'يسار'], ['after', 'بعد الحل']];
  var TYPE_HELP = { mcq: 'اختيارات وإجابة صحيحة', tf: 'صح أو خطأ مع التصويب', complete: 'فراغات وبنك كلمات', match: 'عمودان (أ) و(ب)', term: 'اكتب المصطلح العلمي', reason: 'علّل مع سطور للإجابة', essay: 'سؤال مقالي بسطور', draw: 'مساحة رسم بشبكة', image: 'صورة بأجزاء مرقّمة', problem: 'مسألة بسطور للحل' };
  var SYMS = ['Ω', 'µ', 'Δ', 'θ', 'π', '°', '±', '×', '÷', '√', '≤', '≥', '≠', '≈', '∞', '→', '⇌', '²', '³', '½', '¼', '∠', '⊥', '∥', 'α', 'β', 'λ', '∑'];
  var SOL_TYPES = ['mcq', 'complete', 'term', 'tf'];
  var LINE_TYPES = ['reason', 'essay', 'problem'];

  /* نافذة اختيار نوع السؤال */
  M.typeSheet = function (title, cb) {
    M.modal({ title: title, wide: true,
      body: '<div class="type-grid">' + M.TYPES.map(function (t) { return '<button type="button" class="type-card" data-t="' + t.id + '"><span class="ic">' + I('t_' + t.id, 24) + '</span><b>' + t.label + '</b><span>' + (TYPE_HELP[t.id] || '') + '</span></button>'; }).join('') + '</div>',
      onMount: function (m, close) { M.qsa('[data-t]', m).forEach(function (b) { b.onclick = function () { close(); cb(b.dataset.t); }; }); } });
  };

  M.views.studio = function (app, r) {
    var stored = M.byId('exams', r.id);
    if (!stored) { app.innerHTML = '<div class="content"><div class="empty">الامتحان غير موجود</div><a class="btn" href="#/exams">رجوع</a></div>'; return; }
    var e = JSON.parse(JSON.stringify(stored));
    e.local = e.local || {};
    if (!e.mode) e.mode = 'manual';
    var sel = null, tab = 'q', view = 'paper', zoom = 0, lastSelKey = '', lastField = null, alive = true;
    var hist = [], fut = [], lastSnap = JSON.stringify(e), burst = false, histTimer = null;
    var mq = window.matchMedia('(min-width: 900px), (orientation: landscape) and (min-width: 560px)');

    /* ===== الحالة والسجل ===== */
    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function sec(i) { return e.sections[i]; }
    function itemAt(s, i) { var se = sec(s); return se ? se.items[i] : null; }
    function qOf(it) {
      if (!it) return null;
      var q = e.local[it.qid];
      if (!q) { var b = M.examQ(e, it.qid); if (!b) return null; q = clone(b); e.local[q.id] = q; }
      if (it.lay) { M.LAY_KEYS.forEach(function (k) { if (it.lay[k] != null && it.lay[k] !== '') q[k] = it.lay[k]; }); it.lay = null; }
      if (it.grade != null && it.grade !== '') { q.grade = Number(it.grade); it.grade = null; }
      return q;
    }
    function newItem(type) {
      var q = M.newQuestion(type, ''); q.subjectId = ''; q.source = 'exam'; q.solLines = 0;
      e.local[q.id] = q; return { qid: q.id, grade: null };
    }
    var saveState = function (t) { var el = M.qs('#sd-save', app); if (el) el.textContent = t; };
    var persist = M.debounce(function () {
      if (!alive) return;
      M.save('exams', clone(e), { log: false }).then(function () { saveState('محفوظ ✓'); });
    }, 450);
    function recordHist() {
      if (!burst) { hist.push(lastSnap); if (hist.length > 80) hist.shift(); fut = []; burst = true; }
      clearTimeout(histTimer); histTimer = setTimeout(function () { burst = false; lastSnap = JSON.stringify(e); }, 650);
    }
    var paperSoon = M.debounce(function () { renderPaper(); }, 160);
    /* كل تعديل يمر من هنا */
    function touch(redrawPane) {
      recordHist(); saveState('جارٍ الحفظ…'); persist(); paperSoon();
      if (redrawPane) drawPane();
      updUndo();
    }
    function restore(snap) {
      e = JSON.parse(snap); lastSnap = snap; burst = false; clearTimeout(histTimer);
      if (sel && (!sec(sel.s) || (sel.i >= 0 && !itemAt(sel.s, sel.i)))) sel = null;
      saveState('جارٍ الحفظ…'); persist(); drawPane(); renderPaper(); updUndo(); drawHead();
    }
    function undo() { if (burst) { burst = false; clearTimeout(histTimer); } if (!hist.length) return; fut.push(JSON.stringify(e)); restore(hist.pop()); M.toast('تراجع'); }
    function redo() { if (!fut.length) return; hist.push(JSON.stringify(e)); restore(fut.pop()); }
    function updUndo() { var u = M.qs('#sd-undo', app), rd = M.qs('#sd-redo', app); if (u) u.disabled = !hist.length && !burst; if (rd) rd.disabled = !fut.length; }

    /* ===== الهيكل ===== */
    var split = Number(localStorage.getItem('sd-split') || 0) || 0;
    app.innerHTML = '<div class="sd" id="sd">' +
      '<header class="sd-top"><a class="btn icon ghost" href="#/exams" aria-label="رجوع إلى الامتحانات">' + I('back') + '</a>' +
      '<div class="sd-ttl"><input id="sd-title" aria-label="اسم الامتحان"><span class="small muted"><span id="sd-sub"></span> · <span id="sd-save">محفوظ ✓</span></span></div>' +
      '<button class="btn icon ghost" id="sd-undo" aria-label="تراجع" title="تراجع (Ctrl+Z)">' + I('undo') + '</button><button class="btn icon ghost" id="sd-redo" aria-label="إعادة" title="إعادة (Ctrl+Y)">' + I('redo') + '</button>' +
      '<button class="btn hide-sm" id="sd-pdf">' + I('download', 16) + ' PDF</button><button class="btn hide-sm" id="sd-word">' + I('download', 16) + ' Word</button><button class="btn pri" id="sd-out">' + I('print', 16) + ' إخراج</button></header>' +
      '<div class="sd-body" id="sd-body">' +
      '<section class="sd-panel" id="sd-panel"><nav class="sd-tabs" role="tablist">' +
      [['q', 'الأسئلة'], ['tpl', 'القالب'], ['info', 'البيانات'], ['check', 'المراجعة']].map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
      '</nav><div class="sd-pane" id="sd-pane"></div></section>' +
      '<div class="sd-split" id="sd-split" role="separator" aria-label="اسحب لتغيير المساحة"><span></span></div>' +
      '<section class="sd-paper" aria-label="معاينة الورقة"><div class="sd-ptools"><div class="seg" id="sd-view"><button type="button" data-v="paper" class="on">الورقة</button><button type="button" data-v="key">المفتاح</button></div>' +
      '<span class="sd-pc" id="sd-pc"></span><span style="flex:1"></span>' +
      '<button class="btn icon sm ghost" id="sd-zo" aria-label="تصغير">' + I('zout', 18) + '</button><button class="btn sm ghost" id="sd-zf" aria-label="ملء العرض">' + I('fit', 16) + '</button><button class="btn icon sm ghost" id="sd-zi" aria-label="تكبير">' + I('zin', 18) + '</button></div>' +
      '<div class="sd-pages" id="sd-pages"></div></section></div></div>';
    var body = M.qs('#sd-body', app), pagesBox = M.qs('#sd-pages', app);
    if (split) body.style.setProperty('--split', split + '%');

    function drawHead() {
      var t = M.qs('#sd-title', app); if (document.activeElement !== t) t.value = e.title || '';
      M.qs('#sd-sub', app).textContent = [M.examSubject(e) || 'بدون مادة', e.className].filter(Boolean).join(' · ') + ' · ' + n(M.examTotal(e)) + ' درجة';
    }
    drawHead();
    M.qs('#sd-title', app).oninput = function (ev) { e.title = ev.target.value; touch(); };
    M.qs('#sd-undo', app).onclick = undo; M.qs('#sd-redo', app).onclick = redo;

    /* ===== لوحة التحرير ===== */
    function setTab(t) { tab = t; M.qsa('[data-tab]', app).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); }); drawPane(); }
    M.qsa('[data-tab]', app).forEach(function (b) { b.onclick = function () { if (b.dataset.tab === 'q' && tab === 'q') sel = null; setTab(b.dataset.tab); }; });

    function drawPane() {
      var pane = M.qs('#sd-pane', app); if (!pane) return;
      var keep = pane.scrollTop;
      if (tab === 'q') pane.innerHTML = sel ? (sel.i >= 0 ? itemHTML() : sectionHTML()) : outlineHTML();
      else if (tab === 'tpl') pane.innerHTML = tplHTML();
      else if (tab === 'info') pane.innerHTML = infoHTML();
      else pane.innerHTML = checkHTML();
      bindPane(pane);
      if (tab !== 'q' || !sel || sel.keepScroll) pane.scrollTop = keep;
      drawHead();
      highlight();
    }

    /* --- الهيكل: الأسئلة الرئيسية وأجزاؤها وفروعها --- */
    function outlineHTML() {
      var si = M.secInfo(e), h = '<div class="ol">';
      h += '<div class="ol-h"><b>هيكل الورقة</b><span class="chip">' + n(si.groups.length) + ' أسئلة · ' + n(M.examTotal(e)) + (e.totalGrade ? ' من ' + n(e.totalGrade) : '') + ' درجة</span></div>';
      if (!e.sections.length) h += '<div class="ol-empty">' + I('exam', 34) + '<b>ابدأ بأول سؤال</b><span>اختر نوعه، وسيظهر على الورقة فوراً</span></div>';
      si.groups.forEach(function (g, gi) {
        var first = sec(g.start);
        h += '<div class="ol-q"><button type="button" class="ol-qh" data-sec="' + g.start + '"><span class="no">' + n(gi + 1) + '</span><span class="t"><b>' + esc(g.secs.length > 1 ? (first.mainTitle || 'أجب عن الأسئلة الآتية:') : (first.title || M.TYPE[first.type].title)) + '</b><small>' + (g.secs.length > 1 ? n(g.secs.length) + ' أجزاء' : M.TYPE[first.type].label) + '</small></span><span class="g">' + n(M.groupGrade(e, g)) + '</span></button>';
        g.secs.forEach(function (s, k) {
          var se = sec(s);
          if (g.secs.length > 1) h += '<button type="button" class="ol-part" data-sec="' + s + '"><b>(' + M.partLabel(e, k) + ')</b> ' + esc(se.title || M.TYPE[se.type].title) + ' <small>' + M.TYPE[se.type].label + ' · ' + n(M.sectionGrade(e, se)) + '</small></button>';
          se.items.forEach(function (it, j) {
            var q = M.examQ(e, it.qid), txt = q ? M.plainText(q.type === 'match' ? (q.pairs || []).map(function (p) { return p.a; }).filter(Boolean).join(' · ') : q.text).replace(/\[\[(.*?)\]\]/g, '……') : '';
            h += '<button type="button" class="ol-it" data-it="' + s + ':' + j + '"><span class="n">' + n(j + 1) + ')</span><span class="x">' + (esc(txt.slice(0, 90)) || '<i>فرع فارغ — اضغط للكتابة</i>') + '</span>' + (q && q.figure ? I('t_image', 14) : '') + '<span class="g">' + n(M.itemGrade(e, it)) + '</span></button>';
          });
          h += '<button type="button" class="ol-add" data-additem="' + s + '">+ فرع</button>';
        });
        h += '<button type="button" class="ol-add part" data-addpart="' + g.start + '">+ جزء (' + M.partLabel(e, g.secs.length) + ') لهذا السؤال</button></div>';
      });
      h += '<button type="button" class="btn pri lg ol-new" id="ol-new">' + I('plus') + ' سؤال رئيسي جديد</button>' +
        '<button type="button" class="btn ol-ai" id="ol-ai">' + I('spark') + ' استيراد أسئلة جاهزة — نص أو صورة</button></div>';
      return h;
    }

    /* --- إعدادات السؤال الرئيسي / الجزء --- */
    function sectionHTML() {
      var s = sec(sel.s), si = M.secInfo(e), inf = si.info[sel.s], g = si.groups[inf.main];
      var lbl = 'السؤال ' + M.ordinal(inf.main) + (inf.hasParts ? ' — الجزء (' + M.partLabel(e, inf.part) + ')' : '');
      return '<div class="ie">' + crumb(lbl, M.TYPE[s.type].label) +
        (inf.hasParts && inf.first ? field('نص السؤال الرئيسي (فوق الأجزاء)', '<input class="inp paper-font" data-sk="mainTitle" value="' + esc(s.mainTitle || '') + '" placeholder="أجب عن الأسئلة الآتية:">') : '') +
        field('عنوان ' + (inf.hasParts ? 'الجزء' : 'السؤال') + ' في الورقة', '<input class="inp paper-font" data-sk="title" value="' + esc(s.title || '') + '" placeholder="' + esc(M.TYPE[s.type].title) + '">') +
        field('الفاصل بين الفروع', segHTML('sk-sep', SEPS, s.sep || '', 'من القالب')) +
        (s.type === 'mcq' ? field('الاختيارات في السطر', segHTML('sk-cols', [['auto', 'تلقائي'], ['1', '١'], ['2', '٢'], ['4', '٤']], String(s.optCols || 'auto'))) +
          '<label class="check"><input type="checkbox" data-sb="layout2"' + (s.layout === 'two' ? ' checked' : '') + '> فرعان متجاوران في كل سطر</label>' : '') +
        (s.type === 'complete' ? '<label class="check"><input type="checkbox" data-sb="wordBank"' + (s.wordBank !== false ? ' checked' : '') + '> بنك الكلمات في برواز فوق الفروع</label>' : '') +
        (sel.s > 0 ? '<label class="check"><input type="checkbox" data-sb="part"' + (s.part ? ' checked' : '') + '> هذا جزء من السؤال السابق (أ، ب، ج…)</label>' : '') +
        '<div class="ie-row"><div class="field"><span class="lbl">درجة موحدة لكل الفروع</span><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="inp" id="sk-ug" inputmode="decimal" placeholder="مثال: ١" style="width:90px"><button type="button" class="btn sm" id="sk-ugo">تطبيق</button></div></div></div>' +
        '<div class="ie-acts"><button type="button" class="btn sm" data-sact="up">' + I('up', 16) + ' لأعلى</button><button type="button" class="btn sm" data-sact="down">' + I('down', 16) + ' لأسفل</button>' +
        '<button type="button" class="btn sm" data-sact="addpart">+ جزء (' + M.partLabel(e, g.secs.length) + ')</button><button type="button" class="btn sm" data-sact="type">تغيير النوع</button><button type="button" class="btn sm danger" data-sact="del">' + I('trash', 16) + ' حذف</button></div>' +
        '<button type="button" class="btn pri" data-additem="' + sel.s + '">+ فرع جديد</button></div>';
    }

    function crumb(main, chip) {
      var all = flat(), idx = sel && sel.i >= 0 ? all.findIndex(function (x) { return x.s === sel.s && x.i === sel.i; }) : -1;
      return '<div class="ie-h"><button type="button" class="btn icon ghost" data-back aria-label="رجوع إلى هيكل الورقة">' + I('back', 18) + '</button><div class="cr"><span>' + main + '</span>' + (chip ? '<span class="chip">' + chip + '</span>' : '') + '</div>' +
        (idx >= 0 ? '<button type="button" class="btn icon sm ghost" data-nav="-1" aria-label="الفرع السابق"' + (idx <= 0 ? ' disabled' : '') + '>' + I('back', 16) + '</button><button type="button" class="btn icon sm ghost flip" data-nav="1" aria-label="الفرع التالي"' + (idx >= all.length - 1 ? ' disabled' : '') + '>' + I('back', 16) + '</button>' : '') + '</div>';
    }
    function flat() { var a = []; e.sections.forEach(function (s, i) { s.items.forEach(function (_, j) { a.push({ s: i, i: j }); }); }); return a; }
    function field(label, inner, cls) { return '<div class="field' + (cls ? ' ' + cls : '') + '"><span class="lbl">' + label + '</span>' + inner + '</div>'; }
    function segHTML(id, list, val, inheritLabel) {
      return '<div class="seg wrap" id="' + id + '">' + (inheritLabel ? '<button type="button" data-v="" class="' + (!val ? 'on' : '') + '">' + inheritLabel + '</button>' : '') + list.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (String(val) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
    }
    function stepper(id, val, label) { return '<div class="field"><span class="lbl">' + label + '</span><div class="stp" id="' + id + '"><button type="button" data-d="1" aria-label="زيادة">+</button><input class="inp" inputmode="decimal" value="' + n(val) + '" aria-label="' + label + '"><button type="button" data-d="-1" aria-label="نقص">−</button></div></div>'; }

    /* --- محرر الفرع --- */
    function itemHTML() {
      var it = itemAt(sel.s, sel.i), q = qOf(it), s = sec(sel.s), t = q.type, si = M.secInfo(e), inf = si.info[sel.s];
      var lbl = 'السؤال ' + M.ordinal(inf.main) + (inf.hasParts ? ' (' + M.partLabel(e, inf.part) + ')' : '') + ' › فرع ' + n(sel.i + 1);
      var h = '<div class="ie">' + crumb(lbl, M.TYPE[t].label);
      var txtLabel = { mcq: 'نص السؤال', tf: 'العبارة', complete: 'العبارة — الإجابة بين [[ و ]]', match: 'تعليمة إضافية (اختياري)', term: 'العبارة / التعريف', reason: 'المطلوب تعليله', essay: 'نص السؤال', draw: 'نص السؤال', image: 'نص السؤال', problem: 'نص المسألة' }[t];
      h += '<div class="field"><span class="lbl">' + txtLabel + '</span><textarea class="inp paper-font ie-text" data-qk="text" rows="2">' + esc(q.text) + '</textarea>' +
        '<div class="ie-tools"><button type="button" class="btn sm" data-math>∑ معادلة</button>' + (t === 'complete' ? '<button type="button" class="btn sm" data-blank>[[ ]] فراغ للمحدد</button>' : '') +
        '<button type="button" class="btn sm" data-syms aria-expanded="false">Ω رموز</button><button type="button" class="btn sm" data-fig>' + I('t_image', 15) + ' ' + (q.figure ? 'الصورة' : 'إضافة صورة / رسم') + '</button></div>' +
        '<div class="symgrid" hidden>' + SYMS.map(function (x) { return '<button type="button" data-sym="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>';
      if (t === 'mcq') {
        h += '<div class="field"><span class="lbl">الاختيارات — اضغط الحرف لتحديد الإجابة الصحيحة</span><div class="opts">' +
          q.options.map(function (o, i) { return '<div class="opt' + (Number(q.correct) === i ? ' ok' : '') + '"><button type="button" class="mk" data-correct="' + i + '" aria-label="الإجابة الصحيحة ' + M.AR_LETTERS[i] + '">' + M.AR_LETTERS[i] + (Number(q.correct) === i ? ' ✓' : '') + '</button><input class="inp paper-font" data-opt="' + i + '" value="' + esc(o) + '" aria-label="الاختيار ' + M.AR_LETTERS[i] + '">' + (q.options.length > 2 ? '<button type="button" class="btn icon ghost sm" data-delopt="' + i + '" aria-label="حذف الاختيار">' + I('x', 15) + '</button>' : '') + '</div>'; }).join('') +
          '</div>' + (q.options.length < 6 ? '<button type="button" class="btn sm ghost" data-addopt style="align-self:flex-start">+ اختيار</button>' : '') + '</div>' +
          field('الاختيارات في السطر (لكل فروع السؤال)', segHTML('sk-cols', [['auto', 'تلقائي'], ['1', '١'], ['2', '٢'], ['4', '٤']], String(s.optCols || 'auto')));
      }
      if (t === 'tf') h += field('الإجابة', '<div class="seg" id="ie-tf"><button type="button" data-v="1" class="' + (q.answer ? 'on' : '') + '">صح ✓</button><button type="button" data-v="0" class="' + (!q.answer ? 'on' : '') + '">خطأ ✗</button></div>') +
        (!q.answer ? field('تصويب العبارة', '<input class="inp paper-font" data-qk="correction" value="' + esc(q.correction || '') + '">') : '');
      if (t === 'match') {
        h += '<div class="field"><span class="lbl">الأزواج: العمود (أ) ← العمود (ب)</span><div class="opts">' + q.pairs.map(function (p, i) { return '<div class="opt"><span class="mk">' + n(i + 1) + '</span><input class="inp paper-font" data-pa="' + i + '" value="' + esc(p.a) + '" aria-label="عنصر أ"><input class="inp paper-font" data-pb="' + i + '" value="' + esc(p.b) + '" aria-label="عنصر ب">' + (q.pairs.length > 2 ? '<button type="button" class="btn icon ghost sm" data-delpair="' + i + '" aria-label="حذف">' + I('x', 15) + '</button>' : '') + '</div>'; }).join('') + '</div><button type="button" class="btn sm ghost" data-addpair style="align-self:flex-start">+ زوج</button></div>';
      }
      if (t === 'match' || t === 'complete') h += field(t === 'match' ? 'بدائل زائدة في العمود (ب) — افصل بـ «؛»' : 'كلمات زائدة في بنك الكلمات — افصل بـ «؛»', '<input class="inp paper-font" data-extras value="' + esc((q.extras || []).join(' ؛ ')) + '">');
      if (t === 'term') h += field('المصطلح الصحيح (للمفتاح)', '<input class="inp paper-font" data-qk="term" value="' + esc(q.term || '') + '">');
      if (t === 'image') {
        h += field('الصورة', '<div class="row">' + (q.image ? '<img src="' + q.image + '" alt="" style="max-height:110px;border:1px solid var(--line);border-radius:8px">' : '') + '<button type="button" class="btn sm" data-img>' + (q.image ? 'تغيير' : 'رفع صورة') + '</button><button type="button" class="btn sm" data-drawimg>رسمها</button>' + (q.image ? '<button type="button" class="btn sm" data-imgtools>أدوات</button>' : '') + '</div>') +
          '<div class="field"><span class="lbl">الأجزاء المرقّمة وأسماؤها (للمفتاح)</span><div class="opts">' + q.labels.map(function (l, i) { return '<div class="opt"><input class="inp" style="max-width:64px" data-ln="' + i + '" value="' + esc(l.n) + '" aria-label="الرقم"><input class="inp paper-font" data-lname="' + i + '" value="' + esc(l.name) + '" aria-label="الاسم"><button type="button" class="btn icon ghost sm" data-dellab="' + i + '" aria-label="حذف">' + I('x', 15) + '</button></div>'; }).join('') + '</div><button type="button" class="btn sm ghost" data-addlab style="align-self:flex-start">+ جزء</button></div>';
      }
      /* الدرجة والمساحات */
      h += '<div class="ie-row">' + stepper('st-grade', Number(q.grade) || 0, 'الدرجة');
      if (LINE_TYPES.indexOf(t) >= 0) h += stepper('st-lines', Number(q.lines) || 0, 'سطور الإجابة');
      else if (t === 'draw') h += stepper('st-dh', Number(q.drawHeight) || 140, 'ارتفاع مساحة الرسم');
      else if (SOL_TYPES.indexOf(t) >= 0) h += stepper('st-sol', Number(q.solLines) || 0, 'سطور للحل');
      h += '</div>';
      if (t === 'draw') h += '<label class="check"><input type="checkbox" data-qb="drawGrid"' + (q.drawGrid !== false ? ' checked' : '') + '> شبكة مربعات في مساحة الرسم</label>';
      /* الصورة المرفقة */
      if (q.figure) {
        h += '<div class="figbox"><img src="' + q.figure + '" alt="صورة السؤال"><div class="fb-b">' +
          '<div class="pos-grid" id="ie-pos">' + POS.map(function (p) { return '<button type="button" data-pos="' + p[0] + '" class="pt pt-' + p[0] + ((q.figurePos || 'below') === p[0] ? ' on' : '') + '"><span class="pg" aria-hidden="true"><i></i><i></i><i></i><b></b></span>' + p[1] + '</button>'; }).join('') + '</div>' +
          '<label class="lbl" for="ie-fw">الحجم: <b id="ie-fwv">' + n(Number(q.figureWidth) || 60) + '٪</b></label><input id="ie-fw" type="range" min="15" max="' + (/side/.test(q.figurePos || '') ? 55 : 100) + '" step="5" value="' + (Number(q.figureWidth) || 60) + '">' +
          '<div class="row" style="gap:6px">' + segHTML('ie-fa', [['start', 'يمين'], ['center', 'وسط'], ['end', 'يسار']], q.figureAlign || 'center') + '</div>' +
          '<input class="inp paper-font" data-qk="figureCaption" value="' + esc(q.figureCaption || '') + '" placeholder="تعليق تحت الصورة — مثال: شكل (١)">' +
          '<div class="row" style="gap:6px"><button type="button" class="btn sm" data-figtools>' + I('fit', 15) + ' قص وتبييض</button>' + (q.figureShapes ? '<button type="button" class="btn sm" data-figdraw>تعديل الرسم</button>' : '') + '<button type="button" class="btn sm" data-fig>تغيير</button><button type="button" class="btn sm danger" data-figrm>إزالة</button></div>' +
          '<span class="small muted">أو اسحب الصورة على الورقة لتغيير مكانها، واسحب ركنها للتكبير.</span></div></div>';
      }
      if (['reason', 'essay', 'draw', 'problem', 'term', 'image'].indexOf(t) >= 0) h += field('نموذج الإجابة وتوزيع الدرجات (للمفتاح)', '<textarea class="inp paper-font" data-qk="modelAnswer" rows="2" placeholder="مثال: ١) … (درجة) ٢) … (درجة)">' + esc(q.modelAnswer || '') + '</textarea>');
      if (t === 'mcq') h += field('خطوات الحل في المفتاح (اختياري)', '<textarea class="inp paper-font" data-qk="modelAnswer" rows="2">' + esc(q.modelAnswer || '') + '</textarea>');
      h += '<div class="ie-acts"><button type="button" class="btn sm" data-iact="up">' + I('up', 16) + '</button><button type="button" class="btn sm" data-iact="down">' + I('down', 16) + '</button><button type="button" class="btn sm" data-iact="dup">' + I('copy', 16) + ' تكرار</button><button type="button" class="btn sm danger" data-iact="del">' + I('trash', 16) + ' حذف</button></div>' +
        '<button type="button" class="btn pri" data-additem="' + sel.s + '" data-after="' + sel.i + '">+ فرع جديد بعده</button></div>';
      return h;
    }

    /* --- القالب والتنسيق --- */
    function tplHTML() {
      var tg = function (k, label, def) { var on = def ? e[k] !== false : !!e[k]; return '<label class="sw"><input type="checkbox" data-eb="' + k + '" data-def="' + (def ? 1 : 0) + '"' + (on ? ' checked' : '') + '><span></span>' + label + '</label>'; };
      return '<div class="ie">' +
        '<div class="field"><span class="lbl">القالب</span><div class="tpl-grid">' + M.TEMPLATES.map(function (t) { return '<button type="button" class="tpl' + ((e.theme || 'classic') === t.id ? ' on' : '') + '" data-tpl="' + t.id + '"><span class="th" data-th="' + t.id + '"></span><b>' + t.name + '</b></button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">اللون</span><div class="sw-row">' + M.ACCENTS.map(function (c) { return '<button type="button" class="swc' + ((e.color || '#1F2A44').toLowerCase() === c[0].toLowerCase() ? ' on' : '') + '" data-col="' + c[0] + '" style="background:' + c[0] + '" aria-label="' + c[1] + '"></button>'; }).join('') + '<label class="swc custom" aria-label="لون آخر"><input type="color" id="tp-col" value="' + esc(e.color || '#1F2A44') + '"></label></div></div>' +
        field('الفاصل بين الفروع', segHTML('tp-sep', SEPS, e.itemSep || 'space')) +
        '<div class="ie-row">' + stepper('st-fs', Number(e.fontSize) || 14, 'حجم الخط') + field('الأرقام', segHTML('tp-dg', [['arabic', '١٢٣'], ['english', '123']], e.digits || 'arabic')) + '</div>' +
        field('مقاس الورق', segHTML('tp-paper', [['a4', 'A4'], ['a3-booklet', 'A3 كتيّب'], ['a3-spread', 'A3 صفحتان']], e.paper || 'a4')) +
        field('لغة الورقة', segHTML('tp-lang', [['ar', 'عربي'], ['en', 'English']], e.lang || 'ar')) +
        '<div class="sw-list">' + tg('showStudent', 'سطر اسم الطالب', true) + tg('showGradeTable', 'جدول الدرجات', true) + tg('showDoc', 'مربع وثيقة الجودة في الترويسة', true) + tg('showInstructions', 'سطر التعليمات', true) + tg('showSign', 'توقيعات المصحح والمراجع', true) + tg('compact', 'مسافات مضغوطة (صفحات أقل)', false) + tg('largePrint', 'طباعة مكبّرة (لضعاف البصر)', false) + tg('shuffleOptions', 'خلط ترتيب الاختيارات', false) + '</div>' +
        '<button type="button" class="btn" id="tp-def">' + I('check', 16) + ' اجعل هذا التنسيق افتراضياً للامتحانات الجديدة</button></div>';
    }
    var thumbCache = {};
    function drawThumbs() {
      var key = JSON.stringify([e.sections.length, e.color, e.title, e.fontSize, e.itemSep, Object.keys(e.local).length]);
      M.TEMPLATES.forEach(function (t, k) {
        setTimeout(function () {
          var el = M.qs('[data-th="' + t.id + '"]', app); if (!el || tab !== 'tpl') return;
          var ck = key + t.id;
          if (!thumbCache[ck]) { try { thumbCache[ck] = M.renderExamPages(Object.assign({}, e, { theme: t.id, paper: 'a4' }))[0]; } catch (x) { thumbCache[ck] = ''; } }
          el.innerHTML = '<span class="thz">' + thumbCache[ck] + '</span>';
        }, 40 * k);
      });
    }

    /* --- بيانات الورقة --- */
    function infoHTML() {
      var docs = S.docs.filter(function (d) { return d.type === 'exam'; });
      var inp = function (k, label, ph, type) { return field(label, '<input class="inp" data-ek="' + k + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + esc(e[k] || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'); };
      return '<div class="ie"><div class="grid2">' +
        field('اسم الامتحان', '<input class="inp" data-ek="title" list="sd-tl" value="' + esc(e.title || '') + '"><datalist id="sd-tl">' + (M.EXAM_TITLES || []).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>') +
        inp('subjectName', 'المادة', 'الكهرباء العامة') + inp('className', 'الصف الدراسي', 'الصف الأول') + inp('specialization', 'التخصص', 'كهرباء') +
        inp('duration', 'الزمن', 'ساعتان') + inp('examDate', 'التاريخ (فارغ = يُكتب باليد)', '', 'date') + inp('year', 'العام الدراسي', '') + inp('model', 'رمز النموذج', 'أ / ب') +
        field('الدرجة الكلية المطلوبة', '<input class="inp" data-en="totalGrade" inputmode="numeric" value="' + n(e.totalGrade || '') + '" placeholder="' + n(M.examTotal(e)) + '">') +
        (e.showSeat !== false ? field('خانات رقم الجلوس', '<input class="inp" data-en="seatDigits" inputmode="numeric" value="' + n(e.seatDigits || 5) + '">') : '') + '</div>' +
        '<label class="sw"><input type="checkbox" data-eb="showSeat" data-def="1"' + (e.showSeat !== false ? ' checked' : '') + '><span></span>رقم الجلوس <span class="small muted">— اقفله لاختبار الميدترم</span></label>' +
        field('سطر التعليمات', '<input class="inp" data-ek="instructions" value="' + esc(e.instructions || '') + '">') +
        field('جملة أسفل كل صفحة', '<input class="inp" data-ek="footerNote" value="' + esc(e.footerNote != null ? e.footerNote : 'مع أطيب التمنيات بالنجاح والتوفيق') + '">') +
        field('وثيقة الجودة في الترويسة', '<select class="inp" data-ek="docId"><option value="">— الافتراضية —</option>' + docs.map(function (d) { return '<option value="' + d.id + '"' + (d.id === e.docId ? ' selected' : '') + '>' + esc(d.name + ' (' + d.code + ' — إصدار ' + d.version + ')') + '</option>'; }).join('') + '</select>') +
        '<a class="btn sm ghost" href="#/identity" style="align-self:flex-start">' + I('grid', 16) + ' تعديل الشعار وبيانات المؤسسة</a></div>';
    }

    /* --- المراجعة والإخراج --- */
    function issues() {
      var out = [], total = M.examTotal(e);
      if (!e.sections.length) out.push({ k: 'bad', t: 'الورقة بلا أسئلة' });
      if (e.totalGrade && Number(e.totalGrade) !== total) out.push({ k: 'bad', t: 'مجموع الدرجات ' + n(total) + ' لا يساوي الدرجة الكلية ' + n(e.totalGrade) });
      e.sections.forEach(function (s, i) {
        if (!s.items.length) out.push({ k: 'warn', t: 'السؤال ' + M.ordinal(M.secInfo(e).info[i].main) + ' بلا فروع', s: i, i: -1 });
        s.items.forEach(function (it, j) {
          var q = M.examQ(e, it.qid); if (!q) return;
          var errs = M.validateQuestion(q).filter(function (x) { return !/الدرس/.test(x); });
          if (!Number(M.itemGrade(e, it))) errs.push('بدون درجة');
          if (errs.length) out.push({ k: 'warn', t: 'السؤال ' + M.ordinal(M.secInfo(e).info[i].main) + ' فرع ' + n(j + 1) + ': ' + errs.join('، '), s: i, i: j });
        });
      });
      return out;
    }
    function checkHTML() {
      var iss = issues();
      return '<div class="ie"><div class="chk-sum ' + (iss.some(function (x) { return x.k === 'bad'; }) ? 'bad' : iss.length ? 'warn' : 'ok') + '">' + I(iss.length ? 'warn' : 'check', 22) + '<div><b>' + (iss.length ? n(iss.length) + ' ملاحظة قبل الطباعة' : 'الورقة جاهزة للطباعة') + '</b><span>' + n(M.secInfo(e).groups.length) + ' أسئلة · ' + n(flat().length) + ' فرع · ' + n(M.examTotal(e)) + ' درجة · ' + n(e._pageCount || 1) + ' صفحة</span></div></div>' +
        (iss.length ? '<div class="chk-list">' + iss.map(function (x) { return '<button type="button" class="chk ' + x.k + '"' + (x.s != null ? ' data-go="' + x.s + ':' + x.i + '"' : '') + '>' + esc(x.t) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="out-grid">' + OUT.map(function (o) { return '<button type="button" class="out" data-out="' + o[0] + '">' + I(o[1], 22) + '<b>' + o[2] + '</b><span>' + o[3] + '</span></button>'; }).join('') + '</div></div>';
    }
    var OUT = [['pdf', 'download', 'ملف PDF جاهز', 'الامتحان فقط بالقالب والمقاس — جاهز للطباعة والإرسال'], ['word', 'download', 'ملف Word', 'للتعديل أو الإرسال'], ['print', 'print', 'طباعة مباشرة', 'يفتح نافذة الطباعة'],
      ['keypdf', 'download', 'مفتاح الإجابة PDF', 'نموذج الإجابة جاهز'], ['keyw', 'download', 'المفتاح Word', 'نموذج الإجابة'], ['keyp', 'print', 'طباعة المفتاح', 'يفتح نافذة الطباعة'],
      ['models', 'copy', 'نموذجان (أ) و(ب)', 'نفس الأسئلة بترتيب مختلف'], ['tpl', 'layers', 'احفظ الهيكل كقالب', 'امتحان جديد بنفس التقسيم والدرجات'], ['file', 'download', 'ملف للمشاركة', 'يفتحه زميلك في التطبيق']];

    function doOut(a) {
      var title = (e.title || 'امتحان') + (e.model ? ' - نموذج ' + e.model : '');
      persist.flush ? persist.flush() : null;
      if (a === 'print') { var sh = M.examSheets(e); M.printPages(sh.items, title, sh.size); M.sound && M.sound('done'); if (sh.size === 'a3') M.toast('اطبع على A3 أفقي — للكتيّب: على الوجهين مع القلب من الحافة القصيرة'); }
      if (a === 'pdf') { var sp = M.examSheets(e); M.exportPDF(sp.items, title, sp.size); }
      if (a === 'keypdf') M.exportPDF(M.renderKeyPages(e), 'مفتاح الإجابة - ' + title);
      if (a === 'word') { M.renderExamPages(e); M.exportExamWord(e).catch(function (er) { M.toast('تعذّر التصدير: ' + er.message, 'bad'); }); }
      if (a === 'keyp') M.printPages(M.renderKeyPages(e), 'مفتاح الإجابة - ' + title);
      if (a === 'keyw') M.exportKeyWord(e);
      if (a === 'file') M.exportExamFile(e);
      if (a === 'tpl') { var t = M.cloneExam(e, true); t.title = e.title; M.save('exams', t).then(function () { M.toast('أُنشئ امتحان جديد بنفس الهيكل — فروعه فارغة', 'ok'); M.go('#/studio/' + t.id); }); }
      if (a === 'models') {
        e.model = e.model || 'أ'; e.groupId = e.groupId || M.uid(); touch();
        var b = M.cloneExam(e, false); b.title = e.title; b.model = 'ب'; b.groupId = e.groupId; b.shuffleOptions = true; b.shuffleSeed = M.uid();
        var rng = M.rng(b.shuffleSeed);
        b.sections.forEach(function (s) { if (s.type !== 'match' && s.type !== 'complete') s.items = M.shuffle(s.items, rng); });
        M.save('exams', b).then(function () { M.toast('أُنشئ النموذج (ب) — نفس الأسئلة بترتيب مختلف', 'ok'); M.go('#/studio/' + b.id); });
      }
    }

    /* ===== ربط عناصر اللوحة ===== */
    function bindPane(p) {
      var on = function (sel2, ev, fn) { M.qsa(sel2, p).forEach(function (el) { el[ev] = function (x) { fn(el, x); }; }); };
      p.onfocusin = function (ev) { if (ev.target.matches('input.inp,textarea.inp')) lastField = ev.target; };
      on('[data-back]', 'onclick', function () { sel = null; drawPane(); });
      on('[data-nav]', 'onclick', function (b) { var all = flat(), k = all.findIndex(function (x) { return x.s === sel.s && x.i === sel.i; }) + Number(b.dataset.nav); if (all[k]) select(all[k].s, all[k].i); });
      on('[data-sec]', 'onclick', function (b) { sel = { s: +b.dataset.sec, i: -1 }; drawPane(); });
      on('[data-it]', 'onclick', function (b) { var a = b.dataset.it.split(':'); select(+a[0], +a[1]); });
      on('[data-additem]', 'onclick', function (b) {
        var s = +b.dataset.additem, at = b.dataset.after != null ? +b.dataset.after + 1 : sec(s).items.length;
        sec(s).items.splice(at, 0, newItem(sec(s).type)); touch(); select(s, at, true);
      });
      on('[data-addpart]', 'onclick', function (b) { addPart(+b.dataset.addpart); });
      var nb = M.qs('#ol-new', p); if (nb) nb.onclick = function () { M.typeSheet('نوع السؤال الرئيسي', function (t) { e.sections.push({ id: M.uid(), type: t, title: '', items: [newItem(t)], wordBank: true, layout: 'auto' }); touch(); select(e.sections.length - 1, 0, true); }); };
      var ai = M.qs('#ol-ai', p); if (ai) ai.onclick = openImport;
      /* نصوص السؤال والقسم والورقة */
      on('[data-qk]', 'oninput', function (el) { var q = curQ(); if (!q) return; q[el.dataset.qk] = el.value; touch(); });
      on('[data-sk]', 'oninput', function (el) { sec(sel.s)[el.dataset.sk] = el.value; touch(); });
      on('[data-ek]', 'oninput', function (el) { e[el.dataset.ek] = el.value; if (el.dataset.ek === 'footerNote') M.setSetting('footerNote', el.value); touch(); });
      on('[data-en]', 'oninput', function (el) { var v = Number(M.toWestern(el.value)); e[el.dataset.en] = el.value.trim() === '' ? '' : (isFinite(v) ? v : ''); touch(); });
      on('[data-opt]', 'oninput', function (el) { curQ().options[+el.dataset.opt] = el.value; touch(); });
      on('[data-pa]', 'oninput', function (el) { curQ().pairs[+el.dataset.pa].a = el.value; touch(); });
      on('[data-pb]', 'oninput', function (el) { curQ().pairs[+el.dataset.pb].b = el.value; touch(); });
      on('[data-ln]', 'oninput', function (el) { curQ().labels[+el.dataset.ln].n = el.value; touch(); });
      on('[data-lname]', 'oninput', function (el) { curQ().labels[+el.dataset.lname].name = el.value; touch(); });
      on('[data-extras]', 'oninput', function (el) { curQ().extras = el.value.split(/[؛;]/).map(function (x) { return x.trim(); }).filter(Boolean); touch(); });
      on('[data-qb]', 'onchange', function (el) { curQ()[el.dataset.qb] = el.checked; touch(); });
      on('[data-sb]', 'onchange', function (el) { var s = sec(sel.s), k = el.dataset.sb; if (k === 'layout2') s.layout = el.checked ? 'two' : 'auto'; else s[k] = el.checked; touch(k === 'part'); });
      on('[data-eb]', 'onchange', function (el) { e[el.dataset.eb] = el.checked; touch(el.dataset.eb === 'showSeat'); });
      on('[data-correct]', 'onclick', function (b) { curQ().correct = +b.dataset.correct; touch(true); });
      on('[data-delopt]', 'onclick', function (b) { var q = curQ(), i = +b.dataset.delopt; q.options.splice(i, 1); if (q.correct >= q.options.length || q.correct === i) q.correct = 0; else if (q.correct > i) q.correct--; touch(true); });
      on('[data-addopt]', 'onclick', function () { curQ().options.push(''); touch(true); var ins = M.qsa('[data-opt]', p); if (ins.length) ins[ins.length - 1].focus(); });
      on('[data-addpair]', 'onclick', function () { curQ().pairs.push({ a: '', b: '' }); touch(true); });
      on('[data-delpair]', 'onclick', function (b) { curQ().pairs.splice(+b.dataset.delpair, 1); touch(true); });
      on('[data-addlab]', 'onclick', function () { var q = curQ(); q.labels.push({ n: String(q.labels.length + 1), name: '' }); touch(true); });
      on('[data-dellab]', 'onclick', function (b) { curQ().labels.splice(+b.dataset.dellab, 1); touch(true); });
      on('#ie-tf button', 'onclick', function (b) { curQ().answer = b.dataset.v === '1'; touch(true); });
      /* مقاطع الاختيار */
      on('#sk-sep button', 'onclick', function (b) { sec(sel.s).sep = b.dataset.v; touch(true); });
      on('#sk-cols button', 'onclick', function (b) { sec(sel.s).optCols = b.dataset.v; touch(true); });
      on('#tp-sep button', 'onclick', function (b) { e.itemSep = b.dataset.v; touch(true); });
      on('#tp-dg button', 'onclick', function (b) { e.digits = b.dataset.v; touch(true); });
      on('#tp-paper button', 'onclick', function (b) { e.paper = b.dataset.v; touch(true); });
      on('#tp-lang button', 'onclick', function (b) { e.lang = b.dataset.v; touch(true); });
      on('[data-tpl]', 'onclick', function (b) { e.theme = b.dataset.tpl; M.qsa('[data-tpl]', p).forEach(function (x) { x.classList.toggle('on', x === b); }); touch(); });
      on('[data-col]', 'onclick', function (b) { e.color = b.dataset.col; thumbCache = {}; touch(true); });
      var cc = M.qs('#tp-col', p); if (cc) cc.onchange = function () { e.color = cc.value; thumbCache = {}; touch(true); };
      var td = M.qs('#tp-def', p); if (td) td.onclick = function () { M.setSetting('examDefaults', Object.assign({}, S.settings.examDefaults || {}, { theme: e.theme || 'classic', color: e.color, fontSize: e.fontSize, itemSep: e.itemSep || 'space' })).then(function () { M.toast('حُفظ كتنسيق افتراضي', 'ok'); }); };
      if (tab === 'tpl') drawThumbs();
      /* المتدرجات */
      stp(p, '#st-grade', function (v) { var q = curQ(); q.grade = Math.max(0, v); touch(); }, 0.5);
      stp(p, '#st-lines', function (v) { curQ().lines = Math.max(0, Math.min(30, Math.round(v))); touch(); }, 1);
      stp(p, '#st-sol', function (v) { curQ().solLines = Math.max(0, Math.min(30, Math.round(v))); touch(); }, 1);
      stp(p, '#st-dh', function (v) { curQ().drawHeight = Math.max(40, Math.min(900, Math.round(v))); touch(); }, 20);
      stp(p, '#st-fs', function (v) { e.fontSize = Math.max(11, Math.min(20, v)); touch(); }, 0.5);
      var ug = M.qs('#sk-ugo', p); if (ug) ug.onclick = function () { var v = Number(M.toWestern(M.qs('#sk-ug', p).value)); if (!(v >= 0)) return M.toast('اكتب الدرجة', 'bad'); sec(sel.s).items.forEach(function (it) { var q = qOf(it); if (q) q.grade = v; }); touch(true); M.toast('طُبّقت الدرجة على كل الفروع', 'ok'); };
      /* أفعال القسم والفرع */
      on('[data-sact]', 'onclick', function (b) { secAct(b.dataset.sact); });
      on('[data-iact]', 'onclick', function (b) { itemAct(b.dataset.iact); });
      /* أدوات الكتابة */
      on('[data-math]', 'onclick', function () { M.mathEditor('', function (src) { insertText(src); }); });
      on('[data-blank]', 'onclick', function () { var ta = M.qs('.ie-text', p), s0 = ta.selectionStart, s1 = ta.selectionEnd; if (s1 <= s0) return M.toast('حدد الكلمات المطلوب جعلها فراغاً أولاً'); ta.value = ta.value.slice(0, s0) + '[[' + ta.value.slice(s0, s1) + ']]' + ta.value.slice(s1); curQ().text = ta.value; touch(); });
      on('[data-syms]', 'onclick', function (b) { var g = M.qs('.symgrid', p); g.hidden = !g.hidden; b.setAttribute('aria-expanded', !g.hidden); });
      on('[data-sym]', 'onmousedown', function (b, ev) { ev.preventDefault(); });
      on('[data-sym]', 'onclick', function (b) { insertText(b.dataset.sym); });
      on('[data-fig]', 'onclick', function () { figSource(); });
      on('[data-figrm]', 'onclick', function () { var q = curQ(); q.figure = ''; q.figureShapes = null; touch(true); });
      on('[data-figtools]', 'onclick', function () { var q = curQ(); M.imageTools(q.figure, function (d) { q.figure = d; q.figureShapes = null; touch(true); }); });
      on('[data-figdraw]', 'onclick', function () { var q = curQ(); M.drawEditor({ shapes: q.figureShapes, grid: q.figureGrid }, function (rr) { q.figure = rr.image; q.figureShapes = rr.shapes; q.figureGrid = rr.grid; touch(true); }); });
      on('[data-pos]', 'onclick', function (b) { setPos(b.dataset.pos); });
      on('#ie-fa button', 'onclick', function (b) { curQ().figureAlign = b.dataset.v; touch(true); });
      var fw = M.qs('#ie-fw', p); if (fw) fw.oninput = function () { curQ().figureWidth = Number(fw.value); M.qs('#ie-fwv', p).textContent = n(fw.value) + '٪'; touch(); };
      on('[data-img]', 'onclick', function () { pickImage(function (d) { curQ().image = d; curQ().imageShapes = null; touch(true); }); });
      on('[data-drawimg]', 'onclick', function () { var q = curQ(); M.drawEditor({ shapes: q.imageShapes }, function (rr) { q.image = rr.image; q.imageShapes = rr.shapes; touch(true); }); });
      on('[data-imgtools]', 'onclick', function () { var q = curQ(); M.imageTools(q.image, function (d) { q.image = d; q.imageShapes = null; touch(true); }); });
      on('[data-go]', 'onclick', function (b) { var a = b.dataset.go.split(':'); setTabSilent('q'); if (+a[1] >= 0) select(+a[0], +a[1]); else { sel = { s: +a[0], i: -1 }; drawPane(); } });
      on('[data-out]', 'onclick', function (b) { doOut(b.dataset.out); });
      /* تكبير مربع النص مع الكتابة */
      M.qsa('textarea.inp', p).forEach(autoGrow);
      if (sel && sel.focus) { sel.focus = false; var ta = M.qs('.ie-text', p); if (ta && mq.matches) setTimeout(function () { ta.focus(); }, 30); }
    }
    function setTabSilent(t) { tab = t; M.qsa('[data-tab]', app).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); }
    function autoGrow(ta) { var f = function () { ta.style.height = 'auto'; ta.style.height = Math.min(260, ta.scrollHeight + 2) + 'px'; }; ta.addEventListener('input', f); setTimeout(f, 0); }
    function stp(p, id, cb, step) {
      var box = M.qs(id, p); if (!box) return;
      var inp = M.qs('input', box);
      var val = function () { return Number(M.toWestern(inp.value)) || 0; };
      M.qsa('button', box).forEach(function (b) { b.onclick = function () { var v = Math.round((val() + step * Number(b.dataset.d)) * 100) / 100; if (v < 0) v = 0; inp.value = n(v); cb(v); }; });
      inp.oninput = function () { if (inp.value.trim() === '') return; cb(val()); };
    }
    function curQ() { return sel && sel.i >= 0 ? qOf(itemAt(sel.s, sel.i)) : null; }
    function insertText(t) {
      var el = lastField && document.body.contains(lastField) ? lastField : M.qs('.ie-text', app); if (!el) return;
      var s0 = el.selectionStart != null ? el.selectionStart : el.value.length, s1 = el.selectionEnd != null ? el.selectionEnd : s0;
      el.value = el.value.slice(0, s0) + t + el.value.slice(s1); el.focus(); el.selectionStart = el.selectionEnd = s0 + t.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function select(s, i, focus) {
      setTabSilent('q');
      sel = { s: s, i: i, focus: !!focus };
      var q = qOf(itemAt(s, i)); if (q && !q.solLines) q.solLines = q.solLines || 0;
      drawPane(); var pane = M.qs('#sd-pane', app); if (pane) pane.scrollTop = 0;
      highlight(true);
    }
    function addPart(s) {
      var si = M.secInfo(e), g = si.groups[si.info[s].main], at = g.secs[g.secs.length - 1] + 1;
      M.typeSheet('نوع الجزء (' + M.partLabel(e, g.secs.length) + ')', function (t) {
        e.sections.splice(at, 0, { id: M.uid(), type: t, title: '', items: [newItem(t)], part: true, wordBank: true, layout: 'auto' });
        touch(); select(at, 0, true);
      });
    }
    function secAct(a) {
      var i = sel.s, S2 = e.sections, si = M.secInfo(e);
      if (a === 'addpart') return addPart(i);
      if (a === 'type') return M.typeSheet('تغيير نوع السؤال', function (t) {
        S2[i].type = t; S2[i].items.forEach(function (it) { var q = qOf(it); if (!q) return; var nq = M.newQuestion(t, ''); nq.id = q.id; nq.text = q.text; nq.grade = q.grade; nq.figure = q.figure; nq.figureWidth = q.figureWidth; nq.figurePos = q.figurePos; nq.figureAlign = q.figureAlign; nq.figureCaption = q.figureCaption; nq.solLines = q.solLines || 0; if (t === 'mcq' && q.options && q.options.length) nq.options = q.options; e.local[q.id] = nq; });
        touch(true);
      });
      if (a === 'del') return M.confirm('حذف', 'حذف «' + (S2[i].title || M.TYPE[S2[i].type].title) + '» بكل فروعه؟', 'حذف', true).then(function (ok) {
        if (!ok) return; S2[i].items.forEach(function (it) { delete e.local[it.qid]; }); S2.splice(i, 1); if (S2[i] && S2[i].part && (i === 0 || !S2[i - 1])) S2[i].part = false; sel = null; touch(true);
      });
      /* تحريك السؤال الرئيسي بأجزائه */
      var g = si.groups[si.info[i].main], gi = si.info[i].main, block, to;
      if (si.info[i].hasParts && !si.info[i].first) {
        var j = a === 'up' ? i - 1 : i + 1; if (j < g.start || j > g.secs[g.secs.length - 1]) return;
        var tmp = S2[i]; S2[i] = S2[j]; S2[j] = tmp; if (S2[g.start].part) { S2[g.start].part = false; S2[j === g.start ? i : j].part = true; } sel.s = j; return touch(true);
      }
      if (a === 'up' && gi === 0 || a === 'down' && gi === si.groups.length - 1) return;
      block = S2.splice(g.start, g.secs.length);
      var other = si.groups[a === 'up' ? gi - 1 : gi + 1];
      to = a === 'up' ? other.start : other.start - g.secs.length + other.secs.length;
      Array.prototype.splice.apply(S2, [to, 0].concat(block));
      sel.s = to + (i - g.start); touch(true);
    }
    function itemAct(a) {
      var s = sec(sel.s), i = sel.i;
      if (a === 'del') { var rm = s.items.splice(i, 1)[0]; if (rm) delete e.local[rm.qid]; sel = s.items.length ? { s: sel.s, i: Math.min(i, s.items.length - 1) } : { s: sel.s, i: -1 }; touch(true); return M.toast('حُذف الفرع — يمكنك التراجع', ''); }
      if (a === 'dup') { var q = clone(qOf(s.items[i])); q.id = M.uid(); e.local[q.id] = q; s.items.splice(i + 1, 0, { qid: q.id, grade: null }); touch(); return select(sel.s, i + 1); }
      var j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= s.items.length) return;
      var t = s.items[i]; s.items[i] = s.items[j]; s.items[j] = t; sel.i = j; touch(true);
    }
    function setPos(pos) {
      var q = curQ(); if (!q) return;
      q.figurePos = pos; if (/side/.test(pos) && (Number(q.figureWidth) || 60) > 55) q.figureWidth = 40;
      touch(true);
    }
    function pickImage(cb, capture) {
      var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (capture) i.setAttribute('capture', 'environment');
      i.onchange = function () { var f = i.files && i.files[0]; if (!f) return; M.readFile(f, 'dataurl').then(function (d) { return M.shrinkImage(d, 1600); }).then(cb); };
      i.click();
    }
    function figSource() {
      var q = curQ();
      M.modal({ title: 'صورة السؤال', body: '<div class="src-grid">' +
        [['up', 't_image', 'من الجهاز'], ['cam', 'camera', 'تصوير بالكاميرا'], ['draw', 't_draw', 'رسم بأداة الرسم'], ['paste', 'paste', 'لصق صورة منسوخة']].map(function (o) { return '<button type="button" class="type-card" data-src="' + o[0] + '"><span class="ic">' + I(o[1], 24) + '</span><b>' + o[2] + '</b></button>'; }).join('') + '</div>',
        onMount: function (m, close) {
          var set = function (d) { q.figure = d; q.figureShapes = null; q.figureWidth = q.figureWidth || 50; q.figurePos = q.figurePos || 'below'; touch(true); M.toast('أُضيفت الصورة — اسحبها على الورقة لتغيير مكانها', 'ok'); };
          M.qsa('[data-src]', m).forEach(function (b) {
            b.onclick = function () {
              var k = b.dataset.src; close();
              if (k === 'up') pickImage(set);
              if (k === 'cam') pickImage(function (d) { M.imageTools(d, set); }, true);
              if (k === 'draw') M.drawEditor({ shapes: q.figureShapes, grid: q.figureGrid }, function (rr) { q.figure = rr.image; q.figureShapes = rr.shapes; q.figureGrid = rr.grid; q.figureWidth = q.figureWidth || 50; touch(true); });
              if (k === 'paste') {
                if (!navigator.clipboard || !navigator.clipboard.read) return M.toast('استخدم Ctrl+V لِلصق الصورة', 'bad');
                navigator.clipboard.read().then(function (items) {
                  var it = items.find(function (x) { return x.types.some(function (t) { return /^image\//.test(t); }); });
                  if (!it) return M.toast('لا توجد صورة منسوخة', 'bad');
                  return it.getType(it.types.find(function (t) { return /^image\//.test(t); })).then(function (bl) { return M.readFile(bl, 'dataurl'); }).then(function (d) { return M.shrinkImage(d, 1600); }).then(set);
                }).catch(function () { M.toast('لم يُسمح بقراءة الحافظة — استخدم Ctrl+V', 'bad'); });
              }
            };
          });
        } });
    }
    function openImport() {
      if (!M.importDialog) return M.toast('الاستيراد غير متاح', 'bad');
      M.importDialog(function (groups) {
        var first = e.sections.length;
        groups.forEach(function (g) {
          g.parts.forEach(function (p, k) {
            e.sections.push({ id: M.uid(), type: p.type, title: p.title || '', mainTitle: k === 0 ? (g.mainTitle || '') : '', part: k > 0, wordBank: true, layout: 'auto',
              items: p.questions.map(function (q) { q.id = M.uid(); q.source = 'ai-import'; e.local[q.id] = q; return { qid: q.id, grade: null }; }) });
          });
        });
        touch(); sel = null; setTab('q');
        setTimeout(function () { var el = M.qs('[data-sec="' + first + '"]', pagesBox); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 500);
      });
    }

    /* ===== الورقة ===== */
    var pageCount = 0;
    function renderPaper() {
      if (!alive) return;
      var pages, size = 'a4';
      try {
        if (view === 'key') pages = M.renderKeyPages(e);
        else { var sh = M.examSheets(e); pages = sh.items; size = sh.size; }
      } catch (err) { console.error(err); pagesBox.innerHTML = '<div class="alert bad" style="margin:12px">تعذّر بناء المعاينة: ' + esc(err.message) + '</div>'; return; }
      var pw = size === 'a3' ? 1588 : 794, ph = size === 'a3' ? 1153 : 1123;
      var avail = Math.max(200, pagesBox.clientWidth - 28), fit = Math.min(1.25, avail / pw), sc = zoom ? fit * zoom : fit;
      var keepTop = pagesBox.scrollTop, keepLeft = pagesBox.scrollLeft;
      pagesBox.innerHTML = pages.map(function (pg) { return '<div class="sd-pg" style="width:' + Math.round(pw * sc) + 'px;height:' + Math.round(ph * sc) + 'px"><div class="sd-pz" style="width:' + pw + 'px;transform:scale(' + sc + ')">' + pg + '</div></div>'; }).join('');
      pagesBox.scrollTop = keepTop; pagesBox.scrollLeft = keepLeft;
      pagesBox._sc = sc;
      pageCount = e._pageCount || pages.length;
      M.qs('#sd-pc', app).textContent = size === 'a3' ? n(pageCount) + ' صفحات · ' + n(pages.length) + ' وجه A3' : n(pages.length) + (pages.length === 1 ? ' صفحة' : ' صفحات');
      if (stored) stored._pageCount = e._pageCount;
      drawHead(); highlight();
      if (tab === 'q' && !sel) { var pane = M.qs('#sd-pane', app); if (pane && !pane.contains(document.activeElement)) { var k = pane.scrollTop; pane.innerHTML = outlineHTML(); bindPane(pane); pane.scrollTop = k; } }
    }
    function highlight(scroll) {
      M.qsa('.sd-hl', pagesBox).forEach(function (x) { x.classList.remove('sd-hl'); });
      removeFigOv();
      if (!sel) return;
      var target = null;
      if (sel.i >= 0) {
        var it = itemAt(sel.s, sel.i); if (!it) return;
        M.qsa('[data-q="' + it.qid + '"]', pagesBox).forEach(function (x) { x.classList.add('sd-hl'); if (!target) target = x; });
      } else {
        M.qsa('.p-sec[data-sec="' + sel.s + '"]', pagesBox).forEach(function (x) { x.classList.add('sd-hl'); if (!target) target = x; });
      }
      var key = sel.s + ':' + sel.i;
      if (target && (scroll || key !== lastSelKey)) {
        lastSelKey = key;
        var br = pagesBox.getBoundingClientRect(), tr = target.getBoundingClientRect();
        if (tr.top < br.top + 10 || tr.bottom > br.bottom - 10) pagesBox.scrollTo({ top: pagesBox.scrollTop + tr.top - br.top - Math.max(16, (br.height - tr.height) / 3), behavior: 'smooth' });
      }
      if (sel.i >= 0 && view === 'paper') setTimeout(figOverlay, scroll ? 380 : 30);
    }

    /* ===== تحريك الصورة وتكبيرها مباشرة على الورقة ===== */
    function removeFigOv() { M.qsa('.fig-ov,.fig-zones', pagesBox).forEach(function (x) { x.remove(); }); }
    function figOverlay() {
      removeFigOv();
      if (!sel || sel.i < 0) return;
      var it = itemAt(sel.s, sel.i), q = it && M.examQ(e, it.qid); if (!q || !q.figure) return;
      var host = M.qs('[data-q="' + it.qid + '"]', pagesBox); if (!host) return;
      var fig = M.qs('.fw,.fx', host) ; if (!fig) return;
      var side = !!fig.closest('.p-fside'), box = side ? fig : fig, ref = side ? fig.closest('.p-fside') : fig.closest('.p-fig');
      var br = pagesBox.getBoundingClientRect(), fr = box.getBoundingClientRect();
      var ov = document.createElement('div'); ov.className = 'fig-ov';
      var put = function (r) { ov.style.left = (r.left - br.left + pagesBox.scrollLeft) + 'px'; ov.style.top = (r.top - br.top + pagesBox.scrollTop) + 'px'; ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px'; };
      put(fr);
      ov.innerHTML = '<span class="h hl" data-h="l" aria-hidden="true"></span><span class="h hr" data-h="r" aria-hidden="true"></span><span class="h hbl" data-h="l" aria-hidden="true"></span><span class="h hbr" data-h="r" aria-hidden="true"></span>' +
        '<div class="fig-bar">' + POS.map(function (p) { return '<button type="button" data-p="' + p[0] + '" class="' + ((q.figurePos || 'below') === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '<button type="button" data-tools aria-label="قص وتبييض">' + I('fit', 14) + '</button></div>' +
        '<span class="fig-w">' + n(Number(q.figureWidth) || 60) + '٪</span>';
      pagesBox.appendChild(ov);
      M.qsa('[data-p]', ov).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); setPos(b.dataset.p); }; });
      M.qs('[data-tools]', ov).onclick = function (ev) { ev.stopPropagation(); var qq = curQ(); M.imageTools(qq.figure, function (d) { qq.figure = d; qq.figureShapes = null; touch(true); }); };
      var align = q.figureAlign || 'center', maxW = side ? 55 : 100, startW = Number(q.figureWidth) || (side ? 40 : 60);
      var drag = null;
      ov.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.fig-bar')) return;
        ev.preventDefault(); ev.stopPropagation(); ov.setPointerCapture(ev.pointerId);
        drag = { h: ev.target.dataset.h || 'move', x: ev.clientX, y: ev.clientY, px: fr.width, moved: false, w: startW };
      });
      ov.addEventListener('pointermove', function (ev) {
        if (!drag) return;
        var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (drag.h !== 'move') {
          /* المسافة من الطرف الثابت للصورة حسب موضعها ومحاذاتها */
          var px, pos = q.figurePos || 'below';
          if (pos === 'side') px = ev.clientX - fr.left;
          else if (pos === 'side-start') px = fr.right - ev.clientX;
          else if (align === 'start') px = fr.right - ev.clientX;
          else if (align === 'end') px = ev.clientX - fr.left;
          else px = Math.abs(ev.clientX - (fr.left + fr.width / 2)) * 2;
          var w = Math.max(15, Math.min(maxW, Math.round(startW * Math.max(10, px) / drag.px / 5) * 5));
          if (w !== drag.w) { drag.w = w; fig.style.width = w + '%'; put(fig.getBoundingClientRect()); M.qs('.fig-w', ov).textContent = n(w) + '٪'; }
          return;
        }
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
        if (!drag.moved) { drag.moved = true; ov.classList.add('moving'); showZones(host); }
        ov.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        drag.zone = zoneAt(host, ev.clientX, ev.clientY);
        M.qsa('.fig-zones [data-z]', pagesBox).forEach(function (z) { z.classList.toggle('on', z.dataset.z === drag.zone); });
      });
      ov.addEventListener('pointerup', function () {
        var d = drag; drag = null; if (!d) return;
        if (d.h !== 'move') { if (d.w !== startW) { curQ().figureWidth = d.w; touch(true); } return; }
        M.qsa('.fig-zones', pagesBox).forEach(function (x) { x.remove(); });
        ov.style.transform = ''; ov.classList.remove('moving');
        if (d.moved && d.zone) setPos(d.zone);
      });
    }
    function zoneAt(host, x, y) {
      var r = host.getBoundingClientRect(), pad = 36;
      if (x < r.left - 60 || x > r.right + 60 || y < r.top - pad - 30 || y > r.bottom + pad + 30) return null;
      var h = r.height + pad * 2, top = r.top - pad;
      if (y < top + h * 0.28) return 'above';
      if (y > top + h * 0.72) return 'below';
      return x < r.left + r.width / 2 ? 'side' : 'side-start';
    }
    function showZones(host) {
      var br = pagesBox.getBoundingClientRect(), r = host.getBoundingClientRect(), pad = 36;
      var z = document.createElement('div'); z.className = 'fig-zones';
      z.style.left = (r.left - br.left + pagesBox.scrollLeft) + 'px'; z.style.top = (r.top - pad - br.top + pagesBox.scrollTop) + 'px'; z.style.width = r.width + 'px'; z.style.height = (r.height + pad * 2) + 'px';
      z.innerHTML = '<span data-z="above">فوق السؤال</span><span data-z="side-start">بجانبه يمين</span><span data-z="side">بجانبه يسار</span><span data-z="below">تحت السؤال</span>';
      pagesBox.appendChild(z);
    }

    /* النقر على الورقة يفتح السؤال للتحرير */
    pagesBox.addEventListener('click', function (ev) {
      if (ev.target.closest('.fig-ov')) return;
      var t = ev.target.closest('[data-q]');
      if (t) { var id = t.dataset.q; for (var s = 0; s < e.sections.length; s++) for (var i = 0; i < e.sections[s].items.length; i++) if (e.sections[s].items[i].qid === id) { if (!sel || sel.s !== s || sel.i !== i) select(s, i); return; } }
      var sc = ev.target.closest('.p-sec[data-sec]');
      if (sc) { setTabSilent('q'); sel = { s: +sc.dataset.sec, i: -1 }; drawPane(); }
    });

    /* أدوات المعاينة */
    M.qsa('#sd-view button', app).forEach(function (b) { b.onclick = function () { view = b.dataset.v; M.qsa('#sd-view button', app).forEach(function (x) { x.classList.toggle('on', x === b); }); renderPaper(); }; });
    M.qs('#sd-zi', app).onclick = function () { zoom = Math.min(3, (zoom || 1) * 1.25); renderPaper(); };
    M.qs('#sd-zo', app).onclick = function () { zoom = Math.max(0.4, (zoom || 1) / 1.25); renderPaper(); };
    M.qs('#sd-zf', app).onclick = function () { zoom = 0; renderPaper(); };
    M.qs('#sd-out', app).onclick = function () {
      M.modal({ title: 'إخراج الامتحان', wide: true, body: '<div class="out-grid">' + OUT.map(function (o) { return '<button type="button" class="out" data-out="' + o[0] + '">' + I(o[1], 22) + '<b>' + o[2] + '</b><span>' + o[3] + '</span></button>'; }).join('') + '</div>' +
        (issues().length ? '<div class="alert warn" style="margin-top:12px">' + I('warn') + '<div>' + n(issues().length) + ' ملاحظة على الورقة — راجعها من تبويب «المراجعة».</div></div>' : ''),
        onMount: function (m, close) { M.qsa('[data-out]', m).forEach(function (b) { b.onclick = function () { close(); doOut(b.dataset.out); }; }); } });
    };
    M.qs('#sd-word', app).onclick = function () { doOut('word'); };
    M.qs('#sd-pdf', app).onclick = function () { doOut('pdf'); };

    /* تغيير المساحة بين اللوحة والورقة */
    (function () {
      var h = M.qs('#sd-split', app), d = null;
      h.addEventListener('pointerdown', function (ev) { ev.preventDefault(); h.setPointerCapture(ev.pointerId); d = { r: body.getBoundingClientRect() }; body.classList.add('dragging'); });
      h.addEventListener('pointermove', function (ev) {
        if (!d) return;
        var row = mq.matches, pct = row ? (d.r.right - ev.clientX) / d.r.width * 100 : (ev.clientY - d.r.top) / d.r.height * 100;
        pct = Math.max(row ? 28 : 22, Math.min(row ? 70 : 78, pct)); split = Math.round(pct);
        body.style.setProperty('--split', split + '%');
      });
      h.addEventListener('pointerup', function () { if (!d) return; d = null; body.classList.remove('dragging'); try { localStorage.setItem('sd-split', split); } catch (x) { /* */ } renderPaper(); });
    })();

    /* اختصارات ولصق */
    function onKey(ev) {
      var k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey, inField = ev.target.matches && ev.target.matches('input,textarea,select');
      if (mod && k === 'z' && !ev.shiftKey && !inField) { ev.preventDefault(); undo(); }
      else if (mod && (k === 'y' || (k === 'z' && ev.shiftKey)) && !inField) { ev.preventDefault(); redo(); }
      else if (mod && k === 'p') { ev.preventDefault(); doOut('print'); }
      else if (k === 'escape' && sel && !document.querySelector('.overlay')) { sel = null; drawPane(); }
    }
    function onPaste(ev) {
      var q = curQ(); if (!q || document.querySelector('.overlay')) return;
      var f = Array.prototype.slice.call((ev.clipboardData || {}).files || []).find(function (x) { return /^image\//.test(x.type); });
      if (!f) return; ev.preventDefault();
      M.readFile(f, 'dataurl').then(function (d) { return M.shrinkImage(d, 1600); }).then(function (d) { q.figure = d; q.figureShapes = null; q.figureWidth = q.figureWidth || 50; touch(true); M.toast('لُصقت الصورة في السؤال', 'ok'); });
    }
    var onResize = M.debounce(function () { renderPaper(); }, 200);
    document.addEventListener('keydown', onKey); document.addEventListener('paste', onPaste); window.addEventListener('resize', onResize);

    setTab('q'); renderPaper(); updUndo();
    if (r.q.import) setTimeout(openImport, 300);
    else if (!e.sections.length) setTimeout(function () { var b = M.qs('#ol-new', app); if (b) b.classList.add('pulse-btn'); }, 400);

    return { destroy: function () {
      alive = false; document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); window.removeEventListener('resize', onResize);
      M.save('exams', clone(e), { log: false });
    } };
  };
})(window.M);
