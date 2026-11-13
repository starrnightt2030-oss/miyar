/* مكتبتا الأسئلة: المستخرجة (من أوراق وملفات + المحفوظة يدوياً من الامتحانات) والمولدة بالذكاء الاصطناعي
   بطاقة السؤال القابلة للتعديل تُستخدم في المراجعة وفي المكتبة. كل النصوص تُعرض مُهرَّبة */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;
  var L = M.AR_LETTERS || ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

  function chip(cls, t) { return '<span class="chip ' + cls + '">' + t + '</span>'; }
  function srcLabel(q) {
    var s = q.src || {};
    if (q.origin === 'manual') return 'مكتوب يدوياً' + (s.name ? ' — من «' + esc(s.name) + '»' : '');
    if (q.lib === 'generated') return 'مولد من «' + esc(s.name || 'محتوى') + '»' + (s.label ? ' — ' + esc(s.label) : '');
    return esc(s.name || '') + (s.label ? ' — ' + esc(s.label) : '') + (q.spanPages && s.pages ? ' (ممتد: ' + esc(s.pages.join(' ← ')) + ')' : '');
  }
  M.libSrcLabel = srcLabel;

  /* ===== البطاقة القابلة للتعديل ===== */
  M.libCardHTML = function (q, i, o) {
    o = o || {};
    var t = q.type, ans = M.ansState(q), unclear = M.isUnclear(q);
    var h = '<div class="lq' + (unclear ? ' is-unclear' : '') + '" data-i="' + i + '">';
    h += '<div class="lq-h">' + (o.review ? '<input type="checkbox" class="lq-sel" data-sel aria-label="تحديد"' + (q._sel ? ' checked' : '') + '>' : '') +
      '<b class="lq-n">' + (q.ctx && q.ctx.main ? esc(q.ctx.main) + ' — ' : '') + (q.num ? esc(q.num) : n(i + 1)) + '</b>' +
      '<select class="inp lq-type" data-type aria-label="نوع السؤال">' + M.LIB_TYPES.map(function (k) { return '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + esc(M.TYPE[k].label) + '</option>'; }).join('') + '</select>' +
      chip(M.ANS[ans].cls, M.ANS[ans].label) + (unclear ? chip('bad', 'به جزء غير واضح') : '') + (q.typeNote ? chip('warn', esc(q.typeNote)) : '') + (q.spanPages ? chip('info', 'ممتد بين صفحتين') : '') +
      (o.dupOf && o.dupOf.length ? chip('warn', 'قد يكون مكرراً في المكتبة (' + n(o.dupOf.length) + ')') : '') + (o.dupHere ? chip('warn', 'مكرر مع سؤال سابق في هذه المراجعة') : '') +
      '<span class="grow"></span>' + (q.src && q.src.id ? '<button type="button" class="btn sm ghost" data-src>' + I('eye', 15) + ' المصدر</button>' : '') + '</div>';
    h += '<div class="lq-src small muted">' + srcLabel(q) + '</div>';
    h += '<div class="lq-b">';
    if (q.ctx && (q.ctx.title || q.ctx.passage)) h += '<div class="grid2"><div class="field"><label>التعليمات المشتركة</label><input class="inp paper-font" data-ctx="title" value="' + esc(q.ctx.title || '') + '"></div>' + (q.ctx.passage ? '<div class="field"><label>القطعة / النص المشترك</label><textarea class="inp paper-font" rows="2" data-ctx="passage">' + esc(q.ctx.passage) + '</textarea></div>' : '') + '</div>';
    if (t !== 'match' || q.text) h += '<div class="field"><label>' + (t === 'term' ? 'التعريف (نص السؤال)' : 'نص السؤال') + (t === 'complete' ? ' — الفراغ بين [[ ]] ، و[[؟]] لفراغ إجابته غير معروفة' : '') + '</label><textarea class="inp paper-font" rows="' + Math.min(6, 2 + Math.floor(String(q.text || '').length / 90)) + '" data-f="text">' + esc(q.text || '') + '</textarea></div>';
    if (q.suggest && q.suggest.text) h += '<div class="lq-sug"><span class="small"><b>تصحيح لغوي مقترح (لم يُطبَّق):</b> <span class="paper-font">' + esc(q.suggest.text) + '</span></span><div class="row" style="gap:4px"><button type="button" class="btn sm" data-sug="1">قبول</button><button type="button" class="btn sm ghost" data-sug="0">رفض</button></div></div>';
    if (unclear) h += '<div class="lq-unc small">' + I('warn', 15) + ' <span>' + (q.unclearNotes && q.unclearNotes.length ? esc(q.unclearNotes.join(' · ')) : 'يوجد جزء غير مقروء ⟦؟⟧') + ' — صححه من المصدر ثم</span> <label class="check"><input type="checkbox" data-unc> راجعت الأجزاء غير الواضحة</label></div>';
    if (t === 'mcq') {
      h += '<div class="lq-opts">' + q.options.map(function (op, j) { return '<label class="lq-op"><input type="radio" name="c' + i + '" data-correct="' + j + '"' + (q.correct === j ? ' checked' : '') + '><b>' + L[j] + ')</b><input class="inp paper-font" data-opt="' + j + '" value="' + esc(op) + '"><button type="button" class="btn icon sm ghost" data-delopt="' + j + '" aria-label="حذف الاختيار">' + I('x', 14) + '</button></label>'; }).join('') +
        '<label class="lq-op"><input type="radio" name="c' + i + '" data-correct="-1"' + (q.correct == null || q.correct < 0 ? ' checked' : '') + '><span class="muted">الإجابة غير محددة</span></label><button type="button" class="btn sm ghost" data-addopt>+ اختيار</button></div>';
    }
    if (t === 'tf') h += '<div class="row" style="gap:8px"><div class="seg" data-tf>' + [['1', 'صح ✓'], ['0', 'خطأ ✗'], ['', 'غير محددة']].map(function (x) { var on = x[0] === '1' ? q.answer === true : x[0] === '0' ? q.answer === false : !(q.answer === true || q.answer === false); return '<button type="button" data-v="' + x[0] + '" class="' + (on ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (q.answer === false ? '<input class="inp paper-font grow" data-f="correction" placeholder="تصويب العبارة الخطأ" value="' + esc(q.correction || '') + '">' : '') + '</div>';
    if (t === 'term') h += '<div class="field"><label>المصطلح (الإجابة)</label><input class="inp paper-font" data-f="term" placeholder="غير محدد" value="' + esc(q.term || '') + '"></div>';
    if (t === 'match') {
      h += '<div class="lq-match">' + q.pairs.map(function (p, j) { return '<div class="row" style="gap:6px"><b>' + n(j + 1) + '</b><input class="inp paper-font" data-pa="' + j + '" value="' + esc(p.a) + '"><span>←</span><input class="inp paper-font" data-pb="' + j + '" value="' + esc(p.b) + '"></div>'; }).join('') +
        '<div class="field"><label>بدائل زائدة في العمود (ب) — افصل بـ ؛</label><input class="inp paper-font" data-extras value="' + esc((q.extras || []).join('؛ ')) + '"></div>' +
        (q.matchUnknown ? '<div class="small warn-t">الربط الصحيح غير موجود في المصدر — العمود (ب) معروض بترتيب المصدر. اربط كل عنصر بمقابله الصحيح ثم <label class="check"><input type="checkbox" data-mok> الربط صحيح الآن</label></div>' : '') + '</div>';
    }
    if (['reason', 'essay', 'problem', 'draw'].indexOf(t) >= 0) h += '<div class="field"><label>نموذج الإجابة</label><textarea class="inp paper-font" rows="2" data-f="modelAnswer" placeholder="غير محدد">' + esc(q.modelAnswer || '') + '</textarea></div>';
    if (q.aiAnswer) {
      var p = q.aiAnswer;
      h += '<div class="lq-ai small">' + I('spark', 15) + ' <b>اقتراح الذكاء الاصطناعي (مسودة):</b> ' + (p.ambiguous ? '<span class="warn-t">لم يقترح إجابة — ' + esc(p.note || 'السؤال غامض أو تنقصه معلومات') + '</span>' : esc(aiText(q, p)) + (p.note ? ' <span class="muted">(' + esc(p.note) + ')</span>' : '')) +
        '<div class="row" style="gap:4px">' + (p.ambiguous ? '' : '<button type="button" class="btn sm" data-aiok>استخدام كإجابة مقترحة</button>') + '<button type="button" class="btn sm ghost" data-ainot>تجاهل</button></div></div>';
    }
    if (q.ans === 'ai' && M.hasAnswer(q)) h += '<div class="lq-ai small">' + I('warn', 15) + ' الإجابة الحالية مقترحة من الذكاء الاصطناعي. <button type="button" class="btn sm" data-confirm>أؤكد أن الإجابة صحيحة</button></div>';
    if (q.figure) h += '<div class="lq-fig"><img src="' + q.figure + '" alt="الرسم المرتبط بالسؤال"><div class="row" style="gap:4px"><button type="button" class="btn sm" data-figedit>' + I('fit', 14) + ' تعديل</button><button type="button" class="btn sm ghost" data-figdel>إزالة الرسم</button></div></div>';
    h += '</div>';
    if (o.review) h += '<div class="lq-f"><button type="button" class="btn sm ghost" data-split>تقسيم عند المؤشر</button><button type="button" class="btn sm ghost" data-merge>دمج مع التالي</button><button type="button" class="btn sm ghost" data-remove>' + I('trash', 14) + ' استبعاد</button></div>';
    return h + '</div>';
  };
  function aiText(q, p) {
    if (p.correct != null) return L[p.correct] + ') ' + (q.options[p.correct] || '');
    if (p.answer != null) return (p.answer ? 'صح' : 'خطأ') + (p.correction ? ' — ' + p.correction : '');
    if (p.blanks) return p.blanks.join(' — ');
    if (p.term) return p.term;
    if (p.matchKey) return q.pairs.map(function (x, i) { var B = q.srcB || []; return x.a + ' ← ' + (B[p.matchKey[i]] || '?'); }).join(' · ');
    return p.modelAnswer || '';
  }

  M.bindLibCards = function (root, qs, h) {
    M.qsa('.lq', root).forEach(function (card) {
      var i = +card.dataset.i, q = qs[i];
      var ch = function (full) { if (M.hasAnswer(q) && q.ans === 'none') q.ans = 'teacher'; if (!M.hasAnswer(q)) q.ans = 'none'; h.onChange(q, full); };
      var teacher = function () { q.ans = M.hasAnswer(q) ? 'teacher' : 'none'; };
      var on = function (sel, ev, fn) { M.qsa(sel, card).forEach(function (el) { el[ev] = function (e) { fn(el, e); }; }); };
      on('[data-sel]', 'onchange', function (el) { q._sel = el.checked; h.onChange(q, false); });
      on('[data-type]', 'onchange', function (el) { changeType(q, el.value); h.onChange(q, true); });
      on('[data-f]', 'oninput', function (el) { q[el.dataset.f] = el.value; if (el.dataset.f !== 'text' || q.type === 'complete') teacher(); ch(false); });
      on('[data-ctx]', 'oninput', function (el) { q.ctx = q.ctx || {}; q.ctx[el.dataset.ctx] = el.value; h.onChange(q, false); });
      on('[data-opt]', 'oninput', function (el) { q.options[+el.dataset.opt] = el.value; h.onChange(q, false); });
      on('[data-correct]', 'onchange', function (el) { var v = +el.dataset.correct; q.correct = v < 0 ? null : v; teacher(); ch(true); });
      on('[data-delopt]', 'onclick', function (el) { var j = +el.dataset.delopt; q.options.splice(j, 1); if (q.correct === j) q.correct = null; else if (q.correct > j) q.correct--; ch(true); });
      on('[data-addopt]', 'onclick', function () { q.options.push(''); h.onChange(q, true); });
      on('[data-tf] button', 'onclick', function (el) { var v = el.dataset.v; q.answer = v === '1' ? true : v === '0' ? false : null; teacher(); ch(true); });
      on('[data-pa]', 'oninput', function (el) { q.pairs[+el.dataset.pa].a = el.value; h.onChange(q, false); });
      on('[data-pb]', 'oninput', function (el) { q.pairs[+el.dataset.pb].b = el.value; h.onChange(q, false); });
      on('[data-extras]', 'oninput', function (el) { q.extras = el.value.split(/[؛;]/).map(function (x) { return x.trim(); }).filter(Boolean); h.onChange(q, false); });
      on('[data-mok]', 'onchange', function (el) { if (el.checked) { q.matchUnknown = false; teacher(); ch(true); } });
      on('[data-unc]', 'onchange', function (el) {
        if (!el.checked) return;
        var txt = [q.text, q.term, q.correction, q.modelAnswer].concat(q.options || []).join(' ');
        if (txt.indexOf(M.UNCLEAR) >= 0) { el.checked = false; return M.toast('ما زال النص يحتوي على ⟦؟⟧ — اكتب الجزء الصحيح من المصدر مكانه', 'bad'); }
        q.unclear = false; q.unclearNotes = []; h.onChange(q, true);
      });
      on('[data-sug]', 'onclick', function (el) { if (el.dataset.sug === '1') { q.text = q.suggest.text; q.textCorrected = true; } delete q.suggest; h.onChange(q, true); });
      on('[data-aiok]', 'onclick', function () { M.applyAiAnswer(q); h.onChange(q, true); });
      on('[data-ainot]', 'onclick', function () { delete q.aiAnswer; h.onChange(q, true); });
      on('[data-confirm]', 'onclick', function () { q.ans = 'teacher'; h.onChange(q, true); M.toast('أُكدت الإجابة', 'ok'); });
      on('[data-figdel]', 'onclick', function () { q.figure = ''; h.onChange(q, true); });
      on('[data-figedit]', 'onclick', function () { M.imageTools(q.figure, function (d) { q.figure = d; h.onChange(q, true); }); });
      on('[data-src]', 'onclick', function () { M.showSource(q); });
      on('[data-merge]', 'onclick', function () { if (i >= qs.length - 1) return M.toast('لا يوجد سؤال بعده', 'bad'); h.onMerge(i); });
      on('[data-remove]', 'onclick', function () { h.onRemove(i); });
      on('[data-split]', 'onclick', function () {
        var ta = M.qs('[data-f="text"]', card); var pos = ta ? ta.selectionStart : -1;
        if (!ta || pos <= 0 || pos >= ta.value.length) return M.toast('ضع المؤشر داخل نص السؤال عند بداية السؤال الثاني ثم اضغط «تقسيم»', 'bad');
        var a = q, b = JSON.parse(JSON.stringify(q));
        b.text = ta.value.slice(pos).trim(); a.text = ta.value.slice(0, pos).trim();
        if (a.type === 'mcq') { b.options = ['', '']; b.correct = null; }
        b.ans = 'none'; delete b.figure; b.num = ''; if (b.orig) b.orig = Object.assign({}, b.orig, { text: b.text });
        if (!M.hasAnswer(b)) b.ans = 'none';
        h.onSplit(i, a, b);
      });
    });
  };
  function changeType(q, t) {
    var old = q.type; q.type = t;
    if (t === 'mcq' && (!q.options || q.options.length < 2)) { q.options = ['', '', '', '']; q.correct = null; }
    if (t === 'tf' && old !== 'tf') q.answer = null;
    if (t === 'match' && (!q.pairs || !q.pairs.length)) { q.pairs = [{ a: '', b: '' }, { a: '', b: '' }]; q.matchUnknown = true; }
    if (t === 'complete' && !/\[\[/.test(q.text || '')) q.text = String(q.text || '').replace(/\.{3,}|…+|_{3,}/g, '[[' + M.BLANK_UNKNOWN + ']]');
    if (['reason', 'essay', 'problem'].indexOf(t) >= 0 && !Number(q.lines)) q.lines = 3;
    q.grade = q.grade || M.TYPE[t].grade;
    delete q.typeNote;
    q.ans = M.hasAnswer(q) ? (q.ans === 'none' ? 'teacher' : q.ans) : 'none';
  }

  /* معاينة المصدر: صورة الصفحة مع تحديد موضع السؤال، أو نص فقرات Word */
  M.showSource = function (q) {
    var s = q.src || {};
    var draw = function (rec) {
      var pg = rec && (rec.pages || []).find(function (p) { return p.n === s.page; });
      var body;
      if (!pg) body = '<div class="alert warn">' + I('warn') + '<div>معاينة المصدر غير محفوظة على هذا الجهاز (المعاينات تُحفظ على الجهاز الذي تم عليه الاستخراج وفي النسخة الاحتياطية الكاملة).</div></div>';
      else if (pg.thumb) {
        var b = s.box, mark = b ? '<i class="src-box" style="top:' + (b[0] * 100) + '%;left:' + (b[1] * 100) + '%;height:' + ((b[2] - b[0]) * 100) + '%;width:' + ((b[3] - b[1]) * 100) + '%"></i>' : (s.pos ? '<i class="src-line" style="top:' + (s.pos / 10) + '%"></i>' : '');
        body = '<div class="src-view"><img src="' + pg.thumb + '" alt="صفحة المصدر">' + mark + '</div>';
      } else {
        var para = s.para;
        body = '<div class="src-doc paper-font">' + esc(pg.text).split('\n').map(function (l) { var m = /^\[ف(\d+)\]/.exec(l); return '<div' + (m && Number(m[1]) === para ? ' class="hl" id="src-hl"' : '') + '>' + l + '</div>'; }).join('') + '</div>';
      }
      M.modal({ title: 'المصدر — ' + (s.name || '') + (s.label ? ' — ' + s.label : ''), wide: true, body: body, onMount: function (m) { var hl = M.qs('#src-hl', m); if (hl) hl.scrollIntoView({ block: 'center' }); var ln = M.qs('.src-line', m) || M.qs('.src-box', m); if (ln) setTimeout(function () { ln.scrollIntoView({ block: 'center' }); }, 60); } });
    };
    M.db.get('sources', s.id).then(draw).catch(function () { draw(null); });
  };

  /* اقتراح الإجابات: اختيار المزود ثم إرسال الأسئلة الناقصة فقط */
  M.aiAnswerDialog = function (qs, done) {
    var routes = M.aiRoutes();
    if (!routes.length) return M.toast('أضف مفتاح الذكاء الاصطناعي من الإعدادات أولاً', 'bad');
    M.modal({ title: 'اقتراح إجابات بالذكاء الاصطناعي (' + n(qs.length) + ' سؤال)',
      body: '<p class="small muted" style="margin:0 0 10px">تُرسل نصوص هذه الأسئلة فقط للمزود. الاقتراحات تظهر كمسودة بجانب كل سؤال، ولا تصبح إجابة إلا بضغطك، وتبقى عليها علامة «مقترحة» حتى تؤكدها. الأسئلة الغامضة تُعرض كمشكلة بدل اختراع إجابة.</p>' +
        '<div class="grid2"><div class="field"><label for="aa-r">المزود</label><select id="aa-r" class="inp">' + routes.map(function (r, i) { return '<option value="' + i + '">' + esc(M.AI_PROVIDERS[r.provider].name) + '</option>'; }).join('') + '</select></div><div class="field"><label for="aa-m">النموذج</label><select id="aa-m" class="inp"></select></div></div><div id="aa-st"></div>',
      foot: '<button class="btn pri" data-ok>' + I('spark', 16) + ' اقتراح</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var rs = M.qs('#aa-r', m), ms = M.qs('#aa-m', m), st = M.qs('#aa-st', m);
        var load = function () { var r = routes[+rs.value]; M.aiListModels(r).then(function (list) { var def = M.aiDefaultModel(r.provider, list); ms.innerHTML = list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === def ? ' selected' : '') + '>' + esc(x.label || x.id) + '</option>'; }).join(''); }).catch(function (e) { st.innerHTML = '<div class="alert bad">' + esc(M.aiFriendly(e.message)) + '</div>'; }); };
        rs.onchange = load; load();
        M.qs('[data-ok]', m).onclick = function () {
          if (!navigator.onLine) return M.toast('يحتاج اتصالاً بالإنترنت', 'bad');
          var b = this; b.disabled = true; st.innerHTML = '<div class="alert info"><span class="pulse">' + I('spark') + '</span><div>جارٍ الاقتراح…</div></div>';
          var chunks = []; for (var i = 0; i < qs.length; i += 25) chunks.push(qs.slice(i, i + 25));
          chunks.reduce(function (p, c) { return p.then(function (t) { return M.suggestAnswers(c, routes[+rs.value], ms.value).then(function (k) { return t + k; }); }); }, Promise.resolve(0))
            .then(function (k) { close(); M.toast('وصلت ' + n(k) + ' اقتراحات — راجعها في البطاقات', 'ok'); done(); })
            .catch(function (e) { b.disabled = false; st.innerHTML = '<div class="alert bad">' + I('warn') + '<div>' + esc(M.aiFriendly(e.message)) + ' — لم يتغير أي شيء، أعد المحاولة.</div></div>'; });
        };
      } });
  };

  /* ===== صفحة المكتبة ===== */
  var F = { library: {}, 'library-ai': {} };
  function libView(lib) {
    return function (main) {
      var cfg = M.LIBS[lib], route = cfg.route, f = F[route];
      var all = M.libQs(lib);
      var match = function (q) {
        if (f.q) { var t = M.norm(f.q); var hay = M.norm([q.text, q.term, q.modelAnswer, (q.options || []).join(' '), (q.pairs || []).map(function (p) { return p.a + ' ' + p.b; }).join(' '), (q.meta || {}).subject, (q.meta || {}).lesson, (q.meta || {}).unit, ((q.meta || {}).tags || []).join(' '), (q.src || {}).name].join(' ')); if (hay.indexOf(t) < 0) return false; }
        if (f.type && q.type !== f.type) return false;
        if (f.review && (q.review || 'needs') !== f.review) return false;
        if (f.ans && M.ansState(q) !== f.ans) return false;
        if (f.subject && (q.meta || {}).subject !== f.subject) return false;
        if (f.grade && (q.meta || {}).grade !== f.grade) return false;
        if (f.flag === 'unclear' && !M.isUnclear(q)) return false;
        if (f.flag === 'dup' && !dups[q.id]) return false;
        if (f.flag === 'issues' && !M.libIssues(q).length) return false;
        return true;
      };
      var dups = {};
      all.forEach(function (q, i) { all.slice(i + 1).forEach(function (o) { if (o.type === q.type && (M.qKey(o) === M.qKey(q) || M.similarity(q.text + ' ' + (q.options || []).join(' '), o.text + ' ' + (o.options || []).join(' ')) >= 0.85)) { (dups[q.id] = dups[q.id] || []).push(o.id); (dups[o.id] = dups[o.id] || []).push(q.id); } }); });
      var list = all.filter(match).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
      var vals = function (k) { var o = {}; all.forEach(function (q) { var v = (q.meta || {})[k]; if (v) o[v] = 1; }); return Object.keys(o); };
      var opt = function (v, t, cur) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(t) + '</option>'; };
      var other = lib === 'extracted' ? 'generated' : 'extracted';
      main.innerHTML = M.topbar(esc(cfg.name), n(all.length) + ' سؤال' + (lib === 'extracted' ? ' — من أوراق وملفات راجعناها، أو أسئلة حفظتها من امتحاناتك' : ' — أسئلة جديدة ولّدها الذكاء الاصطناعي من محتوى رفعته'),
        (lib === 'extracted' ? '<a class="btn pri" href="#/extract">' + I('spark', 16) + ' استخراج أسئلة من ملف أو صور</a>' : '<a class="btn pri" href="#/generate">' + I('spark', 16) + ' توليد أسئلة من محتوى</a>') + '<a class="btn" href="#/' + M.LIBS[other].route + '">' + esc(M.LIBS[other].short) + '</a>', '#/home') +
        '<div class="content lib"><div class="card lib-f"><div class="lib-fr"><input class="inp grow" id="lf-q" placeholder="بحث في النص والإجابات والمادة والوسوم والمصدر" value="' + esc(f.q || '') + '">' +
        '<select class="inp" id="lf-type"><option value="">كل الأنواع</option>' + M.LIB_TYPES.map(function (t) { return opt(t, M.TYPE[t].label, f.type); }).join('') + '</select>' +
        '<select class="inp" id="lf-rev"><option value="">كل حالات المراجعة</option>' + Object.keys(M.REVIEW).map(function (k) { return opt(k, M.REVIEW[k].label, f.review); }).join('') + '</select>' +
        '<select class="inp" id="lf-ans"><option value="">كل حالات الإجابة</option>' + Object.keys(M.ANS).map(function (k) { return opt(k, M.ANS[k].label.split(' — ')[0], f.ans); }).join('') + '</select>' +
        '<select class="inp" id="lf-sub"><option value="">كل المواد</option>' + vals('subject').map(function (v) { return opt(v, v, f.subject); }).join('') + '</select>' +
        '<select class="inp" id="lf-gr"><option value="">كل الصفوف</option>' + vals('grade').map(function (v) { return opt(v, v, f.grade); }).join('') + '</select>' +
        '<select class="inp" id="lf-flag"><option value="">بدون فلتر إضافي</option>' + opt('issues', 'تحتاج انتباهاً', f.flag) + opt('unclear', 'بها نص غير واضح', f.flag) + opt('dup', 'مكررات محتملة', f.flag) + '</select></div>' +
        '<div class="row" style="gap:6px;margin-top:8px"><span class="small muted">' + n(list.length) + ' نتيجة</span><span class="grow"></span><button class="btn sm" id="lf-all">تحديد الظاهر</button><button class="btn sm" id="lf-bulk" disabled>إجراء على المحدد</button></div></div>' +
        (all.length ? '<div class="lib-list">' + list.map(function (q) { return rowHTML(q, dups[q.id]); }).join('') + '</div>' + (!list.length ? '<div class="empty">لا نتائج لهذا البحث.</div>' : '')
          : '<div class="empty">المكتبة فارغة. ' + (lib === 'extracted' ? 'ابدأ بـ «استخراج أسئلة من ملف أو صور»، أو احفظ سؤالاً من داخل الاستوديو.' : 'ابدأ بـ «توليد أسئلة من محتوى».') + '</div>') + '</div>';
      var rerender = function () { libView(lib)(main); };
      var deb = M.debounce(function () { f.q = M.qs('#lf-q', main).value; rerender(); var el = M.qs('#lf-q', main); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 300);
      M.qs('#lf-q', main).oninput = deb;
      [['lf-type', 'type'], ['lf-rev', 'review'], ['lf-ans', 'ans'], ['lf-sub', 'subject'], ['lf-gr', 'grade'], ['lf-flag', 'flag']].forEach(function (x) { M.qs('#' + x[0], main).onchange = function () { f[x[1]] = this.value; rerender(); }; });
      var picked = {};
      var upd = function () { var c = Object.keys(picked).length; var b = M.qs('#lf-bulk', main); b.disabled = !c; b.textContent = c ? 'إجراء على ' + n(c) + ' محدد' : 'إجراء على المحدد'; };
      M.qsa('[data-pick]', main).forEach(function (c) { c.onchange = function () { if (c.checked) picked[c.dataset.pick] = 1; else delete picked[c.dataset.pick]; upd(); }; });
      M.qs('#lf-all', main).onclick = function () { M.qsa('[data-pick]', main).forEach(function (c) { c.checked = true; picked[c.dataset.pick] = 1; }); upd(); };
      M.qs('#lf-bulk', main).onclick = function () { bulkDialog(Object.keys(picked).map(function (id) { return M.byId('questions', id); }).filter(Boolean), rerender); };
      M.qsa('[data-act]', main).forEach(function (b) {
        b.onclick = function () {
          var q = M.byId('questions', b.dataset.id), a = b.dataset.act; if (!q) return;
          if (a === 'view') previewDialog(q, dups[q.id]);
          if (a === 'edit') editDialog(q, rerender);
          if (a === 'copy') { var c = JSON.parse(JSON.stringify(q)); c.id = M.uid(); delete c.createdAt; delete c.updatedAt; delete c.ver; delete c.cloudAt; delete c.ownerId; c.review = 'needs'; c.copyOf = q.id; M.save('questions', c).then(function () { M.toast('نُسخ السؤال — النسخة بحالة «يحتاج مراجعة»', 'ok'); rerender(); }); }
          if (a === 'del') M.confirm('حذف السؤال', 'حذف هذا السؤال من المكتبة نهائياً؟ الامتحانات التي أُضيف إليها لا تتأثر لأن لها نسخة مستقلة.', 'حذف', true).then(function (ok) { if (ok) M.remove('questions', q.id).then(function () { M.toast('حُذف'); rerender(); }); });
          if (a === 'src') M.showSource(q);
        };
      });
    };
  }
  function rowHTML(q, dup) {
    var ans = M.ansState(q), rv = M.REVIEW[q.review || 'needs'], m = q.meta || {}, iss = M.libIssues(q).filter(function (x) { return !/لم تتم مراجعته/.test(x.t); });
    return '<div class="lib-row"><input type="checkbox" data-pick="' + q.id + '" aria-label="تحديد"><div class="lib-rb">' +
      '<div class="row" style="gap:6px">' + M.typeChip(q.type) + chip(rv.cls, rv.label) + chip(M.ANS[ans].cls, M.ANS[ans].label.split(' — ')[0]) + (M.isUnclear(q) ? chip('bad', 'غير واضح') : '') + (dup ? chip('warn', 'مكرر محتمل') : '') + (q.figure ? chip('', 'به رسم') : '') + '</div>' +
      '<div class="paper-font lib-t">' + M.richText(q.text || (q.pairs || []).map(function (p) { return p.a + ' ← ' + p.b; }).join(' · '), 'arabic') + '</div>' +
      (q.type === 'mcq' ? '<div class="small">' + q.options.map(function (o, i) { return i === q.correct ? '<b class="ok-t">' + esc(o) + ' ✓</b>' : esc(o); }).join(' · ') + '</div>' : '') +
      '<div class="small muted">' + [m.subject, m.grade, m.unit, m.lesson].filter(Boolean).map(esc).join(' · ') + ((m.tags || []).length ? ' · #' + m.tags.map(esc).join(' #') : '') + (([m.subject, m.grade, m.unit, m.lesson].filter(Boolean).length || (m.tags || []).length) ? ' — ' : '') + srcLabel(q) + ' · أُنشئ ' + n(M.fmtDate(q.createdAt)) + (q.updatedAt !== q.createdAt ? ' · عُدّل ' + n(M.fmtDate(q.updatedAt)) : '') + '</div>' +
      (iss.length ? '<div class="small bad-t">' + iss.map(function (x) { return esc(x.t); }).join(' · ') + '</div>' : '') + '</div>' +
      '<div class="lib-ra"><button class="btn sm" data-act="view" data-id="' + q.id + '">' + I('eye', 15) + ' معاينة</button><button class="btn sm" data-act="edit" data-id="' + q.id + '">' + I('edit', 15) + ' تعديل</button>' +
      '<button class="btn sm ghost" data-act="copy" data-id="' + q.id + '" aria-label="نسخ">' + I('copy', 15) + '</button>' + (q.src && q.src.id ? '<button class="btn sm ghost" data-act="src" data-id="' + q.id + '" aria-label="المصدر">' + I('file', 15) + '</button>' : '') + '<button class="btn sm ghost" data-act="del" data-id="' + q.id + '" aria-label="حذف">' + I('trash', 15) + '</button></div></div>';
  }
  function previewDialog(q, dup) {
    var ex = { id: 'pv', sections: [{ id: 's', type: q.type, title: (q.ctx && q.ctx.title) || M.TYPE[q.type].title, passage: q.ctx && q.ctx.passage, items: [{ qid: q.id }] }], digits: 'arabic', frozen: {}, styleVer: 2, typo: 'normal', fontPt: 14 };
    ex.frozen[q.id] = q;
    var others = (dup || []).map(function (id) { return M.byId('questions', id); }).filter(Boolean);
    M.modal({ title: 'معاينة السؤال', wide: true, body: '<div class="lib-pv">' + M.renderQuestionPreview(q, 'arabic') + '</div><div class="small" style="margin-top:8px"><b>الإجابة:</b> ' + (M.hasAnswer(q) ? M.richText(M.answerText(q), 'arabic', { answers: true }) : '<span class="bad-t">غير محددة</span>') + ' — ' + esc(M.ANS[M.ansState(q)].label) + '</div>' +
      (q.orig && (q.orig.text !== q.text || q.orig.type !== q.type) ? '<details class="small" style="margin-top:8px"><summary>الأصل قبل التعديل</summary><div class="paper-font">' + esc(M.TYPE[q.orig.type] ? M.TYPE[q.orig.type].label : '') + ': ' + esc(q.orig.text) + '</div></details>' : '') +
      (others.length ? '<div class="alert warn" style="margin-top:8px">' + I('warn') + '<div>أسئلة مشابهة في المكتبة (لم يُحذف شيء تلقائياً):<br>' + others.map(function (o) { return '<span class="paper-font">• ' + esc(String(o.text).slice(0, 120)) + '</span>'; }).join('<br>') + '</div></div>' : '') });
  }
  function editDialog(q0, after) {
    var q = JSON.parse(JSON.stringify(q0)), arr = [q];
    M.modal({ title: 'تعديل السؤال', wide: true,
      body: '<div id="ed-card"></div><div class="grid3" style="margin-top:10px">' +
        ['subject:المادة', 'grade:الصف', 'unit:الوحدة', 'lesson:الدرس'].map(function (x) { var k = x.split(':'); return '<div class="field"><label>' + k[1] + '</label><input class="inp" data-meta="' + k[0] + '" value="' + esc((q.meta || {})[k[0]] || '') + '"></div>'; }).join('') +
        '<div class="field"><label>الوسوم</label><input class="inp" data-meta="tags" value="' + esc(((q.meta || {}).tags || []).join('، ')) + '"></div>' +
        '<div class="field"><label>حالة المراجعة</label><select class="inp" id="ed-rv">' + Object.keys(M.REVIEW).map(function (k) { return '<option value="' + k + '"' + ((q.review || 'needs') === k ? ' selected' : '') + '>' + M.REVIEW[k].label + '</option>'; }).join('') + '</select></div></div>',
      foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" id="ed-ai">' + I('spark', 15) + ' اقتراح إجابة</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var box = M.qs('#ed-card', m);
        var draw = function () { box.innerHTML = M.libCardHTML(q, 0, {}); M.bindLibCards(box, arr, { onChange: function (x, full) { if (full) draw(); }, onSplit: function () {}, onMerge: function () {}, onRemove: function () {} }); };
        draw();
        M.qs('#ed-ai', m).onclick = function () { if (M.hasAnswer(q) && q.ans !== 'none') return M.toast('للسؤال إجابة بالفعل', 'ok'); M.aiAnswerDialog(arr, draw); };
        M.qs('[data-ok]', m).onclick = function () {
          var rv = M.qs('#ed-rv', m).value;
          if (rv === 'approved') { var iss = M.libIssues(Object.assign({}, q, { review: 'approved' })).filter(function (x) { return x.k === 'bad' || /مقترحة/.test(x.t); }); if (iss.length) return M.toast('لا يمكن الاعتماد: ' + iss.map(function (x) { return x.t; }).join('، '), 'bad'); }
          q.meta = q.meta || {};
          M.qsa('[data-meta]', m).forEach(function (el) { q.meta[el.dataset.meta] = el.dataset.meta === 'tags' ? el.value.split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean) : el.value.trim(); });
          q.review = rv; q.ans = M.ansState(q);
          if (!q.orig) q.orig = { type: q0.type, text: q0.text, options: (q0.options || []).slice(), pairs: JSON.parse(JSON.stringify(q0.pairs || [])) };
          M.save('questions', q).then(function () { close(); M.toast('حُفظ', 'ok'); after(); });
        };
      } });
  }
  function bulkDialog(qs, after) {
    M.modal({ title: 'إجراء على ' + n(qs.length) + ' سؤال',
      body: '<div class="grid2">' + ['subject:المادة', 'grade:الصف', 'unit:الوحدة', 'lesson:الدرس'].map(function (x) { var k = x.split(':'); return '<div class="field"><label>' + k[1] + ' (اتركه فارغاً لعدم التغيير)</label><input class="inp" data-meta="' + k[0] + '"></div>'; }).join('') +
        '<div class="field"><label>إضافة وسوم</label><input class="inp" data-meta="tags"></div><div class="field"><label>حالة المراجعة</label><select class="inp" id="bk-rv"><option value="">بدون تغيير</option>' + Object.keys(M.REVIEW).map(function (k) { return '<option value="' + k + '">' + M.REVIEW[k].label + '</option>'; }).join('') + '</select></div></div>',
      foot: '<button class="btn pri" data-ok>تطبيق</button><button class="btn" id="bk-ai">' + I('spark', 15) + ' اقتراح إجابات للناقص</button><button class="btn danger" id="bk-del">' + I('trash', 15) + ' حذف</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qs('#bk-del', m).onclick = function () { M.confirm('حذف ' + n(qs.length) + ' سؤال', 'سيُحذف من المكتبة نهائياً. الامتحانات لا تتأثر.', 'حذف', true).then(function (ok) { if (!ok) return; qs.reduce(function (p, q) { return p.then(function () { return M.remove('questions', q.id); }); }, Promise.resolve()).then(function () { close(); M.toast('حُذف', 'ok'); after(); }); }); };
        M.qs('#bk-ai', m).onclick = function () { var need = qs.filter(function (q) { return !M.hasAnswer(q); }).map(function (q) { return JSON.parse(JSON.stringify(q)); }); if (!need.length) return M.toast('كلها لها إجابات', 'ok'); close(); M.aiAnswerDialog(need, function () { need.reduce(function (p, q) { return p.then(function () { return M.save('questions', q, { log: false }); }); }, Promise.resolve()).then(function () { M.toast('الاقتراحات محفوظة كمسودة داخل كل سؤال — افتح «تعديل» لاعتمادها', 'ok'); after(); }); }); };
        M.qs('[data-ok]', m).onclick = function () {
          var meta = {}; M.qsa('[data-meta]', m).forEach(function (el) { if (el.value.trim()) meta[el.dataset.meta] = el.value.trim(); });
          var rv = M.qs('#bk-rv', m).value, blocked = 0;
          qs.reduce(function (p, q) {
            return p.then(function () {
              q.meta = q.meta || {};
              Object.keys(meta).forEach(function (k) { if (k === 'tags') q.meta.tags = ((q.meta.tags || []).concat(meta.tags.split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean))).filter(function (x, i, a) { return a.indexOf(x) === i; }); else q.meta[k] = meta[k]; });
              if (rv === 'approved' && M.libIssues(q).some(function (x) { return x.k === 'bad' || /مقترحة/.test(x.t); })) blocked++;
              else if (rv) q.review = rv;
              return M.save('questions', q, { log: false });
            });
          }, Promise.resolve()).then(function () { close(); M.toast(blocked ? 'طُبّق — ' + n(blocked) + ' سؤال لم يُعتمد لأن به نصاً غير واضح أو إجابة غير مؤكدة' : 'طُبّق', blocked ? 'bad' : 'ok'); after(); });
        };
      } });
  }
  M.views.library = libView('extracted');
  M.views['library-ai'] = libView('generated');

  /* ===== الإضافة من المكتبة إلى الامتحان ===== */
  M.pickFromLibrary = function (opts, onInsert) {
    var lib = opts.lib || 'extracted', f = { q: '', type: opts.type || '', subject: '', review: '' }, picked = [];
    M.modal({ title: 'إضافة من المكتبة', wide: true,
      body: '<div class="seg" id="pk-lib">' + Object.keys(M.LIBS).map(function (k) { return '<button type="button" data-v="' + k + '" class="' + (k === lib ? 'on' : '') + '">' + esc(M.LIBS[k].short) + ' (' + n(M.libQs(k).length) + ')</button>'; }).join('') + '</div>' +
        '<div class="lib-fr" style="margin-top:8px"><input class="inp grow" id="pk-q" placeholder="بحث"><select class="inp" id="pk-type"><option value="">كل الأنواع</option>' + M.LIB_TYPES.map(function (t) { return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + M.TYPE[t].label + '</option>'; }).join('') + '</select><select class="inp" id="pk-sub"></select><select class="inp" id="pk-rv"><option value="">كل الحالات</option>' + Object.keys(M.REVIEW).map(function (k) { return '<option value="' + k + '">' + M.REVIEW[k].label + '</option>'; }).join('') + '</select></div>' +
        '<div class="pk-list" id="pk-list"></div>' +
        (opts.canAppend ? '<div class="field" style="margin-top:8px"><span class="lbl">مكان الإضافة</span><div class="seg" id="pk-where"><button type="button" data-v="new" class="on">أسئلة جديدة (سؤال لكل نوع)</button><button type="button" data-v="append">داخل السؤال المحدد (نفس النوع فقط)</button></div></div>' : ''),
      foot: '<button class="btn pri" data-ok disabled>إضافة</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var where = 'new';
        var draw = function () {
          var all = M.libQs(lib), subs = {}; all.forEach(function (q) { var s = (q.meta || {}).subject; if (s) subs[s] = 1; });
          M.qs('#pk-sub', m).innerHTML = '<option value="">كل المواد</option>' + Object.keys(subs).map(function (s) { return '<option' + (f.subject === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
          var t = M.norm(f.q);
          var list = all.filter(function (q) { return (!f.type || q.type === f.type) && (!f.subject || (q.meta || {}).subject === f.subject) && (!f.review || (q.review || 'needs') === f.review) && (!t || M.norm(q.text + ' ' + (q.options || []).join(' ') + ' ' + ((q.meta || {}).tags || []).join(' ')).indexOf(t) >= 0); });
          M.qs('#pk-list', m).innerHTML = list.length ? list.map(function (q) {
            var iss = M.libIssues(q);
            return '<label class="pk-row"><input type="checkbox" data-pq="' + q.id + '"' + (picked.indexOf(q.id) >= 0 ? ' checked' : '') + '><span class="b"><span class="row" style="gap:4px">' + M.typeChip(q.type) + chip(M.REVIEW[q.review || 'needs'].cls, M.REVIEW[q.review || 'needs'].label) + (iss.some(function (x) { return x.k === 'bad'; }) ? chip('bad', iss.filter(function (x) { return x.k === 'bad'; }).map(function (x) { return x.t; }).join('، ')) : '') + '</span><span class="paper-font">' + M.richText(q.text || (q.pairs || []).map(function (p) { return p.a; }).join(' · '), 'arabic') + '</span>' +
              (q.type === 'mcq' ? '<span class="small muted">' + q.options.map(esc).join(' · ') + '</span>' : '') + '</span><button type="button" class="btn sm ghost" data-pv="' + q.id + '">' + I('eye', 14) + '</button></label>';
          }).join('') : '<div class="empty">لا توجد أسئلة مطابقة.</div>';
          M.qsa('[data-pq]', m).forEach(function (c) { c.onchange = function () { var id = c.dataset.pq; if (c.checked) { if (picked.indexOf(id) < 0) picked.push(id); } else picked = picked.filter(function (x) { return x !== id; }); upd(); }; });
          M.qsa('[data-pv]', m).forEach(function (b) { b.onclick = function (ev) { ev.preventDefault(); previewDialog(M.byId('questions', b.dataset.pv)); }; });
        };
        var upd = function () { var b = M.qs('[data-ok]', m); b.disabled = !picked.length; b.textContent = picked.length ? 'إضافة ' + n(picked.length) + ' سؤال' : 'إضافة'; };
        M.qsa('#pk-lib button', m).forEach(function (b) { b.onclick = function () { lib = b.dataset.v; M.qsa('#pk-lib button', m).forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }; });
        M.qsa('#pk-where button', m).forEach(function (b) { b.onclick = function () { where = b.dataset.v; M.qsa('#pk-where button', m).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
        M.qs('#pk-q', m).oninput = M.debounce(function () { f.q = M.qs('#pk-q', m).value; draw(); }, 250);
        M.qs('#pk-type', m).onchange = function () { f.type = this.value; draw(); };
        M.qs('#pk-sub', m).onchange = function () { f.subject = this.value; draw(); };
        M.qs('#pk-rv', m).onchange = function () { f.review = this.value; draw(); };
        draw();
        M.qs('[data-ok]', m).onclick = function () {
          var qs = picked.map(function (id) { return M.byId('questions', id); }).filter(Boolean);
          var warn = qs.filter(function (q) { return (q.review || 'needs') === 'needs' || M.libIssues(q).some(function (x) { return x.k === 'bad'; }); }).length;
          close(); onInsert(qs, where);
          if (warn) M.toast(n(warn) + ' سؤال غير مراجع أو به ملاحظات — يظهر عليه تنبيه في «المراجعة» ويمنع اعتماد الامتحان حتى يُعالج', 'bad');
        };
      } });
  };
})(window.M);
