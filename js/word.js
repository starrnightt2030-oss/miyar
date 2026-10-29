/* تصدير Word (.docx) حقيقي قابل للتعديل */
(function (M) {
  'use strict';

  function D() { return window.docx; }
  var FONT = 'Arial';
  var W = 10466; /* عرض المحتوى بالـ DXA على A4 بهوامش 0.5 بوصة */

  function b64ToBytes(dataUrl) {
    var b = atob(dataUrl.split(',')[1]); var u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function imgSize(dataUrl, maxW, maxH) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () { var s = Math.min(1, maxW / i.width, maxH / i.height); res({ w: Math.round(i.width * s), h: Math.round(i.height * s) }); };
      i.onerror = function () { res({ w: maxW, h: maxH }); };
      i.src = dataUrl;
    });
  }

  function mk(mode) {
    var d = D();
    var T = function (s) { return M.digits(String(s == null ? '' : s), mode); };
    var run = function (text, o) {
      o = o || {};
      return new d.TextRun({ text: T(text), rightToLeft: true, bold: !!o.bold, size: (o.size || 12) * 2, font: FONT, color: o.color });
    };
    var richRuns = function (text, o) {
      o = o || {};
      var out = [];
      String(text == null ? '' : text).split(/(\$[^$]+\$)/g).forEach(function (part) {
        if (!part) return;
        if (/^\$[^$]+\$$/.test(part)) {
          M.mathRuns(part.slice(1, -1)).forEach(function (r) { out.push(new d.TextRun({ text: T(r.text), rightToLeft: true, bold: !!o.bold, size: (o.size || 12) * 2, font: FONT, color: o.color, superScript: !!r.sup, subScript: !!r.sub })); });
        } else out.push(run(part.replace(/\[\[(.+?)\]\]/g, '……………………'), o));
      });
      return out.length ? out : [run('', o)];
    };
    var para = function (children, o) {
      o = o || {};
      if (typeof children === 'string') children = richRuns(children, o);
      return new d.Paragraph({
        children: children, bidirectional: true,
        alignment: o.center ? d.AlignmentType.CENTER : undefined,
        spacing: { before: o.before || 0, after: o.after == null ? 60 : o.after, line: o.line || 300 },
        border: o.bottomLine ? { bottom: { style: d.BorderStyle.SINGLE, size: 8, color: '1F2A44', space: 2 } } : undefined
      });
    };
    var NB = { top: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
    var cell = function (content, o) {
      o = o || {};
      var kids = Array.isArray(content) ? content : [typeof content === 'string' ? para(content, o) : content];
      return new d.TableCell({
        children: kids, width: o.w ? { size: o.w, type: d.WidthType.DXA } : undefined, columnSpan: o.span,
        shading: o.shade ? { fill: o.shade, type: d.ShadingType.CLEAR, color: 'auto' } : undefined,
        verticalAlign: d.VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 90, right: 90 }
      });
    };
    var table = function (rows, widths, o) {
      o = o || {};
      return new d.Table({
        rows: rows.map(function (r) { return new d.TableRow({ children: r, height: o.height ? { value: o.height, rule: d.HeightRule.ATLEAST } : undefined }); }),
        width: { size: widths.reduce(function (a, b) { return a + b; }, 0), type: d.WidthType.DXA }, columnWidths: widths,
        visuallyRightToLeft: true, borders: o.noBorder ? NB : undefined
      });
    };
    return { d: d, T: T, run: run, para: para, cell: cell, table: table, richRuns: richRuns };
  }

  function headerBlocks(k, exam, logoImg) {
    var d = k.d, cen = M.S.settings.center || {}, doc = exam.docId ? M.byId('docs', exam.docId) : M.docFor('exam');
    var sub = M.byId('subjects', exam.subjectId);
    var c1 = [];
    if (logoImg) c1.push(new d.Paragraph({ children: [new d.ImageRun({ data: logoImg.bytes, transformation: { width: logoImg.w, height: logoImg.h } })], alignment: d.AlignmentType.CENTER }));
    c1.push(k.para(cen.name || '[اسم مركز التدريب]', { bold: true, center: true, after: 0 }));
    if (cen.directorate) c1.push(k.para(cen.directorate, { size: 10, center: true, after: 0 }));
    if (cen.address) c1.push(k.para(cen.address, { size: 9, center: true, after: 0 }));
    var c2 = [k.para((exam.title || 'امتحان') + (exam.model ? ' — نموذج (' + exam.model + ')' : ''), { bold: true, size: 15, center: true, after: 20, color: '1F2A44' }),
      k.para('مادة ' + M.examSubject(exam), { bold: true, size: 13, center: true, after: 20 })];
    c2.push(k.para('العام الدراسي ' + (exam.year || M.S.settings.year), { size: 11, center: true, after: 0 }));
    var c3 = doc ? [
      k.para([k.run('اسم الوثيقة: ', { bold: true, size: 9 }), k.run(doc.name, { size: 9 })], { after: 0 }),
      k.para([k.run('كود الوثيقة: ', { bold: true, size: 9 }), new d.TextRun({ text: doc.code || '', size: 18, font: FONT })], { after: 0 }),
      k.para([k.run('رقم الإصدار: ', { bold: true, size: 9 }), k.run(doc.version, { size: 9 })], { after: 0 }),
      k.para([k.run('تاريخ الإصدار: ', { bold: true, size: 9 }), k.run(M.fmtDate(doc.issueDate), { size: 9 })], { after: 0 })
    ] : [k.para('—', { center: true })];
    var out = [k.table([[k.cell(c1, { w: 3300 }), k.cell(c2, { w: 3866 }), k.cell(c3, { w: 3300 })]], [3300, 3866, 3300])];
    out.push(k.para('', { after: 40 }));
    var G = M.secInfo(exam).groups, dots = '……………';
    /* بيانات الطالب والورقة */
    if (exam.showStudent !== false) out.push(k.table([[k.cell('اسم الطالب: ' + '……………………………………………………', { w: 6966, size: 11 }), k.cell('رقم الجلوس: ' + '……………', { w: 3500, size: 11 })]], [6966, 3500]));
    out.push(k.table([[
      k.cell('الصف الدراسي: ' + (exam.className || dots), { w: 2093, size: 10 }), k.cell('التخصص: ' + (exam.specialization || dots), { w: 2093, size: 10 }),
      k.cell('المادة: ' + (M.examSubject(exam) || dots), { w: 2093, size: 10 }), k.cell('الزمن: ' + (exam.duration || dots), { w: 2093, size: 10 }),
      k.cell('التاريخ: ' + (exam.examDate ? M.fmtDate(exam.examDate) : dots), { w: 2094, size: 10 })]], [2093, 2093, 2093, 2093, 2094]));
    out.push(k.table([[
      k.cell('الدرجة الكلية: ' + M.gradeWord(exam.totalGrade || M.examTotal(exam)), { w: 3488, size: 11 }),
      k.cell('عدد الأسئلة: ' + G.length, { w: 3489, size: 11 }), k.cell('عدد الصفحات: ' + (exam._pageCount || ''), { w: 3489, size: 11 })]], [3488, 3489, 3489]));
    if (exam.showGradeTable !== false && exam.sections.length) {
      var n = G.length, cw = Math.floor((W - 1500) / (n + 1));
      var widths = [1500]; for (var i = 0; i <= n; i++) widths.push(cw);
      var r1 = [k.cell('السؤال', { w: 1500, bold: true, size: 10, shade: 'E5E9F2', center: true })], r2 = [k.cell('الدرجة', { w: 1500, bold: true, size: 10, center: true })], r3 = [k.cell('درجة الطالب', { w: 1500, bold: true, size: 10, center: true })];
      G.forEach(function (g, j) {
        r1.push(k.cell(M.ordinal(j), { w: cw, bold: true, size: 10, shade: 'F1F3F6', center: true }));
        r2.push(k.cell(String(M.groupGrade(exam, g)), { w: cw, size: 10, center: true }));
        r3.push(k.cell('', { w: cw }));
      });
      r1.push(k.cell('المجموع', { w: cw, bold: true, size: 10, shade: 'E5E9F2', center: true }));
      r2.push(k.cell(String(M.examTotal(exam)), { w: cw, bold: true, size: 10, center: true }));
      r3.push(k.cell('', { w: cw }));
      out.push(k.table([r1, r2, r3], widths));
    }
    if (exam.showInstructions !== false && exam.instructions) out.push(k.para(exam.instructions, { before: 60, size: 11 }));
    return out;
  }

  function figPara(k, q, imgs) {
    var im = imgs['fig:' + q.id];
    if (!im) return [];
    var al = k.d.AlignmentType, a = q.figureAlign === 'start' ? al.RIGHT : q.figureAlign === 'end' ? al.LEFT : al.CENTER;
    var out = [new k.d.Paragraph({ children: [new k.d.ImageRun({ data: im.bytes, transformation: { width: im.w, height: im.h } })], alignment: a })];
    if (q.figureCaption) out.push(k.para(q.figureCaption, { size: 10, center: true, after: 40 }));
    return out;
  }
  /* الشكل فوق السؤال أو تحته أو بعد مساحة الإجابة (الوضع الجانبي يُطبع تحت السؤال في Word) */
  function withFig(k, q, imgs, stem, rest) {
    var f = figPara(k, q, imgs), pos = q.figurePos || 'below';
    if (pos === 'above') return f.concat(stem, rest);
    if (pos === 'after') return stem.concat(rest, f);
    return stem.concat(f, rest);
  }
  function linesParas(k, n) { var o = []; for (var i = 0; i < n; i++) o.push(k.para('.....................................................................................................................', { size: 11, after: 40, color: '6B7280' })); return o; }
  function blankify(s) { return String(s || '').replace(/\[\[(.+?)\]\]/g, '……………………'); }

  function sectionBlocks(k, exam, sec, idx, imgs) {
    var d = k.d, out = [], L = exam.lang === 'en' ? M.EN_LETTERS : M.AR_LETTERS;
    var title = sec.title || M.TYPE[sec.type].title, si = M.secInfo(exam), inf = si.info[idx];
    if (!inf.hasParts) out.push(k.para([k.run('السؤال ' + M.ordinal(inf.main) + ': ', { bold: true, size: 13, color: '1F2A44' }), k.run(title, { bold: true, size: 13 }), k.run('   (' + M.gradeWord(M.sectionGrade(exam, sec)) + ')', { bold: true, size: 11 })], { before: 160, after: 80, bottomLine: true }));
    else {
      var grp = si.groups[inf.main];
      if (inf.first) out.push(k.para([k.run('السؤال ' + M.ordinal(inf.main) + ': ', { bold: true, size: 13, color: '1F2A44' }), k.run(exam.sections[grp.start].mainTitle || 'أجب عن الأسئلة الآتية:', { bold: true, size: 13 }), k.run('   (' + M.gradeWord(M.groupGrade(exam, grp)) + ')', { bold: true, size: 11 })], { before: 160, after: 60, bottomLine: true }));
      out.push(k.para([k.run('(' + M.partLabel(exam, inf.part) + ') ', { bold: true, size: 13, color: '1F2A44' }), k.run(title, { bold: true, size: 12 }), k.run('   (' + M.gradeWord(M.sectionGrade(exam, sec)) + ')', { size: 10 })], { before: 80, after: 60 }));
    }
    if (sec.type === 'tf') {
      var rows = sec.items.map(function (it, i) { var q = M.itemQ(exam, it); return [k.cell(String(i + 1), { w: 600, center: true }), k.cell(blankify(q.text), { w: 8666 }), k.cell('(       )', { w: 1200, center: true })]; });
      out.push(k.table(rows, [600, 8666, 1200]));
      return out;
    }
    if (sec.type === 'match') {
      var ml = M.matchLayout(exam, sec), n = Math.max(ml.A.length, ml.B.length);
      var mr = [[k.cell('العمود (أ)', { w: 4400, bold: true, center: true, shade: 'F1F3F6' }), k.cell('', { w: 1666 }), k.cell('العمود (ب)', { w: 4400, bold: true, center: true, shade: 'F1F3F6' })]];
      for (var r = 0; r < n; r++) {
        mr.push([k.cell(ml.A[r] ? (r + 1) + ') ' + ml.A[r].a : '', { w: 4400 }), k.cell('', { w: 1666 }), k.cell(ml.B[r] ? '(' + L[r] + ') ' + ml.B[r].text : '', { w: 4400 })]);
      }
      out.push(k.table(mr, [4400, 1666, 4400]));
      return out;
    }
    if (sec.type === 'complete' && sec.wordBank !== false) {
      var wb = M.wordBank(exam, sec);
      if (wb.length) out.push(k.table([[k.cell(wb.join('     ـ     '), { w: W, center: true, bold: true })]], [W]));
    }
    sec.items.forEach(function (it, i) {
      var q = M.itemQ(exam, it); if (!q) return;
      var no = sec.items.length === 1 ? '' : (i + 1) + ') ';
      if (sec.type === 'mcq') {
        var mq = [], fq = figPara(k, q, imgs), pos = q.figurePos || 'below';
        if (pos === 'above') mq = mq.concat(fq);
        mq.push(k.para(no + blankify(q.text), { after: 20 }));
        if (pos !== 'above' && pos !== 'after') mq = mq.concat(fq);
        out = out.concat(mq);
        var order = M.mcqOrder(exam, sec, q), opts = order.map(function (j) { return q.options[j]; });
        var m = 0; opts.forEach(function (o) { m = Math.max(m, String(o).length); });
        var cols = m <= 10 ? 4 : (m <= 26 ? 2 : 1), cw = Math.floor((W - 400) / cols), rowsO = [], row = [];
        opts.forEach(function (o, j) { row.push(k.cell('○ ' + L[j] + ') ' + o, { w: cw })); if (row.length === cols) { rowsO.push(row); row = []; } });
        if (row.length) { while (row.length < cols) row.push(k.cell('', { w: cw })); rowsO.push(row); }
        var ws = []; for (var c = 0; c < cols; c++) ws.push(cw);
        out.push(k.table(rowsO, ws, { noBorder: true }));
        if (pos === 'after') out = out.concat(fq);
      } else if (sec.type === 'term') {
        out = out.concat(withFig(k, q, imgs, [k.para(no + q.text + '   (………………………………)')], []));
      } else if (sec.type === 'complete') {
        out = out.concat(withFig(k, q, imgs, [k.para(no + blankify(q.text))], []));
      } else if (sec.type === 'image') {
        out.push(k.para(no + q.text));
        var im = imgs[q.id];
        if (im) out.push(new d.Paragraph({ children: [new d.ImageRun({ data: im.bytes, transformation: { width: im.w, height: im.h } })], alignment: d.AlignmentType.CENTER }));
        out.push(k.table(q.labels.map(function (l) { return [k.cell(String(l.n), { w: 900, center: true }), k.cell('……………………………', { w: 4000 })]; }), [900, 4000]));
      } else if (sec.type === 'draw') {
        out = out.concat(withFig(k, q, imgs, [k.para(no + q.text)], [k.table([[k.cell('', { w: W })]], [W], { height: Math.round((Number(q.drawHeight) || 140) * 15) })]));
      } else {
        out = out.concat(withFig(k, q, imgs, [k.para(no + q.text, { after: 20 })], linesParas(k, Number(q.lines) || 0)));
      }
    });
    return out;
  }

  function footer(k, exam) {
    var d = k.d, doc = exam.docId ? M.byId('docs', exam.docId) : M.docFor('exam');
    var note = exam.footerNote != null ? exam.footerNote : 'مع أطيب التمنيات بالنجاح والتوفيق';
    return new d.Footer({ children: [].concat(note ? [new d.Paragraph({ bidirectional: true, alignment: d.AlignmentType.CENTER, children: [k.run(note, { size: 10, bold: true })] })] : [], [new d.Paragraph({ bidirectional: true, alignment: d.AlignmentType.CENTER, children: [
      k.run((doc ? doc.code + ' · الإصدار ' + doc.version + ' · ' : '') + 'صفحة ', { size: 9 }),
      new d.TextRun({ children: [d.PageNumber.CURRENT], size: 18, font: FONT }), k.run(' من ', { size: 9 }),
      new d.TextRun({ children: [d.PageNumber.TOTAL_PAGES], size: 18, font: FONT })] })]) });
  }

  function save(doc, name) {
    return D().Packer.toBlob(doc).then(function (blob) { M.download(name, blob); });
  }

  function pageProps() { return { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }; }

  M.exportExamWord = function (exam) {
    var k = mk(exam.digits);
    var cen = M.S.settings.center || {};
    var jobs = [];
    var logo = null, imgs = {};
    if (cen.logo) jobs.push(imgSize(cen.logo, 70, 70).then(function (s) { logo = { bytes: b64ToBytes(cen.logo), w: s.w, h: s.h }; }));
    exam.sections.forEach(function (sec) { sec.items.forEach(function (it) { var q = M.itemQ(exam, it); if (q && q.type === 'image' && q.image) jobs.push(imgSize(q.image, 300, 220).then(function (s) { imgs[q.id] = { bytes: b64ToBytes(q.image), w: s.w, h: s.h }; }));
      if (q && q.figure) jobs.push(imgSize(q.figure, Math.round(600 * (Number(q.figureWidth) || 60) / 100), 300).then(function (s) { imgs['fig:' + q.id] = { bytes: b64ToBytes(q.figure), w: s.w, h: s.h }; })); }); });
    return Promise.all(jobs).then(function () {
      var kids = headerBlocks(k, exam, logo);
      exam.sections.forEach(function (sec, i) { kids = kids.concat(sectionBlocks(k, exam, sec, i, imgs)); });
      kids.push(k.para(exam.lang === 'en' ? 'End of questions' : 'انتهت الأسئلة', { bold: true, center: true, before: 200 }));
      if (exam.showSign !== false) kids.push(k.table([[k.cell('توقيع المصحح', { w: 3488, center: true }), k.cell('توقيع المراجع', { w: 3489, center: true }), k.cell('رئيس اللجنة', { w: 3489, center: true })]], [3488, 3489, 3489], { noBorder: true }));
      var doc = new k.d.Document({ creator: 'معيار', title: exam.title || 'امتحان', styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
        sections: [{ properties: pageProps(), footers: { default: footer(k, exam) }, children: kids }] });
      M.log('تصدير Word', exam.title + (exam.model ? ' — نموذج ' + exam.model : ''));
      return save(doc, (exam.title || 'امتحان') + (exam.model ? '-نموذج-' + exam.model : '') + '.docx');
    });
  };

  M.exportKeyWord = function (exam) {
    var k = mk(exam.digits), L = exam.lang === 'en' ? M.EN_LETTERS : M.AR_LETTERS;
    var kids = headerBlocks(k, Object.assign({}, exam, { showStudent: false, showGradeTable: false, showInstructions: false }), null);
    kids.push(k.para('مفتاح ونموذج الإجابة', { bold: true, size: 15, center: true, before: 120 }));
    var KS = M.secInfo(exam);
    exam.sections.forEach(function (sec, idx) {
      var ki = KS.info[idx];
      kids.push(k.para('السؤال ' + M.ordinal(ki.main) + (ki.hasParts ? ' (' + M.partLabel(exam, ki.part) + ')' : '') + ': ' + (sec.title || M.TYPE[sec.type].title) + ' (' + M.gradeWord(M.sectionGrade(exam, sec)) + ')', { bold: true, before: 120, bottomLine: true }));
      var rows = [];
      if (sec.type === 'match') {
        var ml = M.matchLayout(exam, sec);
        ml.A.forEach(function (p, i) { var j = ml.B.findIndex(function (b) { return b.pair === p; }); rows.push([k.cell(String(i + 1), { w: 700, center: true }), k.cell(p.a + ' ← (' + L[j] + ') ' + p.b, { w: 8266 }), k.cell('', { w: 1500 })]); });
      } else sec.items.forEach(function (it, i) {
        var q = M.examQ(exam, it.qid); if (!q) return;
        var a = q.type === 'mcq' ? L[M.mcqOrder(exam, sec, q).indexOf(Number(q.correct))] + ') ' + q.options[q.correct] : M.answerText(q);
        rows.push([k.cell(String(i + 1), { w: 700, center: true }), k.cell(String(a).split('\n').map(function (ln) { return k.para(ln, { after: 0 }); }), { w: 8266 }), k.cell(M.gradeWord(M.itemGrade(exam, it)), { w: 1500, center: true })]);
      });
      if (rows.length) kids.push(k.table(rows, [700, 8266, 1500]));
    });
    var doc = new k.d.Document({ creator: 'معيار', sections: [{ properties: pageProps(), footers: { default: footer(k, exam) }, children: kids }] });
    return save(doc, 'مفتاح-الإجابة-' + (exam.title || '') + (exam.model ? '-' + exam.model : '') + '.docx');
  };

  M.exportSpecWord = function (exam) {
    var k = mk(exam.digits), dd = M.specData(exam);
    var kids = headerBlocks(k, Object.assign({}, exam, { showStudent: false, showGradeTable: false, showInstructions: false }), null);
    kids.push(k.para('جدول المواصفات', { bold: true, size: 15, center: true, before: 120 }));
    var widths = [2600, 1100, 1100, 1416, 1416, 1416, 1418];
    var rows = [['الدرس', 'الوزن النسبي', 'الدرجة المستهدفة'].concat(M.LEVELS).concat([]).map(function (h, i) { return k.cell(h, { w: widths[i], bold: true, size: 10, shade: 'F1F3F6', center: true }); })];
    rows[0].push(k.cell('الفعلية', { w: 1000, bold: true, size: 10, shade: 'F1F3F6', center: true })); widths.push(1000);
    dd.rows.forEach(function (r) {
      rows.push([k.cell(r.lesson.name, { w: widths[0], size: 10 }), k.cell(Math.round(r.weight * 100) + '%', { w: widths[1], size: 10, center: true }), k.cell(String(Math.round(r.targetGrade * 10) / 10), { w: widths[2], size: 10, center: true })]
        .concat(r.grd.map(function (g, i) { return k.cell(r.cnt[i] + ' فرع / ' + g + ' درجة', { w: widths[3 + i], size: 9, center: true }); }))
        .concat([k.cell(String(r.actual), { w: 1000, size: 10, center: true, bold: true })]));
    });
    rows.push([k.cell('المجموع', { w: widths[0], bold: true }), k.cell('100%', { w: widths[1], center: true }), k.cell(String(dd.total), { w: widths[2], center: true })]
      .concat(dd.levelGrades.map(function (g, i) { return k.cell(g + ' (' + Math.round(g / dd.total * 100) + '% من ' + dd.targets[i] + '%)', { w: widths[3 + i], size: 9, center: true, bold: true }); }))
      .concat([k.cell(String(M.examTotal(exam)), { w: 1000, center: true, bold: true })]));
    kids.push(k.table(rows, widths));
    var doc = new k.d.Document({ creator: 'معيار', sections: [{ properties: { page: { size: { width: 16838, height: 11906, orientation: k.d.PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, footers: { default: footer(k, exam) }, children: kids }] });
    return save(doc, 'جدول-المواصفات-' + (exam.title || '') + '.docx');
  };

  M.exportBankWord = function (questions, title) {
    var k = mk(M.S.settings.digits), doc0 = M.docFor('bank'), cen = M.S.settings.center || {};
    var kids = [k.table([[k.cell([k.para(cen.name || '', { bold: true, center: true })], { w: 5233 }), k.cell(doc0 ? [k.para('اسم الوثيقة: ' + doc0.name, { size: 10, after: 0 }), k.para('كود الوثيقة: ' + doc0.code + ' — الإصدار ' + doc0.version, { size: 10, after: 0 })] : [k.para('—')], { w: 5233 })]], [5233, 5233]),
      k.para(title || 'بنك الأسئلة', { bold: true, size: 16, center: true, before: 160, after: 120 })];
    var byLesson = {};
    questions.forEach(function (q) { (byLesson[q.lessonId] = byLesson[q.lessonId] || []).push(q); });
    Object.keys(byLesson).forEach(function (lid) {
      var p = M.lessonPath(lid);
      kids.push(k.para((p.unit ? p.unit.name + ' — ' : '') + (p.lesson ? p.lesson.name : 'بدون درس'), { bold: true, size: 13, before: 160, bottomLine: true }));
      var rows = [['م', 'النوع', 'السؤال', 'الإجابة', 'المستوى', 'الدرجة'].map(function (h, i) { return k.cell(h, { w: [500, 1300, 4766, 2400, 900, 600][i], bold: true, size: 10, shade: 'F1F3F6', center: true }); })];
      byLesson[lid].forEach(function (q, i) {
        var txt = q.text + (q.type === 'mcq' ? '\n' + q.options.map(function (o, j) { return M.AR_LETTERS[j] + ') ' + o; }).join('   ') : '') + (q.type === 'match' ? '\n' + q.pairs.map(function (x) { return x.a + ' ← ' + x.b; }).join('\n') : '');
        rows.push([k.cell(String(i + 1), { w: 500, size: 10, center: true }), k.cell(M.TYPE[q.type].label, { w: 1300, size: 10 }),
          k.cell(txt.split('\n').map(function (ln) { return k.para(blankify(ln), { size: 10, after: 0 }); }), { w: 4766 }),
          k.cell(String(M.answerText(q) || '').split('\n').map(function (ln) { return k.para(ln, { size: 10, after: 0 }); }), { w: 2400 }),
          k.cell(M.LEVELS[q.level] || '', { w: 900, size: 10 }), k.cell(String(q.grade), { w: 600, size: 10, center: true })]);
      });
      kids.push(k.table(rows, [500, 1300, 4766, 2400, 900, 600]));
    });
    var doc = new k.d.Document({ creator: 'معيار', sections: [{ properties: pageProps(), children: kids }] });
    M.log('تصدير Word', title || 'بنك الأسئلة', 'أسئلة: ' + questions.length);
    return save(doc, (title || 'بنك-الأسئلة') + '-' + M.today() + '.docx');
  };
})(window.M);
