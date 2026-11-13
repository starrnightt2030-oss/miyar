/* نواة مكتبات الأسئلة: نموذج السؤال المحفوظ + التحقق من ردود الذكاء الاصطناعي + حالة الإجابة + كشف التكرار
   المكتبتان (المستخرجة والمولّدة) في نفس مخزن questions ويميّزهما الحقل lib — مع كل الحقول القديمة كما هي */
(function (M) {
  'use strict';
  var S = M.S;
  M.LIB_TYPES = ['mcq', 'tf', 'complete', 'match', 'term', 'reason', 'essay', 'draw', 'problem'];
  M.LIBS = { extracted: { name: 'مكتبة الأسئلة المستخرجة', short: 'المستخرجة', route: 'library' }, generated: { name: 'مكتبة الأسئلة المولدة بالذكاء الاصطناعي', short: 'المولدة', route: 'library-ai' } };
  M.REVIEW = { needs: { label: 'يحتاج مراجعة', cls: 'warn' }, reviewed: { label: 'تمت مراجعته', cls: 'info' }, approved: { label: 'معتمد', cls: 'ok' } };
  M.ANS = { source: { label: 'الإجابة من المصدر', cls: 'ok' }, teacher: { label: 'إجابة أكدها المدرس', cls: 'ok' }, ai: { label: 'إجابة مقترحة من الذكاء الاصطناعي — تحتاج تأكيد', cls: 'warn' }, none: { label: 'الإجابة غير محددة', cls: 'bad' } };
  M.UNCLEAR = '⟦؟⟧';
  M.BLANK_UNKNOWN = '؟';
  var OBJECTIVE = ['mcq', 'tf', 'complete', 'term', 'match'];

  M.libQs = function (lib) { return S.questions.filter(function (q) { return q.lib === lib && !q.deleted; }); };

  /* هل الإجابة المطلوبة موجودة فعلاً؟ (لا تُعتبر القيم الافتراضية إجابة) */
  M.hasAnswer = function (q) {
    switch (q.type) {
      case 'mcq': return q.correct != null && q.correct !== '' && Number(q.correct) >= 0 && !!String((q.options || [])[q.correct] || '').trim();
      case 'tf': return q.answer === true || q.answer === false;
      case 'complete': var b = (String(q.text || '').match(/\[\[(.+?)\]\]/g) || []); return b.length > 0 && b.every(function (m) { var v = m.slice(2, -2).trim(); return v && v !== M.BLANK_UNKNOWN && v !== '…' && v !== '……'; });
      case 'term': return !!String(q.term || '').trim();
      case 'match': return !q.matchUnknown && (q.pairs || []).filter(function (p) { return String(p.a).trim() && String(p.b).trim(); }).length >= 2;
      default: return !!String(q.modelAnswer || '').trim();
    }
  };
  M.answerRequired = function (q) { return OBJECTIVE.indexOf(q.type) >= 0; };
  M.isUnclear = function (q) {
    var txt = [q.text, q.term, q.correction, q.modelAnswer].concat(q.options || []).concat((q.pairs || []).map(function (p) { return p.a + ' ' + p.b; })).join(' ');
    return !!q.unclear || txt.indexOf(M.UNCLEAR) >= 0;
  };
  /* حالة الإجابة المعروضة */
  M.ansState = function (q) {
    if (!M.hasAnswer(q)) return 'none';
    return q.ans && M.ANS[q.ans] ? q.ans : 'teacher';
  };

  /* ملاحظات تمنع الاعتماد أو تحتاج انتباهاً (للمراجعة والامتحان) */
  M.libIssues = function (q) {
    var out = [];
    if (M.isUnclear(q)) out.push({ k: 'bad', t: 'نص غير واضح يحتاج مراجعة' });
    if (M.answerRequired(q) && !M.hasAnswer(q)) out.push({ k: 'bad', t: 'الإجابة غير محددة' });
    else if (q.ans === 'ai') out.push({ k: 'warn', t: 'إجابة مقترحة من الذكاء الاصطناعي لم تُؤكَّد' });
    if (q.suggest && q.suggest.text) out.push({ k: 'warn', t: 'يوجد تصحيح لغوي مقترح لم يُقبل أو يُرفض' });
    if (q.libReview === 'needs' || (q.lib && q.review === 'needs')) out.push({ k: 'warn', t: 'لم تتم مراجعته في المكتبة' });
    return out;
  };

  /* ===== التحقق من رد الاستخراج (مخطط صارم + تصحيح الفهارس) ===== */
  function str(x, max) { return typeof x === 'string' ? x.slice(0, max || 4000) : (x == null ? '' : String(x).slice(0, max || 4000)); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function int(x, d) { var v = Number(x); return isFinite(v) ? Math.round(v) : d; }
  M.validateExtract = function (data, nImages) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('رد الذكاء الاصطناعي ليس كائناً صالحاً');
    if (!Array.isArray(data.items)) throw new Error('رد الذكاء الاصطناعي لا يحتوي على قائمة items');
    var bad = 0;
    var items = data.items.slice(0, 120).map(function (x) {
      if (!x || typeof x !== 'object') { bad++; return null; }
      var type = M.LIB_TYPES.indexOf(x.type) >= 0 ? x.type : 'essay';
      var o = {
        num: str(x.num, 20), mainNum: str(x.mainNum, 60), groupTitle: str(x.groupTitle, 400), passage: str(x.passage, 4000),
        type: type, typeGuess: M.LIB_TYPES.indexOf(x.type) < 0, text: str(x.text, 5000),
        options: arr(x.options).slice(0, 8).map(function (s) { return str(s, 600); }),
        pairsA: arr(x.pairsA).slice(0, 20).map(function (s) { return str(s, 400); }), pairsB: arr(x.pairsB).slice(0, 24).map(function (s) { return str(s, 400); }),
        answerInSource: x.answerInSource === true, answer: str(x.answer, 2000), correctIndex: int(x.correctIndex, -1),
        tf: ['true', 'false'].indexOf(x.tf) >= 0 ? x.tf : 'unknown', correction: str(x.correction, 600),
        matchKey: arr(x.matchKey).slice(0, 20).map(function (v) { return int(v, -1); }), blanks: arr(x.blanks).slice(0, 12).map(function (s) { return str(s, 200); }),
        term: str(x.term, 300), modelAnswer: str(x.modelAnswer, 3000),
        unclear: arr(x.unclear).slice(0, 10).map(function (s) { return str(s, 200); }), suggestion: str(x.suggestion, 5000),
        grade: Math.max(0, Math.min(100, Number(x.grade) || 0)),
        pos: Math.max(0, Math.min(1000, int(x.pos, 0))), ref: str(x.ref, 40),
        contFromPrev: x.contFromPrev === true, contToNext: x.contToNext === true, figure: null
      };
      if (o.correctIndex >= o.options.length) o.correctIndex = -1;
      var f = x.figure;
      if (f && typeof f === 'object' && int(f.img, -1) >= 0 && int(f.img, -1) < nImages && arr(f.box).length === 4) {
        var b = f.box.map(function (v) { return Math.max(0, Math.min(1000, Number(v) || 0)); });
        if (b[2] - b[0] > 15 && b[3] - b[1] > 15) o.figure = { img: int(f.img, 0), box: b };
      }
      if (!o.text.trim() && !o.options.length && !o.pairsA.length) { bad++; return null; }
      return o;
    }).filter(Boolean);
    var key = arr(data.answerKey).slice(0, 300).map(function (k) { return k && typeof k === 'object' ? { num: str(k.num, 20), mainNum: str(k.mainNum, 60), answer: str(k.answer, 2000) } : null; }).filter(function (k) { return k && k.answer.trim(); });
    return { items: items, answerKey: key, dropped: bad, notes: str(data.notes, 1000) };
  };

  /* تحويل عنصر مستخرج إلى سؤال (بدون أي إجابة افتراضية) */
  var LET_AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'], LET_EN = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  function letterIndex(s, n) {
    var t = M.norm(M.toWestern(String(s || ''))).replace(/[()\s.)]/g, '');
    if (!t) return -1;
    var i = LET_AR.map(M.norm).indexOf(t); if (i >= 0 && i < n) return i;
    i = LET_EN.indexOf(t.toLowerCase()); if (i >= 0 && i < n) return i;
    if (/^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= n) return Number(t) - 1;
    return -1;
  }
  M.itemToQuestion = function (x) {
    var q = M.newQuestion(x.type, '');
    q.subjectId = ''; q.status = 'lib'; q.source = 'extracted'; q.solLines = 0;
    q.text = x.text.trim(); q.ans = 'none';
    if (x.type === 'mcq') {
      q.options = x.options.length ? x.options.slice() : ['', ''];
      q.correct = null;
      if (x.answerInSource) {
        var ci = x.correctIndex >= 0 ? x.correctIndex : letterIndex(x.answer, q.options.length);
        if (ci < 0 && x.answer) ci = q.options.map(M.norm).indexOf(M.norm(x.answer));
        if (ci >= 0) { q.correct = ci; q.ans = 'source'; }
      }
    }
    if (x.type === 'tf') { q.answer = null; if (x.answerInSource && x.tf !== 'unknown') { q.answer = x.tf === 'true'; q.ans = 'source'; } q.correction = x.answerInSource ? x.correction : ''; }
    if (x.type === 'complete') {
      if (!/\[\[/.test(q.text)) q.text = q.text.replace(/\.{3,}|…+|_{3,}/g, '[[' + M.BLANK_UNKNOWN + ']]');
      if (x.answerInSource && x.blanks.length) { var bi = 0; q.text = q.text.replace(/\[\[(.*?)\]\]/g, function (m, v) { var a = x.blanks[bi++]; return '[[' + (a && a.trim() ? a.trim() : v) + ']]'; }); }
      q.ans = M.hasAnswer(q) ? 'source' : 'none';
    }
    if (x.type === 'term') { q.term = x.answerInSource ? (x.term || x.answer) : ''; q.ans = q.term ? 'source' : 'none'; }
    if (x.type === 'match') {
      var A = x.pairsA, B = x.pairsB, used = {};
      var known = x.answerInSource && x.matchKey.length === A.length && x.matchKey.every(function (v) { return v >= 0 && v < B.length; });
      q.pairs = A.map(function (a, i) { var j = known ? x.matchKey[i] : i; used[j] = 1; return { a: a, b: B[j] || '' }; });
      q.extras = B.filter(function (b, j) { return !used[j]; });
      q.matchUnknown = !known; q.ans = known ? 'source' : 'none';
      q.srcB = B.slice();
    }
    if (['reason', 'essay', 'problem', 'draw'].indexOf(x.type) >= 0) { q.modelAnswer = x.answerInSource ? (x.modelAnswer || x.answer) : ''; q.ans = q.modelAnswer ? 'source' : 'none'; q.lines = q.type === 'essay' ? 4 : q.type === 'problem' ? 5 : 3; }
    q.grade = x.grade > 0 ? x.grade : M.TYPE[x.type].grade;
    q.unclear = x.unclear.length > 0 || q.text.indexOf(M.UNCLEAR) >= 0;
    q.unclearNotes = x.unclear;
    if (x.suggestion && x.suggestion.trim() && x.suggestion.trim() !== q.text) q.suggest = { text: x.suggestion.trim() };
    q.ctx = { title: x.groupTitle.trim(), passage: x.passage.trim(), main: x.mainNum.trim() };
    q.num = x.num;
    if (x.typeGuess) q.typeNote = 'لم يحدد النوع بثقة — راجعه';
    return q;
  };

  /* تطبيق مفتاح إجابة موجود في المصدر (بالرقم) */
  M.applyAnswerKey = function (qs, key) {
    if (!key.length) return 0;
    var applied = 0;
    qs.forEach(function (q) {
      if (M.hasAnswer(q)) return;
      var cands = key.filter(function (k) { return M.toWestern(k.num) === M.toWestern(q.num) && (!k.mainNum || !q.ctx.main || M.norm(k.mainNum) === M.norm(q.ctx.main)); });
      if (cands.length !== 1) return;
      var a = cands[0].answer.trim();
      if (q.type === 'mcq') { var i = letterIndex(a, q.options.length); if (i < 0) i = q.options.map(M.norm).indexOf(M.norm(a)); if (i >= 0) { q.correct = i; q.ans = 'source'; applied++; } }
      else if (q.type === 'tf') { var t = M.norm(a); if (/^(صح|صحيح|نعم|true|t|✓|√)/.test(t) || a.indexOf('✓') >= 0) { q.answer = true; q.ans = 'source'; applied++; } else if (/^(خطا|خطأ|false|f|✗|×|x)/.test(t) || /[✗×]/.test(a)) { q.answer = false; q.ans = 'source'; applied++; } }
      else if (q.type === 'complete') { var parts = a.split(/\s*[-–—،,;؛]\s*/), bi = 0; q.text = q.text.replace(/\[\[(.*?)\]\]/g, function (m, v) { var p = parts[bi++]; return '[[' + (p ? p : v) + ']]'; }); if (M.hasAnswer(q)) { q.ans = 'source'; applied++; } }
      else if (q.type === 'term') { q.term = a; q.ans = 'source'; applied++; }
      else if (q.type !== 'match') { q.modelAnswer = a; q.ans = 'source'; applied++; }
    });
    return applied;
  };

  /* بصمة للتكرار: النوع + النص + الاختيارات */
  M.qKey = function (q) { return q.type + '|' + M.norm(q.text) + '|' + (q.options || []).map(M.norm).join('/') + '|' + (q.pairs || []).map(function (p) { return M.norm(p.a); }).join('/'); };
  /* أسئلة مشابهة في المكتبة (لا يُحذف شيء تلقائياً) */
  M.findSimilar = function (q, pool, th) {
    th = th || 0.85; var k = M.qKey(q);
    return pool.filter(function (o) { if (o.id === q.id || o.type !== q.type) return false; if (M.qKey(o) === k) return true; return M.similarity(q.text + ' ' + (q.options || []).join(' '), o.text + ' ' + (o.options || []).join(' ')) >= th; });
  };

  /* نسخة مستقلة للامتحان (لا تتأثر بتعديل المكتبة لاحقاً) */
  M.copyForExam = function (q) {
    var c = JSON.parse(JSON.stringify(q));
    c.libRef = { id: q.id, lib: q.lib, ver: q.ver || 1, at: M.now() };
    c.libReview = q.review || 'needs';
    c.id = M.uid(); c.source = 'exam';
    ['lib', 'review', 'meta', 'src', 'orig', 'deleted', 'cloudAt', 'cloudErr', 'cloudErrAt', 'ownerId', 'ver', 'createdAt', 'updatedAt', 'updatedBy', 'updatedByName', 'createdBy', 'usedIn', 'gen'].forEach(function (k) { delete c[k]; });
    return c;
  };
  /* حفظ سؤال مكتوب داخل امتحان في مكتبة الأسئلة (يدوي — ليس مولداً بالذكاء الاصطناعي) */
  M.saveToLibrary = function (q, meta) {
    var c = JSON.parse(JSON.stringify(q));
    c.id = M.uid(); c.lib = 'extracted'; c.origin = 'manual'; c.source = 'manual'; c.status = 'lib';
    c.review = 'reviewed'; c.ans = M.hasAnswer(c) ? (q.ans === 'ai' ? 'ai' : (q.ans || 'teacher')) : 'none';
    c.meta = Object.assign({ subject: '', grade: '', unit: '', lesson: '', tags: [] }, meta || {});
    c.src = { kind: 'exam', name: (meta && meta.examTitle) || 'امتحان' };
    delete c.libRef; delete c.libReview; delete c.meta.examTitle;
    return M.save('questions', c);
  };
})(window.M);
