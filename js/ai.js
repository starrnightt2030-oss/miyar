/* توليد الأسئلة من صور الدرس — عبر الخادم الأونلاين أو مفتاح API على هذا الجهاز
   كل سؤال يرجع بدليل مقتبس من الصفحة، ويدخل البنك «مسودة» لا تُستخدم قبل الاعتماد */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;

  M.AI_MODELS = [
    { id: 'claude-sonnet-5-5', label: 'سريع ودقيق (Sonnet 5.5) — موصى به' },
    { id: 'claude-opus-5-5', label: 'الأدق للمحتوى الصعب (Opus 5.5) — أبطأ وأغلى' }
  ];
  var MAX_IMAGES = 12;

  /* تجهيز صورة الدرس: حواف حتى ٢٠٠٠ بكسل (جودة قراءة النص) */
  M.prepLessonImage = function (file) {
    return M.readFile(file, 'dataurl').then(function (d) { return M.shrinkImage(d, 2000); });
  };

  var Q_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['notes', 'questions'],
    properties: {
      notes: { type: 'string' },
      questions: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['type', 'text', 'options', 'correct', 'answer', 'correction', 'pairs', 'extras', 'term', 'modelAnswer', 'lines', 'level', 'difficulty', 'grade', 'evidence', 'page'],
          properties: {
            type: { type: 'string', enum: ['mcq', 'tf', 'complete', 'match', 'term', 'reason', 'essay', 'draw', 'problem'] },
            text: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: { type: 'integer' },
            answer: { type: 'boolean' },
            correction: { type: 'string' },
            pairs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'string' } } } },
            extras: { type: 'array', items: { type: 'string' } },
            term: { type: 'string' },
            modelAnswer: { type: 'string' },
            lines: { type: 'integer' },
            level: { type: 'integer' },
            difficulty: { type: 'integer' },
            grade: { type: 'number' },
            evidence: { type: 'string' },
            page: { type: 'integer' }
          }
        }
      }
    }
  };

  var TYPE_RULES = {
    mcq: 'اختيار من متعدد: ٤ بدائل بالضبط، بديل واحد صحيح فقط، والبدائل الخاطئة معقولة ومن نفس المجال وبنفس الطول تقريباً. ممنوع «كل ما سبق» و«لا شيء مما سبق» والنفي المزدوج. correct = رقم البديل الصحيح من ٠. وزّع موضع الإجابة الصحيحة على البدائل.',
    tf: 'صح وخطأ: عبارة واحدة واضحة. نصف العبارات تقريباً خاطئة بخطأ واحد محدد، answer = false مع correction = العبارة بعد تصويبها. لا تستخدم «دائماً/أبداً» كحيلة.',
    complete: 'أكمل: عبارة من الدرس يُحذف منها مصطلح أو قيمة مهمة، وتُكتب الإجابة داخل النص بين [[ و ]] مثل: «وحدة قياس المقاومة هي [[الأوم]]». فراغ واحد أو اثنان كحد أقصى. ضع في extras كلمتين مشتّتتين من نفس المجال.',
    match: 'توصيل: سؤال واحد فيه من ٤ إلى ٥ أزواج في pairs (a من العمود أ، b ما يقابله)، وضع بديلاً زائداً واحداً في extras. text فارغ.',
    term: 'مصطلح علمي: text = التعريف كما في الكتاب أو بصياغة دقيقة، term = المصطلح.',
    reason: 'علّل: text = الظاهرة أو الحقيقة المطلوب تعليلها (بدون كلمة علّل)، modelAnswer = التعليل الصحيح من الكتاب، lines = ٢ أو ٣.',
    essay: 'مقالي: سؤال يتطلب شرحاً أو مقارنة أو خطوات، modelAnswer = نقاط الإجابة النموذجية مع توزيع الدرجات (مثال: ١) ... (درجة)). lines = ٣ إلى ٦.',
    draw: 'اشرح وارسم: سؤال يطلب رسماً موجوداً في الصفحات (دائرة كهربية، جهاز، شكل تخطيطي) مع البيانات، modelAnswer = عناصر الرسم المطلوبة وتوزيع الدرجات.',
    problem: 'مسألة: مسألة حسابية بقيم عددية صحيحة متسقة، modelAnswer = الحل بالخطوات والقانون والوحدة والناتج النهائي مع توزيع الدرجات. اكتب المعادلات بصيغة $...$ مثل $\\frac{V}{R}$ و $I^{2}$ و $\\sqrt{x}$.'
  };

  function systemPrompt() {
    return 'أنت خبير تقويم تربوي ومراجع علمي في مدرسة ثانوية صناعية (تعليم فني). مهمتك إعداد أسئلة امتحانية لبنك أسئلة رسمي يخضع لمراجعة الجودة (ISO 21001)، لذلك الدقة العلمية واللغوية مقدّمة على كل شيء.\n\n' +
      'قواعد إلزامية:\n' +
      '١) اعتمد فقط على محتوى الصور المرفقة (صفحات الدرس). كل سؤال يجب أن تكون إجابته موجودة صراحة في الصفحات. لا تضف معلومات من خارجها.\n' +
      '٢) لكل سؤال اكتب في evidence الجملة أو القيمة التي تثبت الإجابة مقتبسة حرفياً من الصفحة (أو وصفاً دقيقاً للشكل)، وفي page رقم الصورة (يبدأ من ١).\n' +
      '٣) لغة عربية فصحى سليمة، صياغة مباشرة لا تحتمل تفسيرين، بدون تلميح للإجابة.\n' +
      '٤) لا تكرر نفس الفكرة في سؤالين. غطِّ أفكار الدرس المختلفة بالتوازن.\n' +
      '٥) المستوى المعرفي level: ٠ تذكر، ١ فهم، ٢ تطبيق، ٣ تحليل وتقويم. الصعوبة difficulty: ٠ سهل، ١ متوسط، ٢ صعب. grade درجة مقترحة مناسبة.\n' +
      '٦) اكتب الأرقام بالأرقام الإنجليزية 0-9 (التطبيق يحولها تلقائياً)، والوحدات كما في الكتاب.\n' +
      '٧) إذا كانت صورة غير واضحة أو المحتوى لا يكفي للعدد المطلوب فأرجع عدداً أقل واذكر السبب في notes. الدقة أهم من العدد.\n' +
      '٨) الحقول غير المستخدمة لنوع السؤال: نص فارغ أو مصفوفة فارغة أو 0 أو false.';
  }

  /* بناء طلب واحد لنوع أسئلة */
  M.aiBuildRequest = function (opts, type) {
    var l = opts.lesson, p = M.lessonPath(l.id), outs = M.outcomesOf(l.id);
    var targets = (S.settings.levelTargets || [30, 40, 20, 10]).map(function (x, i) { return M.LEVELS[i] + ' ' + x + '٪'; }).join('، ');
    var content = opts.images.map(function (d) {
      var m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(d);
      return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
    });
    content.push({ type: 'text', text:
      'المادة: ' + (p.subject ? p.subject.name : '') + (p.subject && p.subject.className ? ' — ' + p.subject.className : '') + '\n' +
      'الوحدة: ' + (p.unit ? p.unit.name : '') + '\nالدرس: ' + l.name + '\n' +
      (outs.length ? 'نواتج التعلم:\n' + outs.map(function (o) { return '- ' + o.code + ': ' + o.text; }).join('\n') + '\n' : '') +
      (l.content ? 'ملاحظات المدرس عن الدرس:\n' + l.content + '\n' : '') +
      '\nالمطلوب: ' + opts.count + ' سؤالاً من نوع «' + M.TYPE[type].label + '» فقط (type = "' + type + '").\n' +
      'قواعد هذا النوع: ' + TYPE_RULES[type] + '\n' +
      'وزّع المستويات المعرفية قريباً من: ' + targets + '، بما يناسب طبيعة النوع.\n' +
      (opts.extra ? 'تعليمات إضافية من المدرس: ' + opts.extra + '\n' : '') });
    return {
      model: opts.model || M.AI_MODELS[0].id,
      max_tokens: 16000,
      system: systemPrompt(),
      messages: [{ role: 'user', content: content }],
      output_config: { format: { type: 'json_schema', schema: Q_SCHEMA } }
    };
  };

  function parseResponse(j) {
    if (j && j.error) throw new Error(j.error.message || j.error);
    var txt = ((j && j.content) || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    if (!txt) throw new Error('لم يرجع رد من نموذج الذكاء الاصطناعي');
    var data = JSON.parse(txt);
    return { notes: data.notes || '', questions: data.questions || [], usage: j.usage || {}, stop: j.stop_reason };
  }

  /* الإرسال: الخادم أولاً، ثم المفتاح المحلي */
  M.aiAvailable = function () {
    if (M.cloud && M.cloud.ready && M.cloud.user) return 'cloud';
    if (S.settings.aiKey) return 'local';
    return '';
  };
  M.aiCall = function (body) {
    var mode = M.aiAvailable();
    if (mode === 'cloud') {
      return M.cloud.invoke('generate', body).then(parseResponse);
    }
    if (mode === 'local') {
      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': S.settings.aiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); }).then(parseResponse);
    }
    return Promise.reject(new Error('التوليد يحتاج تسجيل الدخول للخادم الأونلاين، أو مفتاح API في الإعدادات'));
  };

  /* تشغيل متوازٍ لكل نوع (أسرع، ويتجنب انتهاء المهلة) */
  M.aiGenerate = function (opts, onProgress) {
    var types = opts.types.slice(), results = [], notes = [], errors = [], done = 0, usage = { input_tokens: 0, output_tokens: 0 };
    function next() {
      var t = types.shift(); if (!t) return Promise.resolve();
      return M.aiCall(M.aiBuildRequest(opts, t)).then(function (r) {
        r.questions.forEach(function (q) { q.type = t; results.push(q); });
        if (r.notes) notes.push(M.TYPE[t].label + ': ' + r.notes);
        usage.input_tokens += r.usage.input_tokens || 0; usage.output_tokens += r.usage.output_tokens || 0;
      }).catch(function (e) { errors.push(M.TYPE[t].label + ': ' + e.message); }).then(function () { done++; if (onProgress) onProgress(done, opts.types.length); return next(); });
    }
    var workers = []; for (var i = 0; i < Math.min(3, types.length); i++) workers.push(next());
    return Promise.all(workers).then(function () { return { questions: results, notes: notes, errors: errors, usage: usage }; });
  };

  /* فحص آلي لكل سؤال مولد قبل عرضه */
  M.aiCheck = function (x) {
    var w = [];
    if (x.type === 'mcq') {
      if ((x.options || []).length !== 4) w.push('عدد البدائل ليس ٤');
      if (!(x.correct >= 0 && x.correct < (x.options || []).length)) w.push('رقم الإجابة الصحيحة غير صالح');
      var seen = {}; (x.options || []).forEach(function (o) { var k = M.norm(o); if (seen[k]) w.push('بديلان متطابقان'); seen[k] = 1; });
    }
    if (x.type === 'complete' && !/\[\[.+?\]\]/.test(x.text)) w.push('لا يوجد فراغ [[ ]]');
    if (x.type === 'tf' && x.answer === false && !String(x.correction || '').trim()) w.push('عبارة خاطئة بدون تصويب');
    if (x.type === 'match' && (x.pairs || []).length < 3) w.push('أزواج التوصيل أقل من ٣');
    if (!String(x.evidence || '').trim()) w.push('بدون دليل من الكتاب');
    var dup = S.questions.find(function (q) { return q.lessonId && q.type === x.type && M.similarity(q.text + (q.term || ''), x.text + (x.term || '')) >= 0.8; });
    if (dup) w.push('يشبه سؤالاً موجوداً في البنك');
    return w;
  };

  M.aiToQuestion = function (x, lessonId) {
    var q = M.newQuestion(x.type, lessonId);
    ['text', 'options', 'correct', 'answer', 'correction', 'pairs', 'extras', 'term', 'modelAnswer'].forEach(function (k) { if (x[k] != null) q[k] = x[k]; });
    if (x.lines > 0) q.lines = Math.min(10, x.lines);
    q.level = Math.min(3, Math.max(0, Number(x.level) || 0));
    q.difficulty = Math.min(2, Math.max(0, Number(x.difficulty == null ? 1 : x.difficulty)));
    q.grade = Number(x.grade) > 0 ? Number(x.grade) : M.TYPE[x.type].grade;
    q.evidence = x.evidence || ''; q.evidencePage = x.page || 0;
    q.source = 'ai'; q.status = 'draft';
    if (q.type === 'mcq') { while (q.options.length < 2) q.options.push(''); }
    return q;
  };

  /* ===== الواجهة: صور الدرس + التوليد ===== */
  M.lessonImagesCard = function (lesson) {
    var imgs = lesson.images || [];
    var mode = M.aiAvailable();
    return '<div class="card"><div class="card-h"><h3 class="grow">صور الدرس (صفحات الكتاب)</h3><span class="small muted">' + n(imgs.length) + ' / ' + n(MAX_IMAGES) + '</span>' +
      '<button class="btn sm" id="li-add">' + I('t_image', 16) + ' إضافة صور / تصوير</button>' +
      '<button class="btn sm pri" id="li-gen"' + (imgs.length ? '' : ' disabled') + '>' + I('spark', 16) + ' توليد أسئلة من الصور</button></div>' +
      (imgs.length ? '<div class="row" style="gap:8px;align-items:flex-start">' + imgs.map(function (d, i) {
        return '<div style="position:relative"><img src="' + d + '" alt="صفحة ' + n(i + 1) + '" data-liview="' + i + '" style="width:96px;height:128px;object-fit:cover;border:1px solid var(--line);border-radius:8px;cursor:zoom-in"><span class="chip" style="position:absolute;top:4px;inset-inline-start:4px">' + n(i + 1) + '</span>' +
          '<button class="btn icon sm" data-lidel="' + i + '" aria-label="حذف الصورة" style="position:absolute;top:2px;inset-inline-end:2px;min-height:28px;width:28px;background:#fff">' + I('x', 14) + '</button></div>';
      }).join('') + '</div>' : '<div class="small muted">صوّر صفحات الدرس من الكتاب بوضوح (صفحة في كل صورة، بإضاءة جيدة ومستقيمة)، والتطبيق يقرأها ويقترح أسئلة متنوعة مع دليل من الصفحة لكل سؤال.</div>') +
      (!mode ? '<div class="alert warn" style="margin-top:10px">' + I('warn') + '<div>التوليد يحتاج: تسجيل الدخول للخادم الأونلاين (صفحة «الأونلاين»)، أو مفتاح Claude API في الإعدادات على هذا الجهاز.</div></div>' : '') + '</div>';
  };

  M.bindLessonImages = function (root, lesson) {
    var add = M.qs('#li-add', root);
    if (add) add.onclick = function () {
      var room = MAX_IMAGES - (lesson.images || []).length;
      if (room <= 0) return M.toast('الحد الأقصى ' + n(MAX_IMAGES) + ' صورة للدرس', 'bad');
      M.pickFile('image/*', true).then(function (files) {
        files = files.slice(0, room); if (!files.length) return;
        M.toast('جاري تجهيز ' + n(files.length) + ' صورة…');
        return Promise.all(files.map(M.prepLessonImage)).then(function (list) {
          lesson.images = (lesson.images || []).concat(list);
          return M.save('lessons', lesson);
        }).then(function () { M.render(); });
      });
    };
    M.qsa('[data-lidel]', root).forEach(function (b) {
      b.onclick = function () { M.confirm('حذف الصورة', 'حذف الصفحة ' + n(+b.dataset.lidel + 1) + '؟', 'حذف', true).then(function (ok) { if (!ok) return; lesson.images.splice(+b.dataset.lidel, 1); M.save('lessons', lesson).then(M.render); }); };
    });
    M.qsa('[data-liview]', root).forEach(function (im) {
      im.onclick = function () { M.modal({ title: 'صفحة ' + n(+im.dataset.liview + 1), wide: true, body: '<img src="' + im.src + '" alt="" style="width:100%;border-radius:8px">' }); };
    });
    var gen = M.qs('#li-gen', root);
    if (gen) gen.onclick = function () { M.aiDialog2(lesson); };
  };

  M.aiDialog2 = function (lesson) {
    if (!M.aiAvailable()) return M.toast('سجّل الدخول للخادم الأونلاين أو أضف مفتاح API من الإعدادات', 'bad');
    var sel = ['mcq', 'tf', 'complete', 'reason'];
    M.modal({ title: 'توليد أسئلة من صور الدرس — ' + lesson.name, wide: true,
      body: '<div class="field"><span class="lbl">أنواع الأسئلة</span><div class="row" id="g2-types" style="gap:6px">' + M.TYPES.filter(function (t) { return t.id !== 'image'; }).map(function (t) { return '<label class="check chip" style="min-height:34px"><input type="checkbox" value="' + t.id + '"' + (sel.indexOf(t.id) >= 0 ? ' checked' : '') + '>' + t.label + '</label>'; }).join('') + '</div></div>' +
        '<div class="grid3"><div class="field"><label for="g2-n">عدد الأسئلة لكل نوع</label><input id="g2-n" class="inp" inputmode="numeric" value="٦"></div>' +
        '<div class="field" style="grid-column:span 2"><label for="g2-m">النموذج</label><select id="g2-m" class="inp">' + M.AI_MODELS.map(function (m) { return '<option value="' + m.id + '">' + m.label + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label for="g2-x">تعليمات إضافية (اختياري)</label><input id="g2-x" class="inp" placeholder="مثال: ركّز على القوانين والوحدات، أو تجنّب الصفحة ٣"></div>' +
        '<div class="alert info">' + I('lock') + '<div>الأسئلة تُبنى من الصفحات فقط، ومع كل سؤال دليل مقتبس من الكتاب. تدخل البنك «مسودة» وتحتاج مراجعة واعتماد قبل استخدامها في أي امتحان.</div></div>' +
        '<div id="g2-st"></div>',
      foot: '<button class="btn pri" id="g2-go">' + I('spark') + ' توليد</button><button class="btn" data-x>إغلاق</button>',
      onMount: function (m, close) {
        M.qs('#g2-go', m).onclick = function () {
          var types = M.qsa('#g2-types input:checked', m).map(function (i) { return i.value; });
          if (!types.length) return M.toast('اختر نوعاً واحداً على الأقل', 'bad');
          var cnt = Math.min(15, Math.max(1, Number(M.toWestern(M.qs('#g2-n', m).value)) || 6));
          var btn = this; btn.disabled = true;
          var st = M.qs('#g2-st', m);
          st.innerHTML = '<div class="alert info"><span class="pulse">' + I('spark') + '</span><div>جاري قراءة ' + n(lesson.images.length) + ' صفحة وإعداد الأسئلة… <span id="g2-p">٠ / ' + n(types.length) + '</span> (قد يستغرق دقيقة أو اثنتين)</div></div>';
          M.aiGenerate({ lesson: lesson, images: lesson.images, types: types, count: cnt, model: M.qs('#g2-m', m).value, extra: M.qs('#g2-x', m).value.trim() }, function (d, t) { var p = M.qs('#g2-p', m); if (p) p.textContent = n(d) + ' / ' + n(t); })
            .then(function (res) {
              M.log('توليد أسئلة من صور الدرس', lesson.name, 'عدد ' + res.questions.length + ' · توكنز ' + (res.usage.input_tokens + res.usage.output_tokens));
              close(); M.aiReview(lesson, res);
            }).catch(function (e) { btn.disabled = false; st.innerHTML = '<div class="alert bad">' + I('warn') + '<div>' + esc(e.message) + '</div></div>'; });
        };
      } });
  };

  /* مراجعة الناتج قبل الإضافة للبنك */
  M.aiReview = function (lesson, res) {
    var items = res.questions.map(function (x) { return { x: x, warn: M.aiCheck(x), on: true }; });
    items.forEach(function (it) { if (it.warn.some(function (w) { return /غير صالح|متطابقان|لا يوجد فراغ|أقل من/.test(w); })) it.on = false; });
    var html = (res.errors.length ? '<div class="alert bad">' + I('warn') + '<div>' + res.errors.map(esc).join('<br>') + '</div></div>' : '') +
      (res.notes.length ? '<div class="alert info">' + I('spark') + '<div>' + res.notes.map(esc).join('<br>') + '</div></div>' : '') +
      '<div class="small muted">' + n(items.length) + ' سؤال مقترح — راجع كل سؤال ودليله، وألغِ تحديد غير المناسب. المحدد يُضاف كمسودة.</div>' +
      items.map(function (it, i) {
        var q = M.aiToQuestion(it.x, lesson.id);
        return '<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:6px"><div class="row"><input type="checkbox" data-ai="' + i + '"' + (it.on ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent)" aria-label="تحديد">' + M.typeChip(q.type) + '<span class="chip info">' + M.LEVELS[q.level] + '</span><span class="chip">' + M.DIFFS[q.difficulty] + '</span><span class="chip">' + esc(M.toArabic(M.gradeWord(q.grade))) + '</span>' + (it.x.page ? '<span class="chip">صفحة ' + n(it.x.page) + '</span>' : '') + '</div>' +
          '<div style="background:#E9EBF0;border-radius:8px;padding:8px">' + M.renderQuestionPreview(q, S.settings.digits) + '</div>' +
          '<div class="small"><b>الإجابة: </b>' + M.richText(q.type === 'match' ? q.pairs.map(function (p) { return p.a + ' ← ' + p.b; }).join(' · ') : M.answerText(q), 'arabic', { answers: true }) + '</div>' +
          '<div class="small" style="background:#FFFBEB;border-inline-start:3px solid #D97706;padding:6px 10px;border-radius:6px"><b>الدليل من الكتاب: </b>' + esc(it.x.evidence || '—') + '</div>' +
          (it.warn.length ? '<div class="alert warn small">' + I('warn') + '<div>' + it.warn.map(esc).join('، ') + '</div></div>' : '') + '</div>';
      }).join('');
    M.modal({ title: 'مراجعة الأسئلة المقترحة — ' + lesson.name, wide: true, body: html || '<div class="empty">لم تُقترح أسئلة.</div>',
      foot: '<button class="btn pri" data-ok>إضافة المحدد للبنك كمسودات</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qsa('[data-ai]', m).forEach(function (c) { c.onchange = function () { items[+c.dataset.ai].on = c.checked; }; });
        M.qs('[data-ok]', m).onclick = function () {
          var list = items.filter(function (it) { return it.on; }).map(function (it) { return M.aiToQuestion(it.x, lesson.id); });
          if (!list.length) return M.toast('لم يُحدد أي سؤال', 'bad');
          Promise.all(list.map(function (q) { return M.save('questions', q, { log: false }); })).then(function () {
            M.log('إضافة أسئلة مولدة', lesson.name, 'عدد ' + list.length + ' — مسودة للمراجعة');
            close(); M.toast('أضيف ' + n(list.length) + ' سؤال كمسودة — راجعها وأرسلها للاعتماد', 'ok'); M.render();
          });
        };
      } });
  };
})(window.M);
