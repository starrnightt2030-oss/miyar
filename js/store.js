/* الحالة والقواعد — معيار */
(function (M) {
  'use strict';

  M.TYPES = [
    { id: 'mcq', label: 'اختيار من متعدد', title: 'اختر الإجابة الصحيحة مما بين الأقواس:', grade: 1 },
    { id: 'tf', label: 'صح وخطأ', title: 'ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخطأ:', grade: 1 },
    { id: 'complete', label: 'أكمل', title: 'أكمل العبارات الآتية بما يناسبها:', grade: 1 },
    { id: 'match', label: 'توصيل', title: 'صِل من العمود (أ) بما يناسبه من العمود (ب):', grade: 1 },
    { id: 'term', label: 'مصطلح علمي', title: 'اكتب المصطلح العلمي الدال على كل عبارة مما يأتي:', grade: 1 },
    { id: 'reason', label: 'علّل', title: 'علّل لما يأتي:', grade: 2 },
    { id: 'essay', label: 'مقالي', title: 'أجب عما يأتي:', grade: 3 },
    { id: 'draw', label: 'اشرح وارسم', title: 'اشرح مع الرسم:', grade: 3 },
    { id: 'image', label: 'صورة واستخراج', title: 'تأمل الشكل ثم أجب:', grade: 2 },
    { id: 'problem', label: 'مسألة', title: 'حُلّ المسائل الآتية:', grade: 3 }
  ];
  M.TYPE = {}; M.TYPES.forEach(function (t) { M.TYPE[t.id] = t; });
  M.LEVELS = ['تذكر', 'فهم', 'تطبيق', 'تحليل وتقويم'];
  M.DIFFS = ['سهل', 'متوسط', 'صعب'];
  M.STATUS = {
    draft: { label: 'مسودة', cls: 'warn' },
    review: { label: 'قيد المراجعة', cls: 'info' },
    returned: { label: 'مُعاد بملاحظة', cls: 'bad' },
    approved: { label: 'معتمد', cls: 'ok' },
    archived: { label: 'مؤرشف', cls: '' }
  };
  M.ROLES = { teacher: 'مدرس', head: 'رئيس قسم', admin: 'مدير النظام' };
  M.DOC_TYPES = { exam: 'ورقة امتحان', bank: 'بنك أسئلة', spec: 'جدول مواصفات', key: 'نموذج إجابة', other: 'أخرى' };

  var S = M.S = { settings: {}, subjects: [], units: [], lessons: [], outcomes: [], questions: [], exams: [], docs: [], log: [], packs: [] };

  var DEFAULTS = {
    center: { name: '', directorate: '', address: '', logo: '' },
    user: { name: '', role: '', pin: '' },
    deviceId: '',
    digits: 'arabic',
    levelTargets: [30, 40, 20, 10],
    year: '',
    setupDone: false
  };

  M.load = function () {
    return M.db.ready().then(function () {
      return Promise.all(['settings'].concat(M.STORES).map(function (s) { return M.db.all(s); }));
    }).then(function (res) {
      var st = {};
      (res[0] || []).forEach(function (r) { st[r.key] = r.value; });
      S.settings = Object.assign({}, JSON.parse(JSON.stringify(DEFAULTS)), st);
      if (!S.settings.deviceId) { S.settings.deviceId = M.uid(); M.setSetting('deviceId', S.settings.deviceId); }
      if (!S.settings.year) {
        var d = new Date(), y = d.getFullYear(); if (d.getMonth() < 7) y -= 1;
        S.settings.year = y + ' / ' + (y + 1);
      }
      M.STORES.forEach(function (s, i) { S[s] = (res[i + 1] || []).filter(Boolean); });
      S.log.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    });
  };

  M.setSetting = function (key, value) {
    S.settings[key] = value;
    return M.db.put('settings', { key: key, value: value });
  };

  M.me = function () { return S.settings.user || {}; };
  M.role = function () { return (S.settings.user || {}).role || 'teacher'; };
  M.can = function (what) {
    var r = M.role();
    if (what === 'approve') return r === 'head' || r === 'admin';
    if (what === 'docs' || what === 'merge' || what === 'center') return r === 'admin';
    return true;
  };

  M.byId = function (store, id) {
    var a = S[store]; for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  };

  M.log = function (action, target, detail) {
    var e = { id: M.uid(), at: M.now(), by: M.me().name || '—', role: M.role(), device: S.settings.deviceId, action: action, target: target || '', detail: detail || '' };
    S.log.unshift(e);
    return M.db.put('log', e);
  };

  /* حفظ سجل مع بيانات التتبع */
  M.save = function (store, rec, opts) {
    opts = opts || {};
    var isNew = !rec.id || !M.byId(store, rec.id);
    if (!rec.id) rec.id = M.uid();
    var t = M.now();
    if (isNew) { rec.createdAt = rec.createdAt || t; rec.createdBy = rec.createdBy || M.me().name || ''; rec.ver = rec.ver || 1; }
    else if (!opts.keepVer) rec.ver = (rec.ver || 1) + 1;
    rec.updatedAt = t;
    rec.updatedBy = S.settings.deviceId;
    rec.updatedByName = M.me().name || '';
    var arr = S[store];
    var idx = arr.findIndex(function (x) { return x.id === rec.id; });
    if (idx >= 0) arr[idx] = rec; else arr.push(rec);
    return M.db.put(store, rec).then(function () {
      if (opts.log !== false) M.log(isNew ? 'إنشاء' : 'تعديل', storeLabel(store) + ': ' + recLabel(store, rec));
      return rec;
    });
  };
  M.remove = function (store, id) {
    var rec = M.byId(store, id);
    S[store] = S[store].filter(function (x) { return x.id !== id; });
    return M.db.del(store, id).then(function () { if (rec) M.log('حذف', storeLabel(store) + ': ' + recLabel(store, rec)); });
  };
  function storeLabel(s) {
    return { subjects: 'مادة', units: 'وحدة', lessons: 'درس', outcomes: 'ناتج تعلم', questions: 'سؤال', exams: 'امتحان', docs: 'وثيقة' }[s] || s;
  }
  function recLabel(store, r) {
    var t = r.name || r.title || r.text || r.code || '';
    t = String(t).replace(/\s+/g, ' ');
    return t.length > 60 ? t.slice(0, 60) + '…' : t;
  }

  /* ===== استعلامات المنهج ===== */
  M.unitsOf = function (subjectId) {
    return S.units.filter(function (u) { return u.subjectId === subjectId; }).sort(function (a, b) { return (a.term - b.term) || (a.order - b.order); });
  };
  M.lessonsOf = function (unitId) {
    return S.lessons.filter(function (l) { return l.unitId === unitId; }).sort(function (a, b) { return a.order - b.order; });
  };
  M.outcomesOf = function (lessonId) {
    return S.outcomes.filter(function (o) { return o.lessonId === lessonId; }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code), 'ar'); });
  };
  M.lessonsOfSubject = function (subjectId) {
    var out = [];
    M.unitsOf(subjectId).forEach(function (u) { out = out.concat(M.lessonsOf(u.id)); });
    return out;
  };
  M.questionsOf = function (filter) {
    filter = filter || {};
    return S.questions.filter(function (q) {
      if (filter.subjectId && q.subjectId !== filter.subjectId) return false;
      if (filter.lessonIds && filter.lessonIds.indexOf(q.lessonId) < 0) return false;
      if (filter.type && q.type !== filter.type) return false;
      if (filter.status && q.status !== filter.status) return false;
      if (filter.level != null && filter.level !== '' && String(q.level) !== String(filter.level)) return false;
      if (!filter.includeArchived && q.status === 'archived' && filter.status !== 'archived') return false;
      return true;
    });
  };
  M.lessonPath = function (lessonId) {
    var l = M.byId('lessons', lessonId); if (!l) return { lesson: null };
    var u = M.byId('units', l.unitId); var s = u && M.byId('subjects', u.subjectId);
    return { lesson: l, unit: u, subject: s };
  };
  M.termLabel = function (t) { return Number(t) === 2 ? 'الفصل الدراسي الثاني' : 'الفصل الدراسي الأول'; };

  /* ===== السؤال ===== */
  M.newQuestion = function (type, lessonId) {
    var p = M.lessonPath(lessonId);
    var q = {
      id: M.uid(), type: type, subjectId: p.subject ? p.subject.id : '', lessonId: lessonId || '', outcomeId: '',
      level: type === 'mcq' || type === 'tf' || type === 'complete' || type === 'term' ? 0 : (type === 'problem' ? 2 : 1),
      difficulty: 1, grade: M.TYPE[type].grade, status: 'draft', source: 'manual',
      text: '', options: type === 'mcq' ? ['', '', '', ''] : [], correct: 0,
      answer: true, correction: '', pairs: type === 'match' ? [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }] : [], extras: [],
      term: '', lines: type === 'essay' ? 4 : (type === 'reason' ? 2 : 3), drawHeight: 140, drawGrid: true,
      image: '', labels: type === 'image' ? [{ n: '1', name: '' }, { n: '2', name: '' }] : [],
      modelAnswer: '', reviewNote: '', usedIn: []
    };
    return q;
  };

  /* تحقق من اكتمال السؤال قبل إرساله للمراجعة */
  M.validateQuestion = function (q) {
    var e = [];
    if (!q.lessonId) e.push('اختر الدرس');
    if (q.type !== 'match' && !String(q.text || '').trim()) e.push('اكتب نص السؤال');
    if (q.type === 'mcq') {
      var filled = q.options.filter(function (o) { return String(o).trim(); });
      if (filled.length < 2) e.push('أدخل اختيارين على الأقل');
      if (!String(q.options[q.correct] || '').trim()) e.push('حدّد الإجابة الصحيحة');
      var seen = {}; q.options.forEach(function (o) { var k = M.norm(o); if (k && seen[k]) e.push('يوجد اختياران متطابقان'); seen[k] = 1; });
    }
    if (q.type === 'complete') {
      if (!/\[\[.+?\]\]/.test(q.text)) e.push('ضع الإجابة بين [[ ]] داخل العبارة');
    }
    if (q.type === 'match') {
      var ok = q.pairs.filter(function (p) { return String(p.a).trim() && String(p.b).trim(); });
      if (ok.length < 2) e.push('أدخل زوجين على الأقل للتوصيل');
    }
    if (q.type === 'term' && !String(q.term || '').trim()) e.push('اكتب المصطلح الصحيح');
    if (q.type === 'image' && !q.image) e.push('أضف الصورة');
    if (!(Number(q.grade) > 0)) e.push('حدّد درجة السؤال');
    if ((q.type === 'reason' || q.type === 'essay' || q.type === 'problem' || q.type === 'draw') && !String(q.modelAnswer || '').trim()) e.push('اكتب نموذج الإجابة');
    return e.filter(function (x, i, a) { return a.indexOf(x) === i; });
  };

  M.setStatus = function (q, status, note) {
    var prev = q.status;
    q.status = status;
    if (note != null) q.reviewNote = note;
    if (status === 'approved') { q.approvedBy = M.me().name || ''; q.approvedAt = M.now(); }
    return M.save('questions', q, { log: false, keepVer: true }).then(function () {
      M.log('تغيير حالة', 'سؤال: ' + String(q.text || '').slice(0, 50), (M.STATUS[prev] || {}).label + ' ← ' + M.STATUS[status].label + (note ? ' — ' + note : ''));
    });
  };

  /* نص الإجابة الصحيحة للمفتاح */
  M.answerText = function (q) {
    switch (q.type) {
      case 'mcq': return (M.AR_LETTERS[q.correct] || '') + ') ' + (q.options[q.correct] || '');
      case 'tf': return q.answer ? '✓' : '✗' + (q.correction ? ' — التصويب: ' + q.correction : '');
      case 'complete': return (String(q.text).match(/\[\[(.+?)\]\]/g) || []).map(function (m) { return m.slice(2, -2); }).join(' — ');
      case 'term': return q.term;
      case 'match': return '';
      default: return q.modelAnswer || '';
    }
  };

  /* ===== الوثائق ===== */
  M.docFor = function (type) {
    var list = S.docs.filter(function (d) { return d.type === type && d.active !== false; });
    list.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    return list[0] || null;
  };

  /* ===== الإحصاءات ===== */
  M.coverage = function (subjectId, lessonIds) {
    var lessons = lessonIds ? lessonIds.map(function (id) { return M.byId('lessons', id); }).filter(Boolean) : M.lessonsOfSubject(subjectId);
    return lessons.map(function (l) {
      var qs = S.questions.filter(function (q) { return q.lessonId === l.id && q.status === 'approved'; });
      var byLevel = M.LEVELS.map(function (_, i) { return qs.filter(function (q) { return Number(q.level) === i; }).length; });
      var all = S.questions.filter(function (q) { return q.lessonId === l.id && q.status !== 'archived'; }).length;
      return { lesson: l, byLevel: byLevel, approved: qs.length, all: all };
    });
  };

  M.pendingReview = function () {
    return S.questions.filter(function (q) { return q.status === 'review'; });
  };
})(window.M);
