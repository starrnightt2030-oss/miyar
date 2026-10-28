/* الحزم والدمج والنسخ الاحتياطي واستيراد/تصدير Excel وWord واقتراح الأسئلة */
(function (M) {
  'use strict';
  var S = M.S;
  var DATA_STORES = ['subjects', 'units', 'lessons', 'outcomes', 'questions', 'exams'];
  var META = ['ver', 'updatedAt', 'updatedBy', 'updatedByName', 'syncedAt', 'createdAt', 'createdBy'];

  function clean(o) { var c = JSON.parse(JSON.stringify(o)); META.forEach(function (k) { delete c[k]; }); return JSON.stringify(c); }

  /* ===== الحزم ===== */
  M.buildPack = function (kind, opts) {
    opts = opts || {};
    var data = {};
    DATA_STORES.forEach(function (s) {
      data[s] = S[s].slice();
    });
    if (kind === 'backup') { data.docs = S.docs; data.log = S.log; data.packs = S.packs; data.settings = {}; Object.keys(S.settings).forEach(function (k) { if (['folderHandle', 'aiKey', 'aiKeys', 'cloudSession'].indexOf(k) < 0) data.settings[k] = S.settings[k]; }); }
    var payload = JSON.stringify(data);
    return M.hash(payload).then(function (h) {
      return JSON.stringify({ format: 'miyar-pack', v: 1, kind: kind, createdAt: M.now(), from: { deviceId: S.settings.deviceId, name: M.me().name, role: M.role(), center: (S.settings.center || {}).name || '' }, hash: h, data: data });
    });
  };

  M.exportPack = function () {
    return M.buildPack('teacher').then(function (txt) {
      var nm = (M.me().name || 'مدرس').replace(/[\\/:*?"<>|\s]+/g, '-');
      var file = 'حزمة-' + nm + '-' + M.today() + '.miyar';
      M.log('تصدير حزمة', file, 'أسئلة: ' + S.questions.length);
      M.setSetting('lastPackAt', M.now());
      return M.shareOrDownload(file, new Blob([txt], { type: 'application/json' }), 'حزمة بنك الأسئلة');
    });
  };

  M.parsePack = function (text) {
    var p;
    try { p = JSON.parse(text); } catch (e) { return Promise.reject(new Error('الملف ليس حزمة معيار صالحة')); }
    if (!p || p.format !== 'miyar-pack' || !p.data) return Promise.reject(new Error('الملف ليس حزمة معيار صالحة'));
    return M.hash(JSON.stringify(p.data)).then(function (h) { p.intact = h === p.hash; return p; });
  };

  /* تحليل الحزمة قبل الدمج */
  M.analyzePack = function (p) {
    var res = { new: [], update: [], same: 0, older: 0, conflict: [], dup: [] };
    DATA_STORES.forEach(function (store) {
      (p.data[store] || []).forEach(function (inc) {
        if (!inc || !inc.id) return;
        var loc = M.byId(store, inc.id);
        if (!loc) {
          if (store === 'questions') {
            var d = S.questions.find(function (q) { return q.type === inc.type && q.subjectId === inc.subjectId && M.similarity(q.text + (q.options || []).join(' '), inc.text + (inc.options || []).join(' ')) >= 0.85; });
            if (d) { res.dup.push({ store: store, inc: inc, local: d }); return; }
          }
          res.new.push({ store: store, inc: inc }); return;
        }
        if (clean(loc) === clean(inc)) { res.same++; return; }
        var locChanged = !loc.syncedAt || loc.updatedAt > loc.syncedAt;
        var incNewer = inc.updatedAt > loc.updatedAt;
        if (!locChanged) { if (incNewer) res.update.push({ store: store, inc: inc, local: loc }); else res.older++; return; }
        if (loc.updatedBy === inc.updatedBy) { if (incNewer) res.update.push({ store: store, inc: inc, local: loc }); else res.older++; return; }
        if (loc.syncedAt && inc.updatedAt <= loc.syncedAt) { res.older++; return; }
        res.conflict.push({ store: store, inc: inc, local: loc, take: false });
      });
    });
    return res;
  };

  M.applyPack = function (p, an, opts) {
    opts = opts || {};
    var t = M.now(), by = {};
    function add(store, rec) { rec = JSON.parse(JSON.stringify(rec)); rec.syncedAt = t; (by[store] = by[store] || []).push(rec); }
    an.new.forEach(function (x) { add(x.store, x.inc); });
    an.update.forEach(function (x) { add(x.store, x.inc); });
    if (opts.includeDup) an.dup.forEach(function (x) { add(x.store, x.inc); });
    an.conflict.forEach(function (x) { if (x.take) add(x.store, x.inc); });
    var jobs = Object.keys(by).map(function (store) {
      by[store].forEach(function (rec) {
        var i = S[store].findIndex(function (r) { return r.id === rec.id; });
        if (i >= 0) S[store][i] = rec; else S[store].push(rec);
      });
      return M.db.putMany(store, by[store]);
    });
    var count = Object.keys(by).reduce(function (s, k) { return s + by[k].length; }, 0);
    var rec = { id: M.uid(), at: t, from: p.from, kind: p.kind, intact: p.intact, hash: p.hash, fileName: opts.fileName || '', added: an.new.length, updated: an.update.length, conflicts: an.conflict.length, dup: an.dup.length, applied: count };
    S.packs.unshift(rec);
    jobs.push(M.db.put('packs', rec));
    return Promise.all(jobs).then(function () {
      M.log('دمج حزمة', (p.from && p.from.name) || '—', 'جديد ' + an.new.length + ' · محدث ' + an.update.length + ' · تعارض ' + an.conflict.length + ' · مكرر ' + an.dup.length);
      return count;
    });
  };

  /* ===== النسخة الاحتياطية ===== */
  M.backup = function () {
    return M.buildPack('backup').then(function (txt) {
      M.setSetting('lastBackupAt', M.now());
      M.download('نسخة-احتياطية-معيار-' + M.today() + '.miyar', new Blob([txt], { type: 'application/json' }));
    });
  };
  M.restore = function (p) {
    if (p.kind !== 'backup') return Promise.reject(new Error('هذا الملف حزمة مدرس وليس نسخة احتياطية — استخدم «دمج الحزم»'));
    var stores = DATA_STORES.concat(['docs', 'log', 'packs']);
    return Promise.all(stores.map(function (s) { return M.db.clear(s); })).then(function () {
      return Promise.all(stores.map(function (s) { return M.db.putMany(s, p.data[s] || []); }));
    }).then(function () {
      var st = p.data.settings || {};
      var keepDevice = S.settings.deviceId;
      return Promise.all(Object.keys(st).filter(function (k) { return ['folderHandle', 'aiKey', 'aiKeys', 'cloudSession'].indexOf(k) < 0; }).map(function (k) { return M.setSetting(k, k === 'deviceId' ? keepDevice : st[k]); }));
    });
  };

  /* ===== Excel ===== */
  var XL_COLS = ['المعرف', 'المادة', 'الفصل الدراسي', 'الوحدة', 'الدرس', 'كود ناتج التعلم', 'ناتج التعلم', 'النوع', 'نص السؤال',
    'اختيار أ', 'اختيار ب', 'اختيار ج', 'اختيار د', 'اختيار هـ', 'اختيار و', 'الإجابة الصحيحة', 'التصويب', 'أزواج التوصيل', 'بدائل/كلمات زائدة',
    'المصطلح', 'نموذج الإجابة', 'المستوى المعرفي', 'الصعوبة', 'الدرجة', 'عدد السطور', 'الحالة', 'المصدر', 'الكاتب', 'آخر تعديل', 'الإصدار'];

  function qRow(q) {
    var p = M.lessonPath(q.lessonId), o = M.byId('outcomes', q.outcomeId);
    var correct = q.type === 'mcq' ? M.AR_LETTERS[q.correct] : (q.type === 'tf' ? (q.answer ? 'صح' : 'خطأ') : (q.type === 'complete' ? M.answerText(q) : ''));
    return [q.id, p.subject ? p.subject.name : '', p.unit ? M.termLabel(p.unit.term) : '', p.unit ? p.unit.name : '', p.lesson ? p.lesson.name : '',
      o ? o.code : '', o ? o.text : '', M.TYPE[q.type].label, q.text,
      q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || '', q.options[4] || '', q.options[5] || '',
      correct, q.correction || '', (q.pairs || []).filter(function (x) { return x.a; }).map(function (x) { return x.a + ' = ' + x.b; }).join(' ؛ '),
      (q.extras || []).join(' ؛ '), q.term || '', q.modelAnswer || '', M.LEVELS[q.level] || '', M.DIFFS[q.difficulty] || '', Number(q.grade) || 0,
      q.lines || '', (M.STATUS[q.status] || {}).label || '', q.source === 'ai' ? 'مقترح آلياً' : 'يدوي', q.createdBy || '', M.fmtDate(q.updatedAt, true), q.ver || 1];
  }

  M.exportBankExcel = function (questions, title) {
    var XLSX = window.XLSX;
    var wb = XLSX.utils.book_new();
    var doc = M.docFor('bank'), cen = S.settings.center || {};
    var bySub = {};
    questions.forEach(function (q) { (bySub[q.subjectId] = bySub[q.subjectId] || []).push(q); });
    Object.keys(bySub).forEach(function (sid) {
      var sub = M.byId('subjects', sid);
      var rows = [
        [cen.name || '', '', '', doc ? 'اسم الوثيقة: ' + doc.name : ''],
        ['بنك أسئلة مادة ' + (sub ? sub.name : ''), '', '', doc ? 'كود الوثيقة: ' + doc.code + ' — الإصدار ' + doc.version : ''],
        ['تاريخ الاستخراج: ' + M.fmtDate(M.now(), true), '', '', 'عدد الأسئلة: ' + bySub[sid].length],
        [],
        XL_COLS
      ];
      bySub[sid].forEach(function (q) { rows.push(qRow(q)); });
      var ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = XL_COLS.map(function (c) { return { wch: c === 'نص السؤال' || c === 'نموذج الإجابة' ? 50 : (c === 'المعرف' ? 10 : 16) }; });
      ws['!views'] = [{ RTL: true }];
      var name = (sub ? sub.name : 'مادة').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 30) || 'مادة';
      var n = name, i = 2; while (wb.SheetNames.indexOf(n) >= 0) n = name.slice(0, 27) + ' ' + (i++);
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([XL_COLS]), 'بنك الأسئلة');
    wb.Workbook = { Views: [{ RTL: true }] };
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    M.download((title || 'بنك-الأسئلة') + '-' + M.today() + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    M.log('تصدير Excel', title || 'بنك الأسئلة', 'أسئلة: ' + questions.length);
  };

  M.exportSpecExcel = function (exam) {
    var XLSX = window.XLSX, d = M.specData(exam);
    var rows = [['جدول المواصفات — ' + (exam.title || '') + (exam.model ? ' — نموذج ' + exam.model : '')], [],
      ['الدرس', 'عدد الحصص', 'الوزن النسبي %', 'الدرجة المستهدفة'].concat(M.LEVELS.map(function (l) { return l + ' (درجات)'; })).concat(['الدرجة الفعلية'])];
    d.rows.forEach(function (r) { rows.push([r.lesson.name, Number(r.lesson.periods) || 1, Math.round(r.weight * 1000) / 10, Math.round(r.targetGrade * 10) / 10].concat(r.grd).concat([r.actual])); });
    rows.push(['المجموع', '', 100, d.total].concat(d.levelGrades).concat([M.examTotal(exam)]));
    var ws = XLSX.utils.aoa_to_sheet(rows); ws['!views'] = [{ RTL: true }]; ws['!cols'] = [{ wch: 30 }];
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'جدول المواصفات'); wb.Workbook = { Views: [{ RTL: true }] };
    M.download('جدول-المواصفات-' + M.today() + '.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
  };

  var TYPE_BY_LABEL = {}; M.TYPES.forEach(function (t) { TYPE_BY_LABEL[M.norm(t.label)] = t.id; });
  TYPE_BY_LABEL[M.norm('اختر')] = 'mcq'; TYPE_BY_LABEL[M.norm('صواب وخطأ')] = 'tf'; TYPE_BY_LABEL[M.norm('صل')] = 'match'; TYPE_BY_LABEL[M.norm('علل')] = 'reason';

  /* استيراد من Excel: يقبل ملفات معيار وجداول بسيطة (السؤال + أ ب ج د + الإجابة) */
  M.importBankExcel = function (buffer, defaults) {
    var XLSX = window.XLSX;
    var wb = XLSX.read(buffer, { type: 'array' });
    var created = [], skipped = 0, made = { units: 0, lessons: 0 };
    var jobs = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
      var hi = rows.findIndex(function (r) { return r.some(function (c) { var n = M.norm(c); return n === M.norm('نص السؤال') || n === M.norm('السؤال'); }); });
      if (hi < 0) return;
      var H = rows[hi].map(function (c) { return M.norm(c); });
      function col() { for (var i = 0; i < arguments.length; i++) { var k = H.indexOf(M.norm(arguments[i])); if (k >= 0) return k; } return -1; }
      var C = {
        id: col('المعرف'), subject: col('المادة'), term: col('الفصل الدراسي'), unit: col('الوحدة'), lesson: col('الدرس'), ocode: col('كود ناتج التعلم'), otext: col('ناتج التعلم'),
        type: col('النوع'), text: col('نص السؤال', 'السؤال'), o: [col('اختيار أ', 'أ', 'ا'), col('اختيار ب', 'ب'), col('اختيار ج', 'ج'), col('اختيار د', 'د'), col('اختيار هـ', 'هـ'), col('اختيار و', 'و')],
        correct: col('الإجابة الصحيحة', 'الإجابة', 'الاجابة الصحيحة'), correction: col('التصويب'), pairs: col('أزواج التوصيل'), extras: col('بدائل/كلمات زائدة'),
        term2: col('المصطلح'), model: col('نموذج الإجابة'), level: col('المستوى المعرفي', 'المستوى'), diff: col('الصعوبة'), grade: col('الدرجة'), lines: col('عدد السطور')
      };
      var subjectId = defaults.subjectId;
      rows.slice(hi + 1).forEach(function (r) {
        var get = function (k) { return k >= 0 ? String(r[k] == null ? '' : r[k]).trim() : ''; };
        var text = get(C.text);
        if (!text && !get(C.pairs)) return;
        if (C.id >= 0 && get(C.id) && M.byId('questions', get(C.id))) { skipped++; return; }
        /* المنهج */
        var lessonId = defaults.lessonId || '';
        var unitName = get(C.unit), lessonName = get(C.lesson);
        if (lessonName) {
          var unit = null;
          if (unitName) {
            unit = S.units.find(function (u) { return u.subjectId === subjectId && M.norm(u.name) === M.norm(unitName); });
            if (!unit) {
              unit = { id: M.uid(), subjectId: subjectId, name: unitName, term: /الثاني/.test(get(C.term)) ? 2 : 1, order: M.unitsOf(subjectId).length + 1 };
              jobs.push(M.save('units', unit, { log: false })); made.units++;
            }
          } else if (defaults.unitId) unit = M.byId('units', defaults.unitId);
          var ls = S.lessons.find(function (l) { return M.norm(l.name) === M.norm(lessonName) && (!unit || l.unitId === unit.id); });
          if (!ls && unit) {
            ls = { id: M.uid(), unitId: unit.id, subjectId: subjectId, name: lessonName, periods: 1, order: M.lessonsOf(unit.id).length + 1, content: '' };
            jobs.push(M.save('lessons', ls, { log: false })); made.lessons++;
          }
          if (ls) lessonId = ls.id;
        }
        var opts = C.o.map(get);
        var tlabel = get(C.type);
        var type = TYPE_BY_LABEL[M.norm(tlabel)] || (opts.filter(Boolean).length >= 2 ? 'mcq' : (defaults.type || 'essay'));
        var q = M.newQuestion(type, lessonId);
        q.subjectId = subjectId; q.text = text; q.source = 'import'; q.status = 'draft';
        if (type === 'mcq') {
          q.options = opts.filter(function (o, i) { return o || i < 4; }).slice(0, 6);
          while (q.options.length > 2 && !q.options[q.options.length - 1]) q.options.pop();
          var cr = M.norm(get(C.correct));
          var li = M.AR_LETTERS.map(M.norm).indexOf(cr);
          if (li < 0) li = ['a', 'b', 'c', 'd', 'e', 'f'].indexOf(cr);
          if (li < 0 && /^\d$/.test(cr)) li = Number(cr) - 1;
          if (li < 0) li = q.options.map(M.norm).indexOf(cr);
          q.correct = Math.max(0, li);
        }
        if (type === 'tf') { q.answer = !/خطا|خطأ|false|x|✗/i.test(get(C.correct)); q.correction = get(C.correction); }
        if (type === 'match') q.pairs = get(C.pairs).split(/[؛;]/).map(function (s) { var a = s.split('='); return { a: (a[0] || '').trim(), b: (a[1] || '').trim() }; }).filter(function (p) { return p.a; });
        if (type === 'complete' && !/\[\[/.test(q.text) && get(C.correct)) q.text = q.text.replace(/\.{3,}|…+|_{3,}/, '[[' + get(C.correct) + ']]');
        q.extras = get(C.extras) ? get(C.extras).split(/[؛;]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
        q.term = get(C.term2); q.modelAnswer = get(C.model);
        var lv = M.LEVELS.indexOf(get(C.level)); if (lv >= 0) q.level = lv;
        var df = M.DIFFS.indexOf(get(C.diff)); if (df >= 0) q.difficulty = df;
        var g = Number(M.toWestern(get(C.grade))); if (g > 0) q.grade = g;
        var ln = Number(M.toWestern(get(C.lines))); if (ln > 0) q.lines = ln;
        var ocode = get(C.ocode);
        if (ocode && lessonId) {
          var oc = S.outcomes.find(function (o) { return o.lessonId === lessonId && M.norm(o.code) === M.norm(ocode); });
          if (!oc) { oc = { id: M.uid(), lessonId: lessonId, code: ocode, text: get(C.otext) }; jobs.push(M.save('outcomes', oc, { log: false })); }
          q.outcomeId = oc.id;
        }
        created.push(q);
      });
    });
    return Promise.all(jobs).then(function () {
      return M.db.putMany('questions', created.map(function (q) { q.createdAt = q.updatedAt = M.now(); q.createdBy = M.me().name || ''; q.updatedBy = S.settings.deviceId; q.ver = 1; S.questions.push(q); return q; }));
    }).then(function () {
      M.log('استيراد Excel', 'أسئلة: ' + created.length, 'وحدات جديدة ' + made.units + ' · دروس جديدة ' + made.lessons);
      return { created: created.length, skipped: skipped, made: made };
    });
  };

  /* ===== اقتراح الأسئلة من محتوى الدرس ===== */
  M.aiPrompt = function (lesson, types, count) {
    var p = M.lessonPath(lesson.id);
    var outs = M.outcomesOf(lesson.id);
    var schema = {
      mcq: '{"type":"mcq","text":"...","options":["...","...","...","..."],"correct":0,"level":0,"difficulty":1,"grade":1}',
      tf: '{"type":"tf","text":"...","answer":true,"correction":"تصويب العبارة إن كانت خطأ","level":0,"grade":1}',
      complete: '{"type":"complete","text":"... [[الإجابة]] ...","level":0,"grade":1}',
      match: '{"type":"match","text":"","pairs":[{"a":"...","b":"..."}],"extras":["بديل زائد"],"level":1,"grade":3}',
      term: '{"type":"term","text":"التعريف ...","term":"المصطلح","level":0,"grade":1}',
      reason: '{"type":"reason","text":"...","modelAnswer":"...","level":1,"grade":2}',
      essay: '{"type":"essay","text":"...","modelAnswer":"...","lines":4,"level":1,"grade":3}',
      draw: '{"type":"draw","text":"اشرح مع الرسم ...","modelAnswer":"...","level":2,"grade":3}',
      problem: '{"type":"problem","text":"...","modelAnswer":"الحل بالخطوات","lines":4,"level":2,"grade":3}'
    };
    return 'أنت خبير تقويم تربوي. أعدّ أسئلة امتحانية دقيقة علمياً ولغوياً، مستندة فقط إلى محتوى الدرس التالي، بدون أي معلومة من خارجه.\n\n' +
      'المادة: ' + (p.subject ? p.subject.name : '') + '\nالوحدة: ' + (p.unit ? p.unit.name : '') + '\nالدرس: ' + lesson.name + '\n' +
      (outs.length ? 'نواتج التعلم:\n' + outs.map(function (o) { return '- ' + o.code + ': ' + o.text; }).join('\n') + '\n' : '') +
      '\nمحتوى الدرس:\n"""\n' + (lesson.content || '[الصق محتوى الدرس هنا]') + '\n"""\n\n' +
      'المطلوب: ' + count + ' أسئلة لكل نوع من الأنواع التالية: ' + types.map(function (t) { return M.TYPE[t].label; }).join('، ') + '.\n' +
      'وزّع المستويات المعرفية: 0 = تذكر، 1 = فهم، 2 = تطبيق، 3 = تحليل وتقويم. الصعوبة: 0 سهل، 1 متوسط، 2 صعب.\n' +
      'قواعد: سؤال واحد لكل فكرة، بلا تكرار، بدائل الاختيار من متعدد متقاربة ومعقولة وواحدة فقط صحيحة، لا تستخدم «كل ما سبق» أو «لا شيء مما سبق».\n\n' +
      'أعد النتيجة بصيغة JSON فقط: مصفوفة من العناصر، كل عنصر بأحد الأشكال التالية:\n' +
      types.map(function (t) { return schema[t]; }).filter(Boolean).join('\n') + '\n';
  };

  M.importAIJson = function (text, lessonId) {
    var t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var s = t.indexOf('['), e = t.lastIndexOf(']');
    if (s < 0 || e < 0) return Promise.reject(new Error('لم أجد مصفوفة JSON في النص'));
    var arr;
    try { arr = JSON.parse(t.slice(s, e + 1)); } catch (err) { return Promise.reject(new Error('صيغة JSON غير صحيحة: ' + err.message)); }
    var list = [];
    arr.forEach(function (x) {
      if (!x || !M.TYPE[x.type]) return;
      var q = M.newQuestion(x.type, lessonId);
      ['text', 'options', 'correct', 'answer', 'correction', 'pairs', 'extras', 'term', 'modelAnswer', 'lines', 'level', 'difficulty', 'grade'].forEach(function (k) { if (x[k] != null) q[k] = x[k]; });
      q.correct = Number(q.correct) || 0; q.level = Math.min(3, Math.max(0, Number(q.level) || 0)); q.difficulty = Math.min(2, Math.max(0, Number(q.difficulty == null ? 1 : q.difficulty)));
      q.grade = Number(q.grade) || M.TYPE[q.type].grade;
      q.source = 'ai'; q.status = 'draft';
      list.push(q);
    });
    var jobs = list.map(function (q) { return M.save('questions', q, { log: false }); });
    return Promise.all(jobs).then(function () { M.log('استيراد أسئلة مقترحة', 'عدد: ' + list.length, 'بحالة مسودة — تحتاج مراجعة'); return list.length; });
  };
})(window.M);
