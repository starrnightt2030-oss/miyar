/* محرك ورقة الامتحان: التنسيق + تقسيم الصفحات + المفتاح + جدول المواصفات */
(function (M) {
  'use strict';

  M.examQ = function (exam, qid) {
    if (exam.local && exam.local[qid]) return exam.local[qid]; /* سؤال مكتوب يدوياً داخل الامتحان */
    if (exam.frozen && exam.frozen[qid]) return exam.frozen[qid];
    return M.byId('questions', qid);
  };
  /* السؤال كما يظهر في هذه الورقة: إعدادات التخطيط الخاصة بالفرع (حجم الشكل وموضعه…) فوق بيانات السؤال */
  M.LAY_KEYS = ['figureWidth', 'figurePos', 'figureAlign', 'figureCaption', 'lines', 'drawHeight'];
  M.itemQ = function (exam, it) {
    var q = M.examQ(exam, it.qid); if (!q || !it.lay) return q;
    var o = Object.assign({}, q);
    M.LAY_KEYS.forEach(function (k) { if (it.lay[k] != null && it.lay[k] !== '') o[k] = it.lay[k]; });
    return o;
  };
  /* الأسئلة الرئيسية وأجزاؤها (أ، ب، ج): القسم الذي عليه part=true جزء من السؤال الرئيسي السابق */
  M.secInfo = function (exam) {
    var info = [], groups = [];
    exam.sections.forEach(function (s, i) {
      if (!(s.part && i > 0)) groups.push({ start: i, secs: [] });
      groups[groups.length - 1].secs.push(i);
      info.push({ main: groups.length - 1 });
    });
    info.forEach(function (o, i) { var g = groups[o.main]; o.hasParts = g.secs.length > 1; o.part = o.hasParts ? g.secs.indexOf(i) : -1; o.first = g.secs[0] === i; });
    return { info: info, groups: groups };
  };
  M.examSubject = function (exam) { var s = M.byId('subjects', exam.subjectId); return s ? s.name : (exam.subjectName || ''); };
  M.groupGrade = function (exam, g) { return g.secs.reduce(function (t, i) { return t + M.sectionGrade(exam, exam.sections[i]); }, 0); };
  M.partLabel = function (exam, k) { return exam.lang === 'en' ? 'abcdefgh'.charAt(k) : M.AR_LETTERS[k]; };
  M.itemGrade = function (exam, it) {
    if (it.grade != null && it.grade !== '') return Number(it.grade);
    var q = M.examQ(exam, it.qid); return q ? Number(q.grade) || 0 : 0;
  };
  M.sectionGrade = function (exam, sec) {
    return sec.items.reduce(function (s, it) { return s + M.itemGrade(exam, it); }, 0);
  };
  M.examTotal = function (exam) {
    return exam.sections.reduce(function (s, sec) { return s + M.sectionGrade(exam, sec); }, 0);
  };

  function ctx(exam) {
    var en = exam.lang === 'en';
    var mode = exam.digits || 'arabic';
    var T = function (s) { return M.digits(M.esc(s), mode); };
    return {
      exam: exam, en: en, mode: mode, T: T, si: M.secInfo(exam),
      L: en ? M.EN_LETTERS : M.AR_LETTERS,
      num: function (n) { return M.digits(String(n), mode); },
      rich: function (s) {
        /* سطر جديد + الفراغات [[...]] */
        return M.richText(s, mode);
      }
    };
  }

  function seedFor(exam, extra) { return (exam.shuffleSeed || exam.id) + ':' + extra; }

  /* ===== الترويسة ===== */
  function headerHTML(c, pageNoPh) {
    var e = c.exam, S = M.S, cen = S.settings.center || {};
    var doc = e.docId ? M.byId('docs', e.docId) : M.docFor('exam');
    var subject = M.byId('subjects', e.subjectId);
    var logo = cen.logo ? '<div class="p-logo has"><img src="' + cen.logo + '" alt="شعار المركز"></div>' : '<div class="p-logo">شعار<br>المركز</div>';
    var docRows = doc
      ? '<span class="k">اسم الوثيقة</span><span>' + M.esc(doc.name) + '</span>' +
        '<span class="k">كود الوثيقة</span><span><span class="p-code">' + M.esc(doc.code) + '</span></span>' +
        '<span class="k">رقم الإصدار</span><span>' + c.num(doc.version) + '</span>' +
        '<span class="k">تاريخ الإصدار</span><span>' + c.num(M.fmtDate(doc.issueDate)) + '</span>' +
        '<span class="k">الصفحة</span><span>' + pageNoPh + '</span>'
      : '<span class="k">اسم الوثيقة</span><span>—</span><span class="k">كود الوثيقة</span><span>—</span><span class="k">رقم الإصدار</span><span>—</span><span class="k">الصفحة</span><span>' + pageNoPh + '</span>';
    return '<div class="pblock p-head">' +
      '<div class="c1">' + logo + '<div><b>' + (c.T(cen.name) || '[اسم مركز التدريب]') + '</b>' +
      (cen.directorate ? '<span>' + c.T(cen.directorate) + '</span>' : '') + (cen.address ? '<span>' + c.T(cen.address) + '</span>' : '') + '</div></div>' +
      '<div class="c2"><span class="t1">' + c.T(e.title || 'امتحان') + (e.model ? ' — نموذج (' + c.T(e.model) + ')' : '') + '</span>' +
      '<span class="t2">مادة ' + c.T(M.examSubject(e)) + '</span>' +
      '<span class="t3">العام الدراسي ' + c.T(e.year || M.S.settings.year) + '</span></div>' +
      '<div class="p-doc">' + docRows + '</div></div>';
  }

  function infoHTML(c, pagesPh) {
    var e = c.exam;
    return '<div class="pblock p-info"><span>الدرجة الكلية: <strong>' + c.T(M.gradeWord(e.totalGrade || M.examTotal(e))) + '</strong></span>' +
      '<span>عدد الأسئلة: <strong>' + c.num(c.si.groups.length) + '</strong></span>' +
      '<span>عدد الصفحات: <strong>' + pagesPh + '</strong></span></div>';
  }

  /* بيانات الطالب والورقة: الاسم · رقم الجلوس · الصف · التخصص · المادة · الزمن · التاريخ */
  function studentHTML(c) {
    var e = c.exam, subject = M.byId('subjects', e.subjectId);
    var val = function (v) { return v ? '<b>' + c.T(v) + '</b>' : '<i class="s"></i>'; };
    var date = e.examDate ? M.fmtDate(e.examDate) : '';
    var digits = ''; for (var i = 0; i < (Number(e.seatDigits) || 5); i++) digits += '<span class="p-digit"></span>';
    return '<div class="pblock p-data">' +
      (e.showStudent !== false ? '<div class="r1"><span class="f nm"><span class="k">اسم الطالب</span><i></i></span><span class="f"><span class="k">رقم الجلوس</span>' + digits + '</span></div>' : '') +
      '<div class="r2">' +
      '<span class="f"><span class="k">الصف الدراسي</span>' + val(e.className) + '</span>' +
      '<span class="f"><span class="k">التخصص</span>' + val(e.specialization) + '</span>' +
      '<span class="f"><span class="k">المادة</span>' + val(M.examSubject(e)) + '</span>' +
      '<span class="f"><span class="k">الزمن</span>' + val(e.duration) + '</span>' +
      '<span class="f"><span class="k">التاريخ</span>' + (date ? '<b>' + c.num(date) + '</b>' : '<i class="s"></i>') + '</span>' +
      '</div></div>';
  }

  function gradesHTML(c) {
    var e = c.exam, G = c.si.groups, n = G.length;
    var h = '<div class="pblock p-grades" style="grid-template-columns:92px repeat(' + (n + 1) + ',minmax(0,1fr))">';
    h += '<span class="lead">السؤال</span>';
    G.forEach(function (g, i) { h += '<span class="hd">' + M.ordinal(i) + '</span>'; });
    h += '<span class="hd tot">المجموع</span><span class="bold">الدرجة</span>';
    G.forEach(function (g) { h += '<span>' + c.num(M.groupGrade(e, g)) + '</span>'; });
    h += '<span class="tot">' + c.num(M.examTotal(e)) + '</span><span class="bold">درجة الطالب</span>';
    for (var i = 0; i <= n; i++) h += '<span></span>';
    return h + '</div>';
  }

  /* ===== الأقسام ===== */
  function gradeTxt(c, g) { return c.en ? '(' + c.num(g) + ' marks)' : '(' + c.T(M.gradeWord(g)) + ')'; }
  function secHeadHTML(c, sec, idx, cont) {
    var g = M.sectionGrade(c.exam, sec), inf = c.si.info[idx], no = inf.main + 1;
    var title = sec.title || (M.TYPE[sec.type] || {}).title || '';
    if (!inf.hasParts) {
      if (c.en) return '<div class="p-sec-h"><span class="n">Q' + c.num(no) + '</span><span class="t">' + c.T(title) + (cont ? ' (continued)' : '') + '</span><span class="g">' + gradeTxt(c, g) + '</span></div>';
      return '<div class="p-sec-h"><span class="n">' + c.num(no) + '</span><span class="t">' + (cont ? 'تابع: ' : '') + c.T(title) + '</span><span class="g">' + gradeTxt(c, g) + '</span></div>';
    }
    var grp = c.si.groups[inf.main], first = c.exam.sections[grp.start];
    var main = inf.first && !cont ? '<div class="p-sec-h"><span class="n">' + (c.en ? 'Q' : '') + c.num(no) + '</span><span class="t">' + c.T(first.mainTitle || (c.en ? 'Answer the following:' : 'أجب عن الأسئلة الآتية:')) + '</span><span class="g">' + gradeTxt(c, M.groupGrade(c.exam, grp)) + '</span></div>' : '';
    return main + '<div class="p-part-h"><span class="pl">(' + M.partLabel(c.exam, inf.part) + ')</span><span class="t">' + (cont ? (c.en ? '(continued) ' : 'تابع: ') : '') + c.T(title) + '</span><span class="g">' + gradeTxt(c, g) + '</span></div>';
  }

  function optCols(opts) {
    var m = 0; opts.forEach(function (o) { m = Math.max(m, String(o).length); });
    return m <= 10 ? 'c4' : (m <= 26 ? 'c2' : 'c1');
  }

  /* خيارات الاختيار من متعدد بعد الخلط في النماذج */
  M.mcqOrder = function (exam, sec, q) {
    var idx = q.options.map(function (_, i) { return i; }).filter(function (i) { return String(q.options[i]).trim(); });
    if (exam.shuffleOptions) idx = M.shuffle(idx, M.rng(seedFor(exam, sec.id + q.id)));
    return idx;
  };

  M.matchLayout = function (exam, sec) {
    var A = [], B = [];
    sec.items.forEach(function (it) {
      var q = M.examQ(exam, it.qid); if (!q) return;
      q.pairs.forEach(function (p) { if (String(p.a).trim()) { A.push(p); B.push({ text: p.b, pair: p }); } });
      (q.extras || []).forEach(function (x) { if (String(x).trim()) B.push({ text: x, pair: null }); });
    });
    B = M.shuffle(B, M.rng(seedFor(exam, 'match' + sec.id)));
    return { A: A, B: B };
  };

  M.wordBank = function (exam, sec) {
    var words = [];
    sec.items.forEach(function (it) {
      var q = M.examQ(exam, it.qid); if (!q) return;
      (String(q.text).match(/\[\[(.+?)\]\]/g) || []).forEach(function (m) { words.push(m.slice(2, -2)); });
      (q.extras || []).forEach(function (x) { if (String(x).trim()) words.push(x); });
    });
    return M.shuffle(words, M.rng(seedFor(exam, 'bank' + sec.id)));
  };

  function figBox(q, w) {
    return '<div class="fw" style="width:' + w + '%"><img src="' + q.figure + '" alt="">' + (q.figureCaption ? '<div class="cap">' + M.esc(q.figureCaption) + '</div>' : '') + '</div>';
  }
  function fig(q) {
    if (!q.figure) return '';
    return '<div class="p-fig a-' + (q.figureAlign || 'center') + '">' + figBox(q, Number(q.figureWidth) || 60) + '</div>';
  }
  M._fig = fig;
  /* موضع الشكل: تحت السؤال (افتراضي) · فوقه · بجانبه يساراً أو يميناً · بعد مساحة الإجابة */
  function place(q, st, rest) {
    if (!q.figure) return st + rest;
    var pos = q.figurePos || 'below';
    if (pos === 'above') return fig(q) + st + rest;
    if (pos === 'after') return st + rest + fig(q);
    if (pos === 'side' || pos === 'side-start') {
      var w = Math.min(55, Number(q.figureWidth) || 40);
      return '<div class="p-fside' + (pos === 'side-start' ? ' st' : '') + '"><div class="tx">' + st + rest + '</div><div class="fx" style="width:' + w + '%">' + figBox(q, 100) + '</div></div>';
    }
    return st + fig(q) + rest;
  }
  M._place = place;

  function itemNo(c, n) { return '<span class="no">' + (c.en ? c.num(n) + '.' : c.num(n) + ')') + '</span>'; }

  function itemsHTML(c, sec, from, to) {
    var e = c.exam, h = '';
    var its = sec.items.slice(from, to);
    if (sec.type === 'tf') {
      h += '<div class="p-tf">';
      its.forEach(function (it, k) {
        var q = M.itemQ(e, it); if (!q) return;
        h += '<span>' + c.num(from + k + 1) + '</span><span>' + place(q, c.rich(q.text), '') + '</span><span>(&nbsp;&nbsp;&nbsp;&nbsp;)</span>';
      });
      return h + '</div>';
    }
    if (sec.type === 'match') {
      var ml = M.matchLayout(e, sec);
      var rows = Math.max(ml.A.length, ml.B.length);
      h += '<div class="p-match"><span class="hd">' + (c.en ? 'Column (A)' : 'العمود (أ)') + '</span><span></span><span class="hd">' + (c.en ? 'Column (B)' : 'العمود (ب)') + '</span>';
      for (var r = 0; r < rows; r++) {
        var a = ml.A[r], b = ml.B[r];
        h += a ? '<span class="a"><span>' + c.num(r + 1) + ') ' + c.rich(a.a) + '</span><span>●</span></span>' : '<span></span>';
        h += '<span></span>';
        h += b ? '<span class="b">● (' + c.L[r] + ') ' + c.rich(b.text) + '</span>' : '<span></span>';
      }
      return h + '</div>';
    }
    if (sec.type === 'mcq') {
      h += '<div class="p-mcq' + (sec.layout === 'two' ? ' two' : '') + '">';
      its.forEach(function (it, k) {
        var q = M.itemQ(e, it); if (!q) return;
        var order = M.mcqOrder(e, sec, q);
        var opts = order.map(function (i) { return q.options[i]; });
        var oh = '<div class="p-opts ' + (sec.layout === 'two' || q.figurePos === 'side' || q.figurePos === 'side-start' ? (optCols(opts) === 'c1' ? 'c1' : 'c2') : optCols(opts)) + '">';
        opts.forEach(function (o, j) { oh += '<span><i class="ring"></i>' + c.L[j] + ') ' + c.rich(o) + '</span>'; });
        h += '<div class="p-item">' + place(q, '<div class="st">' + (sec.items.length === 1 ? '' : itemNo(c, from + k + 1)) + '<span>' + c.rich(q.text) + '</span></div>', oh + '</div>') + '</div>';
      });
      return h + '</div>';
    }
    var first = from === 0 && sec.type === 'complete' && sec.wordBank !== false;
    if (first) {
      var wb = M.wordBank(e, sec);
      if (wb.length) h += '<div class="p-bank">' + wb.map(function (w) { return '<span>' + c.rich(w) + '</span>'; }).join('') + '</div>';
    }
    its.forEach(function (it, k) {
      var q = M.itemQ(e, it); if (!q) return;
      var no = sec.items.length === 1 ? '' : itemNo(c, from + k + 1);
      if (sec.type === 'complete') {
        h += '<div class="p-item">' + place(q, '<div class="st">' + no + '<span>' + c.rich(q.text) + '</span></div>', '') + '</div>';
      } else if (sec.type === 'term') {
        h += '<div class="p-item">' + place(q, '<div class="st p-term">' + no + '<span>' + c.rich(q.text) + '</span><span class="tb">(…………………………)</span></div>', '') + '</div>';
      } else if (sec.type === 'image') {
        h += '<div class="p-item"><div class="st">' + no + '<span>' + c.rich(q.text) + '</span></div><div class="p-img">' +
          (q.image ? '<img src="' + q.image + '" alt="">' : '') + '<div class="lbls">' +
          q.labels.map(function (l) { return '<span>' + c.T(l.n) + '</span><span>…………………………</span>'; }).join('') + '</div></div></div>';
      } else if (sec.type === 'draw') {
        h += '<div class="p-item">' + place(q, '<div class="st">' + no + '<span>' + c.rich(q.text) + '</span></div>',
          '<div class="p-draw' + (q.drawGrid !== false ? ' grid' : '') + '" style="height:' + (Number(q.drawHeight) || 140) + 'px"></div>') + '</div>';
      } else {
        var lines = Math.max(0, Number(q.lines) || 0), li = '';
        for (var i = 0; i < lines; i++) li += '<i></i>';
        var pre = sec.type === 'reason' && !/^\s*علل/.test(q.text) && !c.en ? '' : '';
        h += '<div class="p-item">' + place(q, '<div class="st">' + no + '<span>' + pre + c.rich(q.text) + '</span></div>', lines ? '<div class="p-lines">' + li + '</div>' : '') + '</div>';
      }
    });
    return h;
  }

  function sectionHTML(c, sec, idx, from, to, cont) {
    var head = (from === 0 || cont) ? secHeadHTML(c, sec, idx, cont && from > 0) : '';
    return '<div class="pblock p-sec" data-sec="' + idx + '">' + head + itemsHTML(c, sec, from, to) + '</div>';
  }

  function footHTML(c) {
    var e = c.exam;
    var doc = e.docId ? M.byId('docs', e.docId) : M.docFor('exam');
    var note = e.footerNote != null ? e.footerNote : (c.en ? 'Best wishes for success' : 'مع أطيب التمنيات بالنجاح والتوفيق');
    return '<div class="p-foot"><span class="wish">' + c.T(note) + '</span>' +
      '<span>' + (doc ? '<span class="p-code">' + M.esc(doc.code) + '</span> · الإصدار ' + c.num(doc.version) + ' · ' : '') + 'صفحة <b data-pn></b> من <b data-pt></b></span></div>';
  }

  function miniHeadHTML(c) {
    var e = c.exam, subject = M.byId('subjects', e.subjectId);
    return '<div class="pblock p-mini"><span>' + c.T(e.title || '') + ' — مادة ' + c.T(M.examSubject(e)) + (e.model ? ' — نموذج (' + c.T(e.model) + ')' : '') + '</span><span>تابع الأسئلة</span></div>';
  }

  function pageShell(c) {
    var e = c.exam;
    var cls = 'page' + (c.en ? ' ltr' : '') + (e.compact && !e.largePrint ? ' compact' : '') + (e.largePrint ? ' large' : '') + (e.separator === 'dashed' ? ' sep-dashed' : '') + ' th-' + (e.theme || 'classic');
    var style = '--pc:' + (e.color || '#1F2A44') + ';' + (e.compact || e.largePrint ? '' : '--pfs:' + (Number(e.fontSize) || 14) + 'px;') +
      (e.font ? '--pfont:' + e.font + ';' : '');
    var el = document.createElement('div');
    el.className = cls; el.setAttribute('style', style);
    el.innerHTML = '<div class="pg-body"></div><div class="p-cont"></div>' + footHTML(c);
    return el;
  }

  function measureRoot() {
    var m = document.getElementById('measure');
    if (!m) { m = document.createElement('div'); m.id = 'measure'; document.body.appendChild(m); }
    return m;
  }

  function overflow(body) { return body.scrollHeight > body.clientHeight + 1; }

  /* يُرجع مصفوفة HTML للصفحات */
  M.renderExamPages = function (exam) {
    var c = ctx(exam);
    var root = measureRoot();
    root.innerHTML = '';
    var pages = [];
    var page, body;
    function newPage() {
      page = pageShell(c); root.appendChild(page); pages.push(page);
      body = page.querySelector('.pg-body');
      if (pages.length > 1) body.insertAdjacentHTML('beforeend', miniHeadHTML(c));
    }
    function addHTML(html) {
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      var el = tmp.firstElementChild; body.appendChild(el); return el;
    }
    newPage();
    addHTML(headerHTML(c, '<b data-pn></b>&nbsp;من&nbsp;<b data-pt></b>'));
    addHTML(infoHTML(c, '<b data-pt></b>'));
    addHTML(studentHTML(c));
    if (exam.showGradeTable !== false && exam.sections.length) addHTML(gradesHTML(c));
    if (exam.showInstructions !== false && exam.instructions) addHTML('<div class="pblock p-instr">' + c.T(exam.instructions) + '</div>');

    exam.sections.forEach(function (sec, idx) {
      var n = sec.items.length;
      if (!n) { var el0 = addHTML(sectionHTML(c, sec, idx, 0, 0, false)); if (overflow(body)) { el0.remove(); newPage(); addHTML(sectionHTML(c, sec, idx, 0, 0, false)); } return; }
      var from = 0;
      while (from < n) {
        var cont = from > 0;
        /* جرّب القسم كاملاً أولاً */
        var el = addHTML(sectionHTML(c, sec, idx, from, n, cont));
        if (!overflow(body)) { from = n; break; }
        el.remove();
        /* التوصيل لا يُقسم */
        var splittable = sec.type !== 'match';
        var best = 0;
        if (splittable) {
          for (var k = from + 1; k <= n; k++) {
            var t = addHTML(sectionHTML(c, sec, idx, from, k, cont));
            var of = overflow(body); t.remove();
            if (of) break; best = k;
          }
        }
        var onlyHead = body.children.length <= (pages.length > 1 ? 1 : 0);
        if (best > from) {
          addHTML(sectionHTML(c, sec, idx, from, best, cont));
          from = best;
          newPage();
        } else if (onlyHead) {
          /* عنصر واحد أطول من صفحة كاملة: يوضع كما هو */
          addHTML(sectionHTML(c, sec, idx, from, from + 1, cont));
          from += 1;
          if (from < n) newPage();
        } else {
          newPage();
        }
      }
    });

    var total = pages.length;
    var signHTML = exam.showSign !== false ? '<div class="p-sign"><span>توقيع المصحح</span><span>توقيع المراجع</span><span>رئيس اللجنة</span></div>' : '';
    pages.forEach(function (p, i) {
      M.qsa('[data-pn]', p).forEach(function (x) { x.textContent = c.num(i + 1); });
      M.qsa('[data-pt]', p).forEach(function (x) { x.textContent = c.num(total); });
      var contEl = p.querySelector('.p-cont');
      if (i < total - 1) contEl.textContent = c.en ? 'Please turn over →' : 'تابع الأسئلة في الصفحة التالية ←';
      else {
        contEl.innerHTML = '<div class="p-end">' + (c.en ? 'End of questions' : 'انتهت الأسئلة') + '</div>' + signHTML;
        var b = p.querySelector('.pg-body');
        if (overflow(b)) contEl.innerHTML = '<div class="p-end">' + (c.en ? 'End of questions' : 'انتهت الأسئلة') + '</div>';
      }
    });
    var out = pages.map(function (p) { return p.outerHTML; });
    root.innerHTML = '';
    exam._pageCount = total;
    return out;
  };

  /* ===== مفتاح الإجابة ===== */
  M.renderKeyPages = function (exam) {
    var c = ctx(exam);
    var h = '<div class="pblock p-mini"><span>مفتاح ونموذج الإجابة — ' + c.T(exam.title || '') + (exam.model ? ' — نموذج (' + c.T(exam.model) + ')' : '') + '</span><span>الدرجة الكلية ' + c.num(M.examTotal(exam)) + '</span></div>';
    exam.sections.forEach(function (sec, idx) {
      var inf = c.si.info[idx];
      h += '<div class="pblock k-sec"><h4>السؤال ' + M.ordinal(inf.main) + (inf.hasParts ? ' (' + M.partLabel(exam, inf.part) + ')' : '') + ': ' + c.T(sec.title || M.TYPE[sec.type].title) + ' (' + c.T(M.gradeWord(M.sectionGrade(exam, sec))) + ')</h4>';
      if (sec.type === 'match') {
        var ml = M.matchLayout(exam, sec);
        ml.A.forEach(function (p, i) {
          var j = ml.B.findIndex(function (b) { return b.pair === p; });
          h += '<div class="k-row"><span>' + c.num(i + 1) + ') ' + c.rich(p.a) + '</span><span>←</span><b>(' + c.L[j] + ') ' + c.rich(p.b) + '</b></div>';
        });
      } else {
        sec.items.forEach(function (it, i) {
          var q = M.examQ(exam, it.qid); if (!q) return;
          var ans;
          if (q.type === 'mcq') {
            var order = M.mcqOrder(exam, sec, q);
            var pos = order.indexOf(Number(q.correct));
            ans = c.L[pos] + ') ' + c.rich(q.options[q.correct]);
          } else ans = M.richText(M.answerText(q), c.mode, { answers: true });
          h += '<div class="k-row"><span>' + c.num(i + 1) + ')</span><span>' + ans + '</span><span class="g">' + c.T(M.gradeWord(M.itemGrade(exam, it))) + '</span></div>';
        });
      }
      h += '</div>';
    });
    return simplePages(c, h);
  };

  /* ===== جدول المواصفات ===== */
  M.specData = function (exam) {
    var lessonIds = (exam.scopeLessonIds && exam.scopeLessonIds.length) ? exam.scopeLessonIds.slice() : [];
    exam.sections.forEach(function (s) { s.items.forEach(function (it) { var q = M.examQ(exam, it.qid); if (q && lessonIds.indexOf(q.lessonId) < 0) lessonIds.push(q.lessonId); }); });
    var rows = lessonIds.map(function (id) {
      var l = M.byId('lessons', id) || { id: id, name: id ? '—' : 'أسئلة مكتوبة يدوياً', periods: 1 };
      return { lesson: l, cnt: [0, 0, 0, 0], grd: [0, 0, 0, 0] };
    });
    var totalPeriods = rows.reduce(function (s, r) { return s + (Number(r.lesson.periods) || 1); }, 0) || 1;
    exam.sections.forEach(function (s) {
      s.items.forEach(function (it) {
        var q = M.examQ(exam, it.qid); if (!q) return;
        var r = rows.find(function (x) { return x.lesson.id === q.lessonId; }); if (!r) return;
        var lv = Math.min(3, Math.max(0, Number(q.level) || 0));
        r.cnt[lv] += 1; r.grd[lv] += M.itemGrade(exam, it);
      });
    });
    var total = M.examTotal(exam) || 1;
    rows.forEach(function (r) {
      r.weight = (Number(r.lesson.periods) || 1) / totalPeriods;
      r.targetGrade = r.weight * total;
      r.actual = r.grd.reduce(function (a, b) { return a + b; }, 0);
    });
    var lv = [0, 1, 2, 3].map(function (i) { return rows.reduce(function (s, r) { return s + r.grd[i]; }, 0); });
    return { rows: rows, levelGrades: lv, total: total, targets: M.S.settings.levelTargets || [30, 40, 20, 10] };
  };

  M.renderSpecPages = function (exam) {
    var c = ctx(exam), d = M.specData(exam);
    var pct = function (x) { return c.num(Math.round(x * 100)) + '٪'; };
    var h = '<div class="pblock p-mini"><span>جدول المواصفات — ' + c.T(exam.title || '') + '</span><span>الدرجة الكلية ' + c.num(d.total) + '</span></div>';
    h += '<table class="spec pblock"><thead><tr><th rowspan="2">الدرس</th><th rowspan="2">الوزن النسبي</th><th rowspan="2">الدرجة المستهدفة</th>';
    M.LEVELS.forEach(function (l) { h += '<th colspan="2">' + l + '</th>'; });
    h += '<th rowspan="2">الدرجة الفعلية</th></tr><tr>';
    M.LEVELS.forEach(function () { h += '<th>فروع</th><th>درجة</th>'; });
    h += '</tr></thead><tbody>';
    d.rows.forEach(function (r) {
      h += '<tr><td class="l">' + c.T(r.lesson.name) + '</td><td>' + pct(r.weight) + '</td><td>' + c.num(Math.round(r.targetGrade * 10) / 10) + '</td>';
      for (var i = 0; i < 4; i++) h += '<td>' + c.num(r.cnt[i]) + '</td><td>' + c.num(r.grd[i]) + '</td>';
      h += '<td><b>' + c.num(r.actual) + '</b></td></tr>';
    });
    h += '<tr><th>المجموع</th><th>' + c.num(100) + '٪</th><th>' + c.num(d.total) + '</th>';
    for (var i = 0; i < 4; i++) h += '<th colspan="2">' + c.num(d.levelGrades[i]) + ' (' + pct(d.levelGrades[i] / d.total) + ' من ' + c.num(d.targets[i]) + '٪)</th>';
    h += '<th>' + c.num(M.examTotal(exam)) + '</th></tr></tbody></table>';
    return simplePages(c, h);
  };

  function simplePages(c, innerHTML) {
    var root = measureRoot(); root.innerHTML = '';
    var tmp = document.createElement('div'); tmp.innerHTML = innerHTML;
    var blocks = Array.prototype.slice.call(tmp.children);
    var pages = [], body;
    function np() { var p = pageShell(c); p.querySelector('.p-cont').remove(); root.appendChild(p); pages.push(p); body = p.querySelector('.pg-body'); if (pages.length === 1) body.insertAdjacentHTML('beforeend', headerHTML(c, '<b data-pn></b>&nbsp;من&nbsp;<b data-pt></b>')); }
    np();
    blocks.forEach(function (b) {
      body.appendChild(b);
      if (overflow(body) && body.children.length > 1) { b.remove(); np(); body.appendChild(b); }
    });
    pages.forEach(function (p, i) {
      M.qsa('[data-pn]', p).forEach(function (x) { x.textContent = c.num(i + 1); });
      M.qsa('[data-pt]', p).forEach(function (x) { x.textContent = c.num(pages.length); });
    });
    var out = pages.map(function (p) { return p.outerHTML; }); root.innerHTML = ''; return out;
  }

  /* معاينة سؤال واحد داخل محرر السؤال */
  M.renderQuestionPreview = function (q, digits) {
    var exam = { id: 'pv', sections: [{ id: 's', type: q.type, title: (M.TYPE[q.type] || {}).title, items: [{ qid: q.id }] }], digits: digits || 'arabic', frozen: {} };
    exam.frozen[q.id] = q;
    var c = ctx(exam);
    return '<div class="page" style="width:auto;height:auto;min-height:0;padding:22px 26px;box-shadow:none;margin:0">' + sectionHTML(c, exam.sections[0], 0, 0, 1, false) + '</div>';
  };

  /* ===== A3: كتيّب يُطوى أو صفحتان متجاورتان ===== */
  M.PAPERS = { a4: 'A4 عمودي', 'a3-booklet': 'A3 كتيّب يُطوى (٤ صفحات لكل ورقة)', 'a3-spread': 'A3 صفحتان متجاورتان' };
  function blankPage(exam) {
    return '<div class="page th-' + (exam.theme || 'classic') + '"><div class="p-blank">صفحة للمسودة — لا تُصحَّح</div></div>';
  }
  M.toSheets = function (exam, pages) {
    var mode = exam.paper || 'a4';
    if (mode === 'a4') return { size: 'a4', items: pages };
    var rtl = exam.lang !== 'en', P = pages.slice(), sheets = [], i, nP;
    var sheet = function (left, right, label) {
      return '<div class="sheet"><div class="sheet-lbl">' + label + '</div><div class="sheet-in">' + (left || blankPage(exam)) + (right || blankPage(exam)) + '</div></div>';
    };
    if (mode === 'a3-booklet') {
      while (P.length % 4) P.push(blankPage(exam));
      nP = P.length;
      for (i = 0; i < nP / 4; i++) {
        var a = P[2 * i], b = P[nP - 2 * i - 1], c2 = P[2 * i + 1], d = P[nP - 2 * i - 2];
        var no = M.toArabic(i + 1);
        sheets.push(rtl ? sheet(a, b, 'الورقة ' + no + ' — الوجه') : sheet(b, a, 'Sheet ' + (i + 1) + ' — front'));
        sheets.push(rtl ? sheet(d, c2, 'الورقة ' + no + ' — الظهر') : sheet(c2, d, 'Sheet ' + (i + 1) + ' — back'));
      }
    } else {
      if (P.length % 2) P.push(blankPage(exam));
      for (i = 0; i < P.length; i += 2) sheets.push(rtl ? sheet(P[i + 1], P[i], 'صفحتا ' + M.toArabic(i + 1) + ' و' + M.toArabic(i + 2)) : sheet(P[i], P[i + 1], 'Pages ' + (i + 1) + '–' + (i + 2)));
    }
    return { size: 'a3', items: sheets };
  };
  M.examSheets = function (exam) { return M.toSheets(exam, M.renderExamPages(exam)); };

  /* طباعة: يضع الصفحات في منطقة الطباعة ثم يفتح نافذة الطباعة */
  M.printPages = function (pages, title, size) {
    var area = document.getElementById('printArea');
    var st = document.getElementById('pageSizeStyle');
    if (!st) { st = document.createElement('style'); st.id = 'pageSizeStyle'; document.head.appendChild(st); }
    st.textContent = size === 'a3' ? '@media print{@page{size:A3 landscape;margin:0}}' : '@media print{@page{size:A4 portrait;margin:0}}';
    area.innerHTML = pages.join('');
    var old = document.title; if (title) document.title = title;
    var imgs = M.qsa('img', area).filter(function (i) { return !i.complete; });
    Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.onload = i.onerror = r; }); })).then(function () {
      setTimeout(function () { window.print(); document.title = old; }, 60);
    });
  };
})(window.M);
