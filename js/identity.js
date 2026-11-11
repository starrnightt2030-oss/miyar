/* هوية المؤسسة: الشعارات وسطور الترويسة والإعدادات الافتراضية — بمعاينة حية للترويسة */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;

  M.views.identity = function (main) {
    var cen = JSON.parse(JSON.stringify(S.settings.center || {}));
    if (!cen.lines || !cen.lines.length) cen.lines = [cen.directorate || 'وزارة التربية والتعليم والتعليم الفني', cen.address || '', cen.name || ''];
    while (cen.lines.length < 4) cen.lines.push('');
    var D = Object.assign({}, M.examDefaults(), S.settings.examDefaults || {});
    var year = S.settings.year || '';

    function logoBox(k, label, hint) {
      return '<div class="id-logo">' + (cen[k] ? '<img src="' + cen[k] + '" alt="' + label + '">' : '<span class="ph">' + I('t_image', 28) + '</span>') +
        '<b>' + label + '</b><span class="small muted">' + hint + '</span><div class="row" style="gap:6px;justify-content:center"><button type="button" class="btn sm" data-up="' + k + '">' + (cen[k] ? 'تغيير' : 'رفع') + '</button>' + (cen[k] ? '<button type="button" class="btn sm ghost" data-rm="' + k + '">إزالة</button>' : '') + '</div></div>';
    }
    function draw() {
      main.innerHTML = M.topbar('هوية المؤسسة', 'تُطبع تلقائياً في ترويسة كل امتحان — تضبطها مرة واحدة') +
        '<div class="content"><div class="id-wrap"><div class="id-form">' +
        '<div class="card"><h2>الشعارات</h2><div class="id-logos">' + logoBox('logo', 'شعار المدرسة', 'تُقص الحواف البيضاء تلقائياً') + logoBox('logo2', 'شعار ثانٍ (اختياري)', 'مثل شعار الوزارة — يظهر على الجهة الأخرى') + '</div>' +
        '<div class="field"><span class="lbl">مكان الشعار في الترويسة</span><div class="seg" id="id-side"><button type="button" data-v="right" class="' + (cen.logoSide !== 'left' ? 'on' : '') + '">يمين مع البيانات</button><button type="button" data-v="left" class="' + (cen.logoSide === 'left' ? 'on' : '') + '">يسار الورقة</button></div><span class="small muted">«يسار الورقة» يحل محل مربع وثيقة الجودة عند إخفائه.</span></div></div>' +
        '<div class="card"><h2>سطور الترويسة</h2><p class="small muted" style="margin:4px 0 10px">حتى ٤ سطور — آخر سطر مكتوب يُطبع بخط عريض (اسم المدرسة).</p><div style="display:flex;flex-direction:column;gap:8px">' +
        cen.lines.slice(0, 4).map(function (l, i) { return '<input class="inp paper-font" data-line="' + i + '" value="' + esc(l) + '" placeholder="' + ['وزارة التربية والتعليم والتعليم الفني', 'مديرية التربية والتعليم ب…', 'إدارة … التعليمية', 'مدرسة … الثانوية الصناعية'][i] + '" aria-label="السطر ' + (i + 1) + '">'; }).join('') + '</div></div>' +
        '<div class="card"><h2>الإعدادات الافتراضية لكل امتحان جديد</h2><div class="grid2" style="margin-top:10px">' +
        '<div class="field"><label for="id-year">العام الدراسي</label><input id="id-year" class="inp" value="' + esc(year) + '"></div>' +
        '<div class="field"><label for="id-dur">الزمن</label><input id="id-dur" class="inp" value="' + esc(D.duration || '') + '"></div>' +
        '<div class="field"><label for="id-cls">الصف الدراسي</label><input id="id-cls" class="inp" value="' + esc(D.className || '') + '"></div>' +
        '<div class="field"><label for="id-spc">التخصص</label><input id="id-spc" class="inp" value="' + esc(D.specialization || '') + '"></div></div>' +
        '<div class="field"><label for="id-foot">جملة أسفل الورقة</label><input id="id-foot" class="inp" value="' + esc(S.settings.footerNote != null ? S.settings.footerNote : 'مع أطيب التمنيات بالنجاح والتوفيق') + '"></div>' +
        '<div class="field"><span class="lbl">القالب</span><div class="seg wrap" id="id-tpl">' + M.TEMPLATES.map(function (t) { return '<button type="button" data-v="' + t.id + '" class="' + ((D.theme || 'classic') === t.id ? 'on' : '') + '">' + t.name + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">اللون</span><div class="sw-row">' + M.ACCENTS.map(function (c) { return '<button type="button" class="swc' + ((D.color || '#1F2A44').toLowerCase() === c[0].toLowerCase() ? ' on' : '') + '" data-col="' + c[0] + '" style="background:' + c[0] + '" aria-label="' + c[1] + '"></button>'; }).join('') + '</div></div></div>' +
        '<div class="card"><div class="row"><div style="flex:1"><h2>وثيقة الجودة</h2><span class="small muted">' + (M.docFor('exam') ? 'مسجّلة: ' + esc(M.docFor('exam').name + ' — ' + M.docFor('exam').code) : 'لم تُسجل وثيقة «ورقة امتحان» بعد') + '</span></div><a class="btn" href="#/docs">' + I('docs', 16) + ' وثائق الجودة</a></div></div>' +
        '</div><aside class="id-pv"><div class="small muted bold" style="margin-bottom:8px">معاينة الترويسة</div><div class="id-pvbox" id="id-pv"></div></aside></div></div>';
      bind(); preview();
    }
    var preview = M.debounce(function () {
      var box = M.qs('#id-pv', main); if (!box) return;
      var old = S.settings.center; S.settings.center = cen;
      var ex = M.newExam(''); ex.title = 'امتحان نهاية الفصل الدراسي الأول'; ex.subjectName = 'المادة'; ex.sections = []; ex.theme = D.theme; ex.color = D.color; ex.year = year; ex.showGradeTable = false; ex.showInstructions = false; ex.footerNote = '';
      var pg = ''; try { pg = M.renderExamPages(ex)[0]; } catch (x) { pg = ''; }
      S.settings.center = old;
      var w = box.clientWidth || 380, sc = Math.min(1, w / 794);
      box.innerHTML = '<div style="height:' + Math.round(300 * sc) + 'px;overflow:hidden"><div style="width:794px;transform:scale(' + sc + ');transform-origin:top right">' + pg + '</div></div>';
    }, 120);
    var save = M.debounce(function () {
      cen.lines = cen.lines.map(function (l) { return String(l || '').trim(); });
      var filled = cen.lines.filter(Boolean);
      cen.name = filled[filled.length - 1] || cen.name || '';
      M.setSetting('center', cen); M.setSetting('year', year);
      M.setSetting('examDefaults', Object.assign({}, S.settings.examDefaults || {}, D));
      M.refreshNav && M.refreshNav();
    }, 400);
    function bind() {
      M.qsa('[data-line]', main).forEach(function (el) { el.oninput = function () { cen.lines[+el.dataset.line] = el.value; preview(); save(); }; });
      M.qsa('[data-up]', main).forEach(function (b) {
        b.onclick = function () {
          M.pickFile('image/*').then(function (f) {
            if (!f[0]) return;
            return M.readFile(f[0], 'dataurl').then(function (d) { return M.shrinkImage(d, 600); }).then(M.trimWhite).then(function (d) { cen[b.dataset.up] = d; save(); draw(); M.toast('تم رفع الشعار', 'ok'); });
          });
        };
      });
      M.qsa('[data-rm]', main).forEach(function (b) { b.onclick = function () { cen[b.dataset.rm] = ''; save(); draw(); }; });
      M.qsa('#id-side button', main).forEach(function (b) { b.onclick = function () { cen.logoSide = b.dataset.v; M.qsa('#id-side button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); save(); }; });
      M.qsa('#id-tpl button', main).forEach(function (b) { b.onclick = function () { D.theme = b.dataset.v; M.qsa('#id-tpl button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); save(); }; });
      M.qsa('[data-col]', main).forEach(function (b) { b.onclick = function () { D.color = b.dataset.col; M.qsa('[data-col]', main).forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); save(); }; });
      var t = function (id, fn) { var el = M.qs(id, main); if (el) el.oninput = function () { fn(el.value); save(); preview(); }; };
      t('#id-year', function (v) { year = v; }); t('#id-dur', function (v) { D.duration = v; }); t('#id-cls', function (v) { D.className = v; }); t('#id-spc', function (v) { D.specialization = v; });
      t('#id-foot', function (v) { M.setSetting('footerNote', v); });
    }
    draw();
    return { destroy: function () { save.flush ? save.flush() : null; } };
  };
})(window.M);
