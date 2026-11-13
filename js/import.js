/* استيراد أسئلة جاهزة (نص ملصوق أو صور ورقة أسئلة) وتحويلها لأسئلة منسّقة في الورقة
   دور الذكاء الاصطناعي هنا: ينقل الأسئلة كما هي ويحدّد أنواعها، ويقصّ الرسومات من الصور */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;
  var TYPES = ['mcq', 'tf', 'complete', 'match', 'term', 'reason', 'essay', 'draw', 'problem'];

  var QS = { type: 'object', additionalProperties: false,
    required: ['text', 'options', 'correct', 'answer', 'correction', 'pairs', 'extras', 'term', 'modelAnswer', 'grade', 'lines', 'sure', 'figure'],
    properties: {
      text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correct: { type: 'integer' },
      answer: { type: 'boolean' }, correction: { type: 'string' },
      pairs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'string' } } } },
      extras: { type: 'array', items: { type: 'string' } }, term: { type: 'string' }, modelAnswer: { type: 'string' },
      grade: { type: 'number' }, lines: { type: 'integer' }, sure: { type: 'boolean' },
      figure: { type: 'object', additionalProperties: false, required: ['img', 'box'], properties: { img: { type: 'integer' }, box: { type: 'array', items: { type: 'integer' } } } }
    } };
  var SCHEMA = { type: 'object', additionalProperties: false, required: ['groups'], properties: { groups: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['mainTitle', 'parts'], properties: {
      mainTitle: { type: 'string' },
      parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'type', 'questions'], properties: {
        title: { type: 'string' }, type: { type: 'string', enum: TYPES }, questions: { type: 'array', items: QS } } } } } } } } };

  var SYSTEM = 'أنت محوّل دقيق لأوراق امتحانات عربية (تعليم فني صناعي) إلى بيانات منظّمة. تنقل الأسئلة كما هي حرفياً — لا تؤلف أسئلة جديدة ولا تحذف ولا تعيد الصياغة — وتحدد نوع كل فرع وإجابته.';
  function rules(hasImages) {
    return 'حوّل الأسئلة إلى JSON بهذا التنظيم:\n' +
      '- groups: الأسئلة الرئيسية بالترتيب (السؤال الأول، الثاني…). mainTitle: نص السؤال الرئيسي إن كان له أجزاء (مثل «أجب عن الأسئلة الآتية»)، وإلا "".\n' +
      '- parts: أجزاء السؤال الرئيسي (أ)، (ب)… وإن لم تكن له أجزاء فجزء واحد. title: سطر التعليمات كما هو (مثل «اختر الإجابة الصحيحة مما بين القوسين»). type: نوع فروع هذا الجزء.\n' +
      '- الأنواع: mcq اختيار من متعدد · tf صح وخطأ · complete أكمل · match توصيل · term مصطلح علمي · reason علّل · essay مقالي/اذكر/عرّف/قارن · draw ارسم · problem مسألة حسابية.\n' +
      '- لكل فرع: text نص الفرع بدون رقمه. mcq: options الاختيارات بدون الحروف، وcorrect رقم الصحيح من 0. tf: answer وcorrection تصويب الخطأ. complete: ضع الإجابة مكان الفراغ بين [[ و ]]. match: pairs كل عنصر من (أ) مع ما يقابله صحيحاً من (ب)، وextras البدائل الزائدة. term: text التعريف وterm المصطلح. reason/essay/problem/draw: modelAnswer إجابة نموذجية مختصرة، وlines عدد سطور مناسب للإجابة.\n' +
      '- الإجابات: إذا كانت موجودة في المصدر استخدمها وsure=true. إن لم تكن موجودة فلا تستنتجها: sure=false واترك الإجابة فارغة (correct=-1، وفي أكمل اكتب [[؟]] مكان الفراغ).\n' +
      '- الكلمات غير المقروءة لا تخمّنها: اكتب مكانها ⟦؟⟧.\n' +
      '- grade: درجة الفرع إن كانت مكتوبة (وإن كُتبت درجة السؤال كله فقسّمها على فروعه)، وإلا 0.\n' +
      '- المعادلات بصيغة $...$ (مثل $\\frac{1}{2}$ و $س^{2}$)، والأرقام كما في المصدر.\n' +
      '- الحقول غير المستخدمة: نص فارغ "" أو قائمة فارغة [] أو 0 أو false.\n' +
      (hasImages ? '- figure: إذا كان للفرع رسم أو شكل أو دائرة أو جدول مصوّر داخل الصورة، فـ img رقم الصورة (يبدأ من 0)، وbox مستطيل الرسم فقط بالترتيب [ymin, xmin, ymax, xmax] بمقياس 0 إلى 1000 من أبعاد الصورة. بدون رسم: img = -1 وbox = [].\n'
        : '- figure: img = -1 وbox = [] دائماً.\n') +
      '- تجاهل الترويسة وبيانات الطالب وأرقام الصفحات.';
  }

  function toQuestion(x, type) {
    var q = M.newQuestion(type, ''); q.subjectId = ''; q.source = 'ai-import'; q.solLines = 0;
    q.text = String(x.text || '').trim();
    if (type === 'mcq') { q.options = (x.options || []).map(String).filter(function (o) { return o.trim(); }).slice(0, 6); while (q.options.length < 2) q.options.push(''); q.correct = Number(x.correct) >= 0 && Number(x.correct) < q.options.length ? Number(x.correct) : null; }
    if (type === 'tf') { q.answer = x.answer !== false; q.correction = x.correction || ''; }
    if (type === 'match') { q.pairs = (x.pairs || []).filter(function (p) { return p && (p.a || p.b); }); if (q.pairs.length < 2) q.pairs.push({ a: '', b: '' }); q.extras = (x.extras || []).filter(Boolean); }
    if (type === 'complete') { q.extras = (x.extras || []).filter(Boolean); if (!/\[\[/.test(q.text)) q.text = q.text.replace(/[.…]{3,}|_{3,}/, '[[……]]'); }
    if (type === 'term') q.term = x.term || '';
    q.modelAnswer = x.modelAnswer || '';
    q.grade = Number(x.grade) > 0 ? Number(x.grade) : M.TYPE[type].grade;
    if (['reason', 'essay', 'problem'].indexOf(type) >= 0 && Number(x.lines) > 0) q.lines = Math.min(15, Number(x.lines));
    q._sure = x.sure !== false;
    /* بلا إجابة في المصدر: تبقى «غير محددة» — لا قيمة افتراضية تتحول لإجابة معتمدة */
    if (!q._sure) {
      if (type === 'mcq') q.correct = null;
      if (type === 'tf') { q.answer = null; q.correction = ''; }
      if (type === 'term') q.term = '';
      if (type === 'complete') q.text = q.text.replace(/\[\[(.*?)\]\]/g, '[[' + M.BLANK_UNKNOWN + ']]');
      if (type === 'match') q.matchUnknown = true;
      q.modelAnswer = '';
    }
    q.ans = M.hasAnswer(q) ? 'source' : 'none';
    q.unclear = q.text.indexOf(M.UNCLEAR) >= 0;
    return q;
  }
  function cropFigure(q, x, images) {
    var f = x.figure || {}, b = f.box || [];
    if (!(f.img >= 0) || !images[f.img] || b.length !== 4) return Promise.resolve(q);
    var y0 = Math.max(0, b[0] / 1000 - 0.01), x0 = Math.max(0, b[1] / 1000 - 0.01), y1 = Math.min(1, b[2] / 1000 + 0.01), x1 = Math.min(1, b[3] / 1000 + 0.01);
    if (y1 - y0 < 0.03 || x1 - x0 < 0.03) return Promise.resolve(q);
    return M.cropImage(images[f.img], { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }).then(function (d) { q.figure = d; q.figureWidth = Math.round(Math.min(70, Math.max(30, (x1 - x0) * 100))); q.figurePos = 'below'; q._figSrc = { img: f.img, box: [y0, x0, y1, x1] }; return q; });
  }
  function convert(data, images) {
    var groups = (data && data.groups) || [], jobs = [];
    var out = groups.map(function (g) {
      return { mainTitle: g.parts && g.parts.length > 1 ? (g.mainTitle || '') : '', parts: (g.parts || []).filter(function (p) { return p && TYPES.indexOf(p.type) >= 0 && (p.questions || []).length; }).map(function (p) {
        var qs = (p.questions || []).map(function (x) { var q = toQuestion(x, p.type); jobs.push(cropFigure(q, x, images)); return q; });
        return { title: p.title || '', type: p.type, questions: qs };
      }) };
    }).filter(function (g) { return g.parts.length; });
    return Promise.all(jobs).then(function () { return out; });
  }

  M.importDialog = function (onAdd) {
    var images = [], routes = M.aiRoutes(), mode = 'img';
    var routeLabel = function (r) { return M.AI_PROVIDERS[r.provider].name + (r.via === 'cloud' ? ' — عبر الخادم' : ' — بمفتاحك'); };
    M.modal({ title: 'استيراد أسئلة جاهزة', wide: true,
      body: '<div class="imp">' +
        '<p class="small muted" style="margin:0">الصق نص الأسئلة أو صوّر ورقة الأسئلة، وسيحوّلها الذكاء الاصطناعي لأسئلة منسّقة في ورقتك — بنفس تقسيمها، مع قصّ الرسومات تلقائياً. تراجعها قبل الإضافة.</p>' +
        '<div class="seg" id="imp-m"><button type="button" data-v="img" class="on">' + I('camera', 16) + ' صورة الأسئلة</button><button type="button" data-v="txt">' + I('paste', 16) + ' لصق نص</button></div>' +
        '<div id="imp-img"><div class="imp-thumbs" id="imp-th"></div><div class="row"><button type="button" class="btn" id="imp-add">' + I('t_image', 16) + ' اختيار صور</button><button type="button" class="btn" id="imp-cam">' + I('camera', 16) + ' تصوير</button></div></div>' +
        '<div id="imp-txt" hidden><textarea class="inp paper-font" id="imp-t" rows="8" placeholder="الصق هنا نص الأسئلة كما هو — مثال:&#10;السؤال الأول: اختر الإجابة الصحيحة:&#10;١) وحدة قياس المقاومة هي (الأوم – الفولت – الأمبير)"></textarea></div>' +
        (routes.length ? '<div class="grid2"><div class="field"><label for="imp-r">المزود</label><select id="imp-r" class="inp">' + routes.map(function (r, i) { return '<option value="' + i + '">' + esc(routeLabel(r)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="imp-md">النموذج</label><select id="imp-md" class="inp"><option>جارٍ التحميل…</option></select></div></div>'
          : '<div class="alert info">' + I('spark') + '<div style="flex:1">أضف مفتاح Gemini المجاني (أو Claude/ChatGPT) من الإعدادات ليعمل التحويل مباشرة.</div><a class="btn sm" href="#/settings">الإعدادات</a></div>') +
        '<div id="imp-st"></div>' +
        '<details class="small"><summary style="cursor:pointer;font-weight:600">بدون مفتاح؟ انسخ الطلب لأي نموذج خارجي ثم الصق الرد</summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px"><button type="button" class="btn sm" id="imp-copy" style="align-self:flex-start">' + I('copy', 15) + ' نسخ الطلب</button><span class="muted">أرسل الطلب مع نفس الصور بنفس الترتيب، ثم الصق رد JSON هنا:</span><textarea class="inp" id="imp-j" rows="4" dir="ltr" placeholder="{ &quot;groups&quot;: [ ... ] }"></textarea><button type="button" class="btn sm" id="imp-pj" style="align-self:flex-start">تحويل الرد الملصوق</button></div></details></div>',
      foot: '<button class="btn pri" data-ok' + (routes.length ? '' : ' disabled') + '>' + I('spark', 16) + ' تحويل</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var th = M.qs('#imp-th', m), st = M.qs('#imp-st', m);
        var drawThumbs = function () { th.innerHTML = images.map(function (d, i) { return '<span class="imp-t"><img src="' + d + '" alt="صورة ' + n(i + 1) + '"><b>' + n(i + 1) + '</b><button type="button" data-rm="' + i + '" aria-label="حذف">' + I('x', 14) + '</button></span>'; }).join('') || '<span class="small muted">لم تُضف صور بعد — حتى ٦ صفحات، صورة واضحة لكل صفحة.</span>'; M.qsa('[data-rm]', th).forEach(function (b) { b.onclick = function () { images.splice(+b.dataset.rm, 1); drawThumbs(); }; }); };
        var add = function (files) { Promise.all(files.slice(0, 6 - images.length).map(function (f) { return M.readFile(f, 'dataurl').then(function (d) { return M.shrinkImage(d, 2000); }); })).then(function (ds) { images = images.concat(ds); drawThumbs(); }); };
        drawThumbs();
        M.qsa('#imp-m button', m).forEach(function (b) { b.onclick = function () { mode = b.dataset.v; M.qsa('#imp-m button', m).forEach(function (x) { x.classList.toggle('on', x === b); }); M.qs('#imp-img', m).hidden = mode !== 'img'; M.qs('#imp-txt', m).hidden = mode !== 'txt'; }; });
        M.qs('#imp-add', m).onclick = function () { M.pickFile('image/*', true).then(add); };
        M.qs('#imp-cam', m).onclick = function () { var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.setAttribute('capture', 'environment'); i.onchange = function () { add(Array.prototype.slice.call(i.files || [])); }; i.click(); };
        var rs = M.qs('#imp-r', m), ms = M.qs('#imp-md', m);
        var loadModels = function () {
          var r = routes[+rs.value]; ms.innerHTML = '<option>جارٍ التحميل…</option>';
          M.aiListModels(r).then(function (list) { var def = M.aiDefaultModel(r.provider, list); ms.innerHTML = list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === def ? ' selected' : '') + '>' + esc(x.label || x.id) + '</option>'; }).join(''); })
            .catch(function (er) { ms.innerHTML = '<option value="">—</option>'; st.innerHTML = '<div class="alert bad">' + I('warn') + '<div>' + esc(M.aiFriendly(er.message)) + '</div></div>'; });
        };
        if (rs) { rs.onchange = loadModels; loadModels(); }
        var spec = function (imgs, text) {
          return { system: SYSTEM, text: (text ? 'نص ورقة الأسئلة:\n' + text + '\n\n' : 'الصور المرفقة (' + imgs.length + ') هي صفحات ورقة أسئلة بالترتيب.\n\n') + rules(imgs.length > 0), images: imgs, schema: SCHEMA, maxOut: 12000, timeout: 200000 };
        };
        var finish = function (groups) {
          var cnt = groups.reduce(function (t, g) { return t + g.parts.reduce(function (u, p) { return u + p.questions.length; }, 0); }, 0);
          if (!cnt) { st.innerHTML = '<div class="alert bad">' + I('warn') + '<div>لم يتم العثور على أسئلة — تأكد من وضوح الصورة أو النص.</div></div>'; return; }
          close(); M.notifyDone && M.notifyDone('اكتمل التحويل', n(cnt) + ' سؤال جاهز للمراجعة'); review(groups, onAdd);
        };
        M.qs('[data-ok]', m).onclick = function () {
          var text = M.qs('#imp-t', m).value.trim();
          if (mode === 'img' && !images.length) return M.toast('أضف صورة الأسئلة أولاً', 'bad');
          if (mode === 'txt' && text.length < 10) return M.toast('الصق نص الأسئلة أولاً', 'bad');
          var r = routes[+rs.value], model = ms.value; if (!model) return M.toast('اختر النموذج', 'bad');
          var ok = M.qs('[data-ok]', m); ok.disabled = true;
          var t0 = Date.now(), tick = setInterval(function () { var s2 = Math.floor((Date.now() - t0) / 1000), el = M.qs('#imp-tm', m); if (el) el.textContent = n(Math.floor(s2 / 60)) + ':' + n(String(s2 % 60).padStart(2, '0')); else clearInterval(tick); }, 1000);
          st.innerHTML = '<div class="alert info"><span class="pulse">' + I('spark') + '</span><div style="flex:1"><b id="imp-sub">يقرأ الأسئلة ويحدد أنواعها…</b> <span id="imp-tm" class="p-code">٠:٠٠</span><div class="small muted">أبقِ الشاشة مفتوحة — عادة أقل من دقيقة لكل صفحة.</div></div></div>';
          M.sound && M.sound('start');
          M._aiStatus = function (t) { var el = M.qs('#imp-sub', m); if (el) el.textContent = t; };
          /* نفس محرك «الاستخراج»: صيغة رد مختصرة (أسرع بكثير من JSON الطويل) بدون تخمين للإجابات */
          var units = mode === 'txt'
            ? [{ key: M.uid(), srcId: 'paste', name: 'النص الملصوق', kind: 'docx', n: 1, label: 'النص الملصوق', from: 1, to: 1, images: [], imageIdx: [], text: text.split(/\r?\n/).map(function (l, i) { return '[ف' + (i + 1) + '] ' + l; }).join('\n') }]
            : images.map(function (d, i) { return { key: M.uid(), srcId: 'img', name: 'صورة الأسئلة', kind: 'image', n: i + 1, label: 'صفحة ' + n(i + 1), img: d, orig: d, text: '' }; });
          var tmp = { id: M.uid(), units: units, _gone: true };
          var job = M.runExtract(tmp, r, model, function () {
            var d0 = units.filter(function (u) { return u.status === 'done' || u.status === 'failed'; }).length;
            M._aiStatus && M._aiStatus(units.length > 1 ? 'قراءة الصفحات — ' + n(d0) + ' من ' + n(units.length) : 'يقرأ الأسئلة ويحدد أنواعها…');
          }).then(function () {
            var errs = units.filter(function (u) { return u.status !== 'done'; });
            if (errs.length === units.length) throw new Error(errs[0].error || 'تعذّرت القراءة');
            if (errs.length) M.toast('تعذّرت قراءة: ' + errs.map(function (u) { return u.label + ' — ' + u.error; }).join(' · '), 'bad');
            return M.assembleExtract(tmp);
          }).then(function (res) {
            /* تجميع: سؤال رئيسي ← أجزاء حسب النوع والتعليمات */
            var groups = [], g = null, part = null;
            res.questions.forEach(function (q) {
              var main = (q.ctx && q.ctx.main) || '', title = (q.ctx && q.ctx.title) || '';
              if (!g || g._m !== main) { g = { _m: main, mainTitle: '', parts: [] }; groups.push(g); part = null; }
              if (!part || part.type !== q.type || part.title !== title) { part = { title: title, type: q.type, questions: [] }; g.parts.push(part); }
              q._sure = M.hasAnswer(q); delete q._sel; delete q.orig; delete q.src;
              part.questions.push(q);
            });
            groups.forEach(function (x) { delete x._m; if (x.parts.length > 1) x.mainTitle = 'أجب عن الأسئلة الآتية:'; });
            return groups;
          });
          job.then(function (g) { clearInterval(tick); M._aiStatus = null; finish(g); }).catch(function (er) { clearInterval(tick); M._aiStatus = null; ok.disabled = false; st.innerHTML = '<div class="alert bad">' + I('warn') + '<div>' + esc(M.aiFriendly(er.message)) + '</div></div>'; M.sound && M.sound('error'); });
        };
        M.qs('#imp-copy', m).onclick = function () {
          var text = M.qs('#imp-t', m).value.trim(), sp = spec(mode === 'img' ? images : [], mode === 'txt' ? text : '');
          var prompt = sp.system + '\n\n' + sp.text + '\n\nأعد JSON فقط بهذا المخطط:\n' + JSON.stringify(SCHEMA);
          (navigator.clipboard ? navigator.clipboard.writeText(prompt) : Promise.reject()).then(function () { M.toast('نُسخ الطلب — أرسله مع الصور بنفس الترتيب', 'ok'); }).catch(function () { M.qs('#imp-j', m).value = prompt; M.toast('انسخ الطلب من المربع'); });
        };
        M.qs('#imp-pj', m).onclick = function () {
          var d; try { d = JSON.parse(M.qs('#imp-j', m).value.replace(/^[\s\S]*?(\{)/, '$1').replace(/\}[^}]*$/, '}')); } catch (x) { return M.toast('الرد ليس JSON صالحاً', 'bad'); }
          convert(d, images).then(finish);
        };
      } });
  };

  function review(groups, onAdd) {
    var h = '<div class="imp-rv">';
    groups.forEach(function (g, gi) {
      h += '<div class="imp-g"><b class="imp-gh">السؤال ' + M.ordinal(gi) + (g.mainTitle ? ' — ' + esc(g.mainTitle) : '') + '</b>';
      g.parts.forEach(function (p, pi) {
        h += '<div class="imp-p"><span class="chip info">' + M.TYPE[p.type].label + '</span>' + (g.parts.length > 1 ? ' <b>(' + M.AR_LETTERS[pi] + ')</b>' : '') + ' <span class="paper-font">' + esc(p.title) + '</span></div>';
        p.questions.forEach(function (q, qi) {
          var id = gi + ':' + pi + ':' + qi;
          h += '<label class="imp-q"><input type="checkbox" data-q="' + id + '" checked><span class="b"><span class="paper-font">' + M.richText(q.text || (q.pairs || []).map(function (x) { return x.a + ' ← ' + x.b; }).join(' · '), 'arabic') + '</span>' +
            (q.type === 'mcq' ? '<span class="small">' + q.options.map(function (o, i) { return i === q.correct ? '<b class="ok">' + esc(o) + ' ✓</b>' : esc(o); }).join(' · ') + '</span>' : '') +
            (q.type === 'tf' && (q.answer === true || q.answer === false) ? '<span class="small"><b class="ok">' + (q.answer ? 'صح' : 'خطأ' + (q.correction ? ' — ' + esc(q.correction) : '')) + '</b></span>' : '') +
            (q.figure ? '<span class="imp-fig"><img src="' + q.figure + '" alt="الرسمة"><span class="small">قُصّت الرسمة من الصورة — تقدر تعدّل القص بعد الإضافة</span></span>' : '') +
            (!q._sure ? '<span class="small warn-t">الإجابة غير موجودة في المصدر — تبقى «غير محددة» حتى تكتبها</span>' : '') + '</span><span class="g">' + n(q.grade) + '</span></label>';
        });
      });
      h += '</div>';
    });
    h += '</div>';
    var total = groups.reduce(function (t, g) { return t + g.parts.reduce(function (u, p) { return u + p.questions.length; }, 0); }, 0);
    M.modal({ title: 'راجع الأسئلة المحوّلة (' + n(total) + ')', wide: true, body: h,
      foot: '<button class="btn pri" data-ok>' + I('check', 16) + ' إضافة المحدد للورقة</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qs('[data-ok]', m).onclick = function () {
          var pick = {}; M.qsa('[data-q]', m).forEach(function (c) { if (c.checked) pick[c.dataset.q] = 1; });
          var out = groups.map(function (g, gi) { return { mainTitle: g.mainTitle, parts: g.parts.map(function (p, pi) { return { title: p.title, type: p.type, questions: p.questions.filter(function (q, qi) { return pick[gi + ':' + pi + ':' + qi]; }).map(function (q) { delete q._sure; delete q._figSrc; return q; }) }; }).filter(function (p) { return p.questions.length; }) }; }).filter(function (g) { return g.parts.length; });
          if (!out.length) return M.toast('لم يُحدد أي سؤال', 'bad');
          close(); onAdd(out); M.toast('أُضيفت الأسئلة للورقة — راجع التنسيق والدرجات', 'ok');
        };
      } });
  }
})(window.M);
