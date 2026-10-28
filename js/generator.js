/* توليد النماذج الاسترشادية من البنك وفق جدول المواصفات */
(function (M) {
  'use strict';

  function largestRemainder(weights, total) {
    var sum = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var raw = weights.map(function (w) { return w / sum * total; });
    var base = raw.map(Math.floor);
    var left = total - base.reduce(function (a, b) { return a + b; }, 0);
    var order = raw.map(function (r, i) { return { i: i, f: r - Math.floor(r) }; }).sort(function (a, b) { return b.f - a.f; });
    for (var k = 0; k < left; k++) base[order[k % order.length].i] += 1;
    return base;
  }

  /*
   bp = { subjectId, lessonIds:[], sections:[{type,count,itemGrade,title}], modelCount, seed, meta:{title,className,...} }
  */
  M.generateModels = function (bp) {
    var rnd = M.rng(bp.seed || Date.now());
    var targets = (M.S.settings.levelTargets || [30, 40, 20, 10]).map(Number);
    var lessons = bp.lessonIds.map(function (id) { return M.byId('lessons', id); }).filter(Boolean);
    var weights = lessons.map(function (l) { return Number(l.periods) || 1; });
    var usedGlobal = {};
    var labels = ['أ', 'ب', 'ج', 'د', 'هـ'];
    var groupId = M.uid();
    var exams = [], shortages = [];

    for (var m = 0; m < bp.modelCount; m++) {
      var exam = Object.assign({
        id: M.uid(), subjectId: bp.subjectId, groupId: groupId, model: bp.modelCount > 1 ? labels[m] : '',
        scopeLessonIds: bp.lessonIds.slice(), sections: [], status: 'draft', shuffleSeed: M.uid(), shuffleOptions: true,
        digits: M.S.settings.digits || 'arabic', showStudent: true, showGradeTable: true, showInstructions: true, showSign: true,
        instructions: 'أجب عن جميع الأسئلة في نفس الورقة.', fontSize: 14, color: '#1F2A44', lang: 'ar', paper: 'a4'
      }, JSON.parse(JSON.stringify(bp.meta || {})));
      var levelCount = [0, 0, 0, 0];

      bp.sections.forEach(function (sd) {
        var need = Number(sd.count) || 0;
        var sec = { id: M.uid(), type: sd.type, title: sd.title || M.TYPE[sd.type].title, items: [], wordBank: true, layout: 'auto' };
        var pools = lessons.map(function (l) {
          return M.shuffle(M.S.questions.filter(function (q) {
            return q.lessonId === l.id && q.type === sd.type && q.status === 'approved' && !usedGlobal[q.id];
          }), rnd).sort(function (a, b) { return (a.usedIn || []).length - (b.usedIn || []).length; });
        });
        var quota = largestRemainder(weights, need);
        /* نقل الحصص الزائدة من درس لا يكفي بنكه إلى غيره */
        var deficit = 0;
        quota = quota.map(function (qn, i) { var have = pools[i].length; if (qn > have) { deficit += qn - have; return have; } return qn; });
        while (deficit > 0) {
          var best = -1, bestSpare = 0;
          for (var i = 0; i < pools.length; i++) {
            var spare = pools[i].length - quota[i];
            if (spare > 0 && (best < 0 || weights[i] * spare > weights[best] * bestSpare)) { best = i; bestSpare = spare; }
          }
          if (best < 0) break;
          quota[best] += 1; deficit -= 1;
        }
        lessons.forEach(function (l, i) {
          for (var k = 0; k < quota[i]; k++) {
            var pool = pools[i];
            if (!pool.length) break;
            /* اختر المستوى الأكثر نقصاً عن النسبة المستهدفة */
            var totalNow = levelCount.reduce(function (a, b) { return a + b; }, 0) + 1;
            var gap = targets.map(function (t, lv) { return t / 100 - levelCount[lv] / totalNow; });
            var pickIdx = 0, pickGap = -9;
            pool.forEach(function (q, j) { var g = gap[Math.min(3, Number(q.level) || 0)]; if (g > pickGap + 1e-9) { pickGap = g; pickIdx = j; } });
            var q = pool.splice(pickIdx, 1)[0];
            usedGlobal[q.id] = true;
            levelCount[Math.min(3, Number(q.level) || 0)] += 1;
            sec.items.push({ qid: q.id, grade: sd.itemGrade !== '' && sd.itemGrade != null ? Number(sd.itemGrade) : null });
          }
        });
        if (sec.items.length < need) shortages.push({ model: exam.model, type: sd.type, need: need, got: sec.items.length });
        exam.sections.push(sec);
      });
      exam.totalGrade = M.examTotal(exam);
      exams.push(exam);
    }
    return { exams: exams, shortages: shortages, groupId: groupId };
  };

  /* أسئلة بديلة لفرع في امتحان */
  M.alternatives = function (exam, sec, qid) {
    var cur = M.examQ(exam, qid);
    var inExam = {};
    exam.sections.forEach(function (s) { s.items.forEach(function (it) { inExam[it.qid] = 1; }); });
    return M.S.questions.filter(function (q) {
      return q.type === sec.type && q.status === 'approved' && !inExam[q.id] && q.subjectId === exam.subjectId;
    }).sort(function (a, b) {
      var sa = (a.lessonId === (cur && cur.lessonId) ? 0 : 2) + (Number(a.level) === Number(cur && cur.level) ? 0 : 1);
      var sb = (b.lessonId === (cur && cur.lessonId) ? 0 : 2) + (Number(b.level) === Number(cur && cur.level) ? 0 : 1);
      return sa - sb || (a.usedIn || []).length - (b.usedIn || []).length;
    });
  };
})(window.M);
