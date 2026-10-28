/* توليد الأسئلة من صور شرح الدرس — Claude أو ChatGPT أو Gemini (أي مفتاح يعمل)
   ثلاث طرق: الخادم الأونلاين، أو مفتاح على هذا الجهاز، أو يدوي (نسخ الطلب ولصق/رفع ملف JSON)
   كل سؤال يرجع بدليل مقتبس من الصفحة، ويدخل البنك «مسودة» لا تُستخدم قبل الاعتماد */
(function (M) {
  'use strict';
  var S = M.S, esc = M.esc, n = M.n, I = M.icon;
  var MAX_IMAGES = 12;

  M.AI_PROVIDERS = {
    anthropic: { name: 'Claude', by: 'Anthropic', keyHint: 'sk-ant-…', site: 'console.anthropic.com' },
    openai: { name: 'ChatGPT', by: 'OpenAI', keyHint: 'sk-…', site: 'platform.openai.com' },
    gemini: { name: 'Gemini', by: 'Google', keyHint: 'AIza…', site: 'aistudio.google.com' }
  };
  M.aiDetectProvider = function (key) {
    key = String(key || '').trim();
    if (/^sk-ant-/.test(key)) return 'anthropic';
    if (/^AIza/.test(key)) return 'gemini';
    if (/^sk-/.test(key)) return 'openai';
    return '';
  };
  function keys() {
    var k = Object.assign({}, S.settings.aiKeys || {});
    if (S.settings.aiKey && !k.anthropic) k.anthropic = S.settings.aiKey; /* ترحيل من 1.2.0 */
    return k;
  }
  M.aiKeys = keys;

  /* ===== مخطط الناتج ===== */
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
            text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correct: { type: 'integer' },
            answer: { type: 'boolean' }, correction: { type: 'string' },
            pairs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'string' } } } },
            extras: { type: 'array', items: { type: 'string' } }, term: { type: 'string' }, modelAnswer: { type: 'string' },
            lines: { type: 'integer' }, level: { type: 'integer' }, difficulty: { type: 'integer' }, grade: { type: 'number' },
            evidence: { type: 'string' }, page: { type: 'integer' }
          }
        }
      }
    }
  };
  function stripAP(s) { /* لمخطط Gemini القديم: بدون additionalProperties */
    if (Array.isArray(s)) return s.map(stripAP);
    if (s && typeof s === 'object') { var o = {}; Object.keys(s).forEach(function (k) { if (k !== 'additionalProperties') o[k] = stripAP(s[k]); }); return o; }
    return s;
  }

  var TYPE_RULES = {
    mcq: 'اختيار من متعدد: ٤ بدائل بالضبط، بديل واحد صحيح فقط، والبدائل الخاطئة معقولة ومن نفس المجال وبنفس الطول تقريباً. ممنوع «كل ما سبق» و«لا شيء مما سبق» والنفي المزدوج. correct = رقم البديل الصحيح من 0. وزّع موضع الإجابة الصحيحة على البدائل.',
    tf: 'صح وخطأ: عبارة واحدة واضحة. نصف العبارات تقريباً خاطئة بخطأ واحد محدد، answer = false مع correction = العبارة بعد تصويبها. لا تستخدم «دائماً/أبداً» كحيلة.',
    complete: 'أكمل: عبارة من الدرس يُحذف منها مصطلح أو قيمة مهمة، وتُكتب الإجابة داخل النص بين [[ و ]] مثل: «وحدة قياس المقاومة هي [[الأوم]]». فراغ واحد أو اثنان كحد أقصى. ضع في extras كلمتين مشتّتتين من نفس المجال.',
    match: 'توصيل: سؤال واحد فيه من 4 إلى 5 أزواج في pairs (a من العمود أ، b ما يقابله)، وضع بديلاً زائداً واحداً في extras. text فارغ.',
    term: 'مصطلح علمي: text = التعريف كما في الكتاب أو بصياغة دقيقة، term = المصطلح.',
    reason: 'علّل: text = الظاهرة أو الحقيقة المطلوب تعليلها (بدون كلمة علّل)، modelAnswer = التعليل الصحيح من الكتاب، lines = 2 أو 3.',
    essay: 'مقالي: سؤال يتطلب شرحاً أو مقارنة أو خطوات، modelAnswer = نقاط الإجابة النموذجية مع توزيع الدرجات (مثال: 1) ... (درجة)). lines = 3 إلى 6.',
    draw: 'اشرح وارسم: سؤال يطلب رسماً موجوداً في الصفحات (دائرة كهربية، جهاز، شكل تخطيطي) مع البيانات، modelAnswer = عناصر الرسم المطلوبة وتوزيع الدرجات.',
    problem: 'مسألة: مسألة حسابية بقيم عددية صحيحة متسقة، modelAnswer = الحل بالخطوات والقانون والوحدة والناتج النهائي مع توزيع الدرجات. اكتب المعادلات بصيغة $...$ مثل $\\frac{V}{R}$ و $I^{2}$ و $\\sqrt{x}$.'
  };

  function systemPrompt() {
    return 'أنت خبير تقويم تربوي ومراجع علمي في مدرسة ثانوية صناعية (تعليم فني). مهمتك إعداد أسئلة امتحانية لبنك أسئلة رسمي يخضع لمراجعة الجودة (ISO 21001)، لذلك الدقة العلمية واللغوية مقدّمة على كل شيء.\n\n' +
      'الصور المرفقة هي صفحات شرح الدرس من الكتاب المدرسي (ليست أسئلة). اقرأ الشرح والأشكال والجداول والقوانين، ثم أنشئ أنت الأسئلة منها.\n\n' +
      'قواعد إلزامية:\n' +
      '1) اعتمد فقط على محتوى الصفحات المرفقة. كل سؤال يجب أن تكون إجابته موجودة صراحة في الصفحات. لا تضف معلومات من خارجها.\n' +
      '2) لكل سؤال اكتب في evidence الجملة أو القيمة التي تثبت الإجابة مقتبسة حرفياً من الصفحة (أو وصفاً دقيقاً للشكل)، وفي page رقم الصورة (يبدأ من 1).\n' +
      '3) لغة عربية فصحى سليمة، صياغة مباشرة لا تحتمل تفسيرين، بدون تلميح للإجابة.\n' +
      '4) لا تكرر نفس الفكرة في سؤالين. غطِّ أفكار الدرس المختلفة بالتوازن.\n' +
      '5) المستوى المعرفي level: 0 تذكر، 1 فهم، 2 تطبيق، 3 تحليل وتقويم. الصعوبة difficulty: 0 سهل، 1 متوسط، 2 صعب. grade درجة مقترحة مناسبة.\n' +
      '6) اكتب الأرقام بالأرقام الإنجليزية 0-9 (التطبيق يحولها تلقائياً)، والوحدات كما في الكتاب.\n' +
      '7) إذا كانت صورة غير واضحة أو المحتوى لا يكفي للعدد المطلوب فأرجع عدداً أقل واذكر السبب في notes. الدقة أهم من العدد.\n' +
      '8) الحقول غير المستخدمة لنوع السؤال: نص فارغ أو مصفوفة فارغة أو 0 أو false.';
  }

  function lessonContext(lesson) {
    var p = M.lessonPath(lesson.id), outs = M.outcomesOf(lesson.id);
    return 'المادة: ' + (p.subject ? p.subject.name : '') + (p.subject && p.subject.className ? ' — ' + p.subject.className : '') + '\n' +
      'الوحدة: ' + (p.unit ? p.unit.name : '') + '\nالدرس: ' + lesson.name + '\n' +
      (outs.length ? 'نواتج التعلم:\n' + outs.map(function (o) { return '- ' + o.code + ': ' + o.text; }).join('\n') + '\n' : '') +
      (lesson.content ? 'نص/ملاحظات الدرس:\n' + lesson.content + '\n' : '');
  }
  function targetsText() { return (S.settings.levelTargets || [30, 40, 20, 10]).map(function (x, i) { return M.LEVELS[i] + ' ' + x + '%'; }).join('، '); }

  /* مواصفة محايدة: نص + صور + مخطط — تتحول لأي مزود */
  M.aiSpec = function (opts, types) {
    var text = lessonContext(opts.lesson) + '\nالمطلوب:\n' +
      types.map(function (t) { return '- ' + opts.count + ' أسئلة من نوع «' + M.TYPE[t].label + '» (type = "' + t + '"). ' + TYPE_RULES[t]; }).join('\n') +
      '\nوزّع المستويات المعرفية قريباً من: ' + targetsText() + '، بما يناسب طبيعة كل نوع.\n' +
      (opts.extra ? 'تعليمات إضافية من المدرس: ' + opts.extra + '\n' : '') +
      (!opts.images.length ? '\nلا توجد صور مرفقة: اعتمد على نص الدرس أعلاه فقط.\n' : '');
    return { system: systemPrompt(), text: text, images: opts.images, schema: Q_SCHEMA };
  };

  function splitData(d) { var m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(d); return { mime: m[1], data: m[2] }; }

  /* ===== محوّلات المزودين ===== */
  var ADAPT = {
    anthropic: {
      build: function (spec, model) {
        var content = spec.images.map(function (d) { var x = splitData(d); return { type: 'image', source: { type: 'base64', media_type: x.mime, data: x.data } }; });
        content.push({ type: 'text', text: spec.text });
        return { model: model, max_tokens: 16000, system: spec.system, messages: [{ role: 'user', content: content }], output_config: { format: { type: 'json_schema', schema: spec.schema } } };
      },
      call: function (body, key) {
        return post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body);
      },
      parse: function (j) {
        var txt = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
        return { text: txt, usage: { input_tokens: (j.usage || {}).input_tokens || 0, output_tokens: (j.usage || {}).output_tokens || 0 } };
      },
      models: function (key) {
        return get('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' })
          .then(function (j) { return (j.data || []).map(function (m) { return { id: m.id, label: m.display_name || m.id }; }); });
      },
      pick: function (list) { return pickBy(list, [/sonnet/, /opus/, /claude/]); }
    },
    openai: {
      build: function (spec, model) {
        var content = spec.images.map(function (d) { return { type: 'image_url', image_url: { url: d, detail: 'high' } }; });
        content.push({ type: 'text', text: spec.text });
        return { model: model, max_completion_tokens: 16000, messages: [{ role: 'system', content: spec.system }, { role: 'user', content: content }],
          response_format: { type: 'json_schema', json_schema: { name: 'exam_questions', schema: spec.schema, strict: true } } };
      },
      call: function (body, key) { return post('https://api.openai.com/v1/chat/completions', { Authorization: 'Bearer ' + key }, body); },
      parse: function (j) {
        var c = j.choices && j.choices[0] && j.choices[0].message;
        if (c && c.refusal) throw new Error('رفض النموذج: ' + c.refusal);
        return { text: (c && c.content) || '', usage: { input_tokens: (j.usage || {}).prompt_tokens || 0, output_tokens: (j.usage || {}).completion_tokens || 0 } };
      },
      models: function (key) {
        return get('https://api.openai.com/v1/models', { Authorization: 'Bearer ' + key }).then(function (j) {
          return (j.data || []).filter(function (m) { return /^(gpt-|o\d|chatgpt)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|embedding|search|instruct|codex|moderation)/.test(m.id); })
            .sort(function (a, b) { return (b.created || 0) - (a.created || 0); }).map(function (m) { return { id: m.id, label: m.id }; });
        });
      },
      pick: function (list) { return pickBy(list.filter(function (m) { return !/(mini|nano)/.test(m.id); }).concat(list), [/^gpt-/, /^o\d/]); }
    },
    gemini: {
      build: function (spec, model, legacy) {
        var parts = spec.images.map(function (d) { var x = splitData(d); return { inlineData: { mimeType: x.mime, data: x.data } }; });
        parts.push({ text: spec.text });
        var gc = { responseMimeType: 'application/json', maxOutputTokens: 16000 };
        if (legacy === 2) { /* بدون مخطط: نعتمد على وصف الطلب */ }
        else if (legacy === 1) gc.responseSchema = stripAP(spec.schema);
        else gc.responseJsonSchema = spec.schema;
        return { __model: model, systemInstruction: { parts: [{ text: spec.system }] }, contents: [{ role: 'user', parts: parts }], generationConfig: gc };
      },
      call: function (body, key) {
        var model = body.__model; var b = Object.assign({}, body); delete b.__model;
        return post('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {}, b);
      },
      parse: function (j) {
        var cand = j.candidates && j.candidates[0];
        if (!cand) throw new Error('لم يرجع رد من Gemini' + (j.promptFeedback && j.promptFeedback.blockReason ? ' (' + j.promptFeedback.blockReason + ')' : ''));
        var txt = ((cand.content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');
        return { text: txt, usage: { input_tokens: (j.usageMetadata || {}).promptTokenCount || 0, output_tokens: (j.usageMetadata || {}).candidatesTokenCount || 0 } };
      },
      models: function (key) {
        return get('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key), {}).then(function (j) {
          return (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini/.test(m.name) && !/(image|tts|embedding|audio|live|robotics|computer)/.test(m.name); })
            .map(function (m) { return { id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }; }).reverse();
        });
      },
      pick: function (list) { return pickBy(list, [/pro/, /flash(?!-lite)/, /gemini/]); }
    }
  };
  function pickBy(list, pats) { for (var i = 0; i < pats.length; i++) { var m = list.find(function (x) { return pats[i].test(x.id); }); if (m) return m.id; } return list[0] ? list[0].id : ''; }

  function post(url, headers, body) {
    return fetch(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(errMsg(j) || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function get(url, headers) {
    return fetch(url, { headers: headers }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(errMsg(j) || ('HTTP ' + r.status)); return j; }); });
  }
  function errMsg(j) { var e = j && j.error; if (!e) return ''; return typeof e === 'string' ? e : (e.message || JSON.stringify(e)); }
  function friendly(m) {
    if (/401|invalid.*key|API key not valid|incorrect api key|authentication/i.test(m)) return 'المفتاح غير صحيح أو منتهي — راجعه في الإعدادات';
    if (/429|rate|quota|exceeded/i.test(m)) return 'تجاوزت الحد المسموح أو الرصيد انتهى — انتظر قليلاً أو راجع رصيد الحساب';
    if (/credit|billing|balance/i.test(m)) return 'رصيد الحساب غير كافٍ — أضف رصيداً من موقع المزود';
    if (/model.*(not found|does not exist)|not supported/i.test(m)) return 'النموذج المختار غير متاح لهذا المفتاح — اختر نموذجاً آخر من القائمة';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال — تحقق من الإنترنت';
    return m;
  }
  M.aiFriendly = friendly;

  function parseJSONText(txt) {
    var t = String(txt || '').trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    var s = t.indexOf('{'), sa = t.indexOf('[');
    if (s < 0 && sa < 0) throw new Error('لا يوجد JSON في الرد');
    var data;
    if (sa >= 0 && (s < 0 || sa < s)) data = { notes: '', questions: JSON.parse(t.slice(sa, t.lastIndexOf(']') + 1)) };
    else data = JSON.parse(t.slice(s, t.lastIndexOf('}') + 1));
    if (Array.isArray(data)) data = { notes: '', questions: data };
    if (!Array.isArray(data.questions)) throw new Error('الملف لا يحتوي على قائمة questions');
    return data;
  }
  M.aiParseJSON = parseJSONText;

  /* ===== المسارات المتاحة ===== */
  M.aiRoutes = function () {
    var out = [], k = keys();
    if (M.cloud && M.cloud.ready && M.cloud.user && M.cloud.profile && M.cloud.profile.approved) {
      (M.cloud.aiProviders || ['anthropic']).forEach(function (p) { out.push({ via: 'cloud', provider: p }); });
    }
    Object.keys(M.AI_PROVIDERS).forEach(function (p) { if (k[p]) out.push({ via: 'local', provider: p }); });
    return out;
  };
  M.aiAvailable = function () { return M.aiRoutes().length ? 'yes' : ''; };

  M.aiListModels = function (route) {
    if (route.via === 'cloud') return M.cloud.invoke('generate', { action: 'models', provider: route.provider });
    return ADAPT[route.provider].models(keys()[route.provider]);
  };
  M.aiDefaultModel = function (provider, list) {
    var saved = (S.settings.aiModels || {})[provider];
    if (saved && (!list || list.some(function (m) { return m.id === saved; }))) return saved;
    return list && list.length ? ADAPT[provider].pick(list) : '';
  };

  function callOnce(route, model, spec, legacy) {
    var ad = ADAPT[route.provider], body = ad.build(spec, model, legacy);
    var p = route.via === 'cloud' ? M.cloud.invoke('generate', { provider: route.provider, model: model, body: body }) : ad.call(body, keys()[route.provider]);
    return p.then(function (j) { var r = ad.parse(j); var d = parseJSONText(r.text); return { notes: d.notes || '', questions: d.questions || [], usage: r.usage }; });
  }
  M.aiCall = function (route, model, spec) {
    return callOnce(route, model, spec, 0).catch(function (e) {
      /* Gemini: بعض الإصدارات لا تدعم responseJsonSchema → نجرب الصيغة الأقدم ثم بدون مخطط */
      if (route.provider === 'gemini' && /responseJsonSchema|response_json_schema|Unknown name|Invalid JSON payload/i.test(e.message)) {
        return callOnce(route, model, spec, 1).catch(function () { return callOnce(route, model, spec, 2); });
      }
      throw e;
    });
  };

  /* طلب لكل نوع بالتوازي (أسرع ويتجنب انتهاء المهلة) */
  M.aiGenerate = function (opts, onProgress) {
    var types = opts.types.slice(), results = [], notes = [], errors = [], done = 0, usage = { input_tokens: 0, output_tokens: 0 };
    function next() {
      var t = types.shift(); if (!t) return Promise.resolve();
      return M.aiCall(opts.route, opts.model, M.aiSpec(opts, [t])).then(function (r) {
        r.questions.forEach(function (q) { if (!q.type || !M.TYPE[q.type]) q.type = t; results.push(q); });
        if (r.notes) notes.push(M.TYPE[t].label + ': ' + r.notes);
        usage.input_tokens += r.usage.input_tokens || 0; usage.output_tokens += r.usage.output_tokens || 0;
      }).catch(function (e) { errors.push(M.TYPE[t].label + ': ' + friendly(e.message)); }).then(function () { done++; if (onProgress) onProgress(done, opts.types.length); return next(); });
    }
    var w = []; for (var i = 0; i < Math.min(3, types.length); i++) w.push(next());
    return Promise.all(w).then(function () { return { questions: results, notes: notes, errors: errors, usage: usage }; });
  };

  /* ===== الوضع اليدوي: طلب كامل يُنسخ لأي موقع ذكاء اصطناعي ===== */
  M.aiManualPrompt = function (opts) {
    var spec = M.aiSpec(opts, opts.types);
    return spec.system + '\n\n' + spec.text +
      (opts.images.length ? '\nأرفقتُ مع هذه الرسالة ' + opts.images.length + ' صورة لصفحات الدرس بالترتيب (page من 1 إلى ' + opts.images.length + ').\n' : '') +
      '\nأعد النتيجة كملف JSON فقط (بدون أي نص قبله أو بعده) بهذا الشكل بالضبط:\n' +
      '{"notes":"ملاحظاتك إن وجدت","questions":[{"type":"mcq","text":"...","options":["...","...","...","..."],"correct":0,"answer":false,"correction":"","pairs":[],"extras":[],"term":"","modelAnswer":"","lines":0,"level":0,"difficulty":1,"grade":1,"evidence":"اقتباس من الصفحة","page":1}]}\n' +
      'كل عنصر يحتوي كل الحقول السابقة. pairs شكلها [{"a":"...","b":"..."}].';
  };

  /* ===== فحص آلي لكل سؤال ===== */
  M.aiCheck = function (x) {
    var w = [];
    if (!M.TYPE[x.type]) { w.push('نوع غير معروف'); return w; }
    if (x.type === 'mcq') {
      if ((x.options || []).length !== 4) w.push('عدد البدائل ليس ٤');
      if (!(x.correct >= 0 && x.correct < (x.options || []).length)) w.push('رقم الإجابة الصحيحة غير صالح');
      var seen = {}; (x.options || []).forEach(function (o) { var k = M.norm(o); if (seen[k]) w.push('بديلان متطابقان'); seen[k] = 1; });
    }
    if (x.type === 'complete' && !/\[\[.+?\]\]/.test(x.text)) w.push('لا يوجد فراغ [[ ]]');
    if (x.type === 'tf' && x.answer === false && !String(x.correction || '').trim()) w.push('عبارة خاطئة بدون تصويب');
    if (x.type === 'match' && (x.pairs || []).length < 3) w.push('أزواج التوصيل أقل من ٣');
    if (x.type !== 'match' && !String(x.text || '').trim()) w.push('نص السؤال فارغ');
    if (!String(x.evidence || '').trim()) w.push('بدون دليل من الكتاب');
    var dup = S.questions.find(function (q) { return q.lessonId && q.type === x.type && M.similarity(q.text + (q.term || ''), (x.text || '') + (x.term || '')) >= 0.8; });
    if (dup) w.push('يشبه سؤالاً موجوداً في البنك');
    return w;
  };
  var BLOCKING = /غير صالح|متطابقان|لا يوجد فراغ|أقل من|فارغ|غير معروف/;

  M.aiToQuestion = function (x, lessonId) {
    var q = M.newQuestion(x.type, lessonId);
    ['text', 'options', 'correct', 'answer', 'correction', 'pairs', 'extras', 'term', 'modelAnswer'].forEach(function (k) { if (x[k] != null) q[k] = x[k]; });
    q.text = String(q.text || ''); q.options = (q.options || []).map(String); q.pairs = (q.pairs || []).map(function (p) { return { a: String(p.a || ''), b: String(p.b || '') }; });
    q.correct = Number(q.correct) || 0; q.answer = q.answer !== false && q.answer !== 'false';
    if (x.lines > 0) q.lines = Math.min(10, Number(x.lines));
    q.level = Math.min(3, Math.max(0, Number(x.level) || 0));
    q.difficulty = Math.min(2, Math.max(0, Number(x.difficulty == null ? 1 : x.difficulty)));
    q.grade = Number(x.grade) > 0 ? Number(x.grade) : M.TYPE[x.type].grade;
    q.evidence = x.evidence || ''; q.evidencePage = Number(x.page) || 0;
    q.source = 'ai'; q.status = 'draft';
    if (q.type === 'mcq') { while (q.options.length < 2) q.options.push(''); }
    return q;
  };

  /* ===== الواجهة: صور شرح الدرس ===== */
  M.prepLessonImage = function (file) { return M.readFile(file, 'dataurl').then(function (d) { return M.shrinkImage(d, 2000); }); };

  M.lessonImagesCard = function (lesson) {
    var imgs = lesson.images || [];
    return '<div class="card"><div class="card-h"><div class="grow"><h3>صور شرح الدرس من الكتاب</h3><div class="small muted">صوّر صفحات <b>الشرح</b> (وليس الأسئلة) — والتطبيق يقرأها ويُنشئ منها الأسئلة</div></div><span class="small muted">' + n(imgs.length) + ' / ' + n(MAX_IMAGES) + '</span>' +
      '<button class="btn sm" id="li-add">' + I('t_image', 16) + ' إضافة صور / تصوير</button>' +
      '<button class="btn sm pri" id="li-gen">' + I('spark', 16) + ' توليد الأسئلة من الدرس</button></div>' +
      (imgs.length ? '<div class="row" style="gap:8px;align-items:flex-start">' + imgs.map(function (d, i) {
        return '<div style="position:relative"><img src="' + d + '" alt="صفحة ' + n(i + 1) + '" data-liview="' + i + '" style="width:96px;height:128px;object-fit:cover;border:1px solid var(--line);border-radius:8px;cursor:zoom-in"><span class="chip" style="position:absolute;top:4px;inset-inline-start:4px">' + n(i + 1) + '</span>' +
          '<button class="btn icon sm" data-lidel="' + i + '" aria-label="حذف الصورة" style="position:absolute;top:2px;inset-inline-end:2px;min-height:28px;width:28px;background:#fff">' + I('x', 14) + '</button></div>';
      }).join('') + '</div>' : '<div class="small muted">نصائح: صفحة واحدة في كل صورة، إضاءة جيدة، الكاميرا موازية للصفحة، والنص واضح ومقروء. حتى ' + n(MAX_IMAGES) + ' صفحة للدرس.</div>') + '</div>';
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
        }).then(function () { M.sound && M.sound('success'); M.render(); });
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

  /* ===== نافذة التوليد الموحدة ===== */
  M.aiDialog2 = function (lesson) {
    var imgs = lesson.images || [];
    if (!imgs.length && !String(lesson.content || '').trim()) return M.toast('أضف صور شرح الدرس أولاً (أو اكتب نص الدرس)', 'bad');
    var routes = M.aiRoutes();
    var tab = routes.length ? 'auto' : 'manual';
    var sel = ['mcq', 'tf', 'complete', 'reason'];
    var routeLabel = function (r) { return M.AI_PROVIDERS[r.provider].name + (r.via === 'cloud' ? ' — عبر خادم المدرسة' : ' — بمفتاح هذا الجهاز'); };
    M.modal({ title: 'توليد الأسئلة من الدرس — ' + lesson.name, wide: true,
      body: '<div class="alert info">' + I('t_image') + '<div>المصدر: <b>' + n(imgs.length) + ' صفحة شرح</b>' + (lesson.content ? ' + نص الدرس' : '') + ' — الأسئلة تُبنى من محتوى الدرس فقط، ومع كل سؤال دليل مقتبس من الكتاب.</div></div>' +
        '<div class="field"><span class="lbl">أنواع الأسئلة</span><div class="row" id="g2-types" style="gap:6px">' + M.TYPES.filter(function (t) { return t.id !== 'image'; }).map(function (t) { return '<label class="check chip" style="min-height:34px"><input type="checkbox" value="' + t.id + '"' + (sel.indexOf(t.id) >= 0 ? ' checked' : '') + '>' + t.label + '</label>'; }).join('') + '</div></div>' +
        '<div class="grid2"><div class="field"><label for="g2-n">عدد الأسئلة لكل نوع</label><input id="g2-n" class="inp" inputmode="numeric" value="٦"></div>' +
        '<div class="field"><label for="g2-x">تعليمات إضافية (اختياري)</label><input id="g2-x" class="inp" placeholder="مثال: ركّز على القوانين والوحدات"></div></div>' +
        '<div class="seg" id="g2-tab"><button type="button" data-v="auto" class="' + (tab === 'auto' ? 'on' : '') + '">تلقائي عبر API</button><button type="button" data-v="manual" class="' + (tab === 'manual' ? 'on' : '') + '">يدوي: نسخ الطلب ولصق النتيجة</button></div>' +
        '<div id="g2-auto" class="card" style="padding:12px;display:flex;flex-direction:column;gap:10px">' +
        (routes.length ? '<div class="grid2"><div class="field"><label for="g2-r">مزود الذكاء الاصطناعي</label><select id="g2-r" class="inp">' + routes.map(function (r, i) { return '<option value="' + i + '">' + esc(routeLabel(r)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="g2-m">النموذج</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select id="g2-m" class="inp"><option>جاري تحميل النماذج…</option></select><button type="button" class="btn icon" id="g2-mr" aria-label="تحديث القائمة">' + I('shuffle', 16) + '</button></div></div></div>' +
          '<div class="row"><button type="button" class="btn pri" id="g2-go">' + I('spark') + ' توليد الآن</button><span class="small muted">قد يستغرق دقيقة أو اثنتين</span></div>'
          : '<div class="alert warn">' + I('warn') + '<div>لا يوجد مفتاح API بعد. أضف أي مفتاح (Claude أو ChatGPT أو Gemini) من <a href="#/settings" data-x>الإعدادات</a>، أو سجّل الدخول للخادم الأونلاين — أو استخدم الوضع اليدوي.</div></div>') + '</div>' +
        '<div id="g2-manual" class="card" style="padding:12px;display:flex;flex-direction:column;gap:10px">' +
        '<ol class="small" style="margin:0;padding-inline-start:20px;line-height:1.9"><li>انسخ الطلب' + (imgs.length ? ' ونزّل صور الصفحات' : '') + '.</li><li>افتح Claude أو ChatGPT أو Gemini، الصق الطلب' + (imgs.length ? ' وارفق الصور بنفس الترتيب' : '') + ' وأرسل.</li><li>انسخ الرد (JSON) والصقه هنا، أو احفظه كملف وارفعه.</li></ol>' +
        '<div class="row"><button type="button" class="btn" id="g2-copy">' + I('copy') + ' نسخ الطلب</button>' + (imgs.length ? '<button type="button" class="btn" id="g2-dl">' + I('download') + ' تنزيل صور الصفحات (' + n(imgs.length) + ')</button>' : '') + '<button type="button" class="btn ghost" id="g2-show">عرض الطلب</button></div>' +
        '<textarea id="g2-p" class="inp" style="min-height:140px;font-size:12.5px;display:none" readonly></textarea>' +
        '<div class="field"><label for="g2-j">الصق الرد هنا</label><textarea id="g2-j" class="inp" dir="ltr" style="min-height:120px;font-size:12.5px;text-align:left" placeholder=\'{"notes":"","questions":[...]}\'></textarea></div>' +
        '<div class="row"><button type="button" class="btn pri" id="g2-imp">مراجعة الأسئلة</button><button type="button" class="btn" id="g2-file">' + I('merge') + ' رفع ملف JSON</button></div></div>' +
        '<div id="g2-st"></div>',
      onMount: function (m, close) {
        var models = {};
        var opts = function () {
          var types = M.qsa('#g2-types input:checked', m).map(function (i) { return i.value; });
          return { lesson: lesson, images: imgs, types: types, count: Math.min(15, Math.max(1, Number(M.toWestern(M.qs('#g2-n', m).value)) || 6)), extra: M.qs('#g2-x', m).value.trim() };
        };
        var showTab = function () {
          M.qs('#g2-auto', m).style.display = tab === 'auto' ? '' : 'none';
          M.qs('#g2-manual', m).style.display = tab === 'manual' ? '' : 'none';
          M.qsa('#g2-tab button', m).forEach(function (b) { b.classList.toggle('on', b.dataset.v === tab); });
        };
        showTab();
        M.qsa('#g2-tab button', m).forEach(function (b) { b.onclick = function () { tab = b.dataset.v; showTab(); }; });
        var st = M.qs('#g2-st', m);
        var err = function (msg) { st.innerHTML = '<div class="alert bad">' + I('warn') + '<div>' + esc(msg) + '</div></div>'; M.sound && M.sound('error'); };

        /* النماذج */
        var loadModels = function (force) {
          var rs = M.qs('#g2-r', m); if (!rs) return;
          var r = routes[+rs.value], key = r.via + ':' + r.provider, ms = M.qs('#g2-m', m);
          var fill = function (list) {
            var def = M.aiDefaultModel(r.provider, list);
            ms.innerHTML = list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === def ? ' selected' : '') + '>' + esc(x.label === x.id ? x.id : x.label + ' — ' + x.id) + '</option>'; }).join('') || '<option value="">لا توجد نماذج</option>';
          };
          if (models[key] && !force) return fill(models[key]);
          ms.innerHTML = '<option>جاري تحميل النماذج…</option>';
          M.aiListModels(r).then(function (list) { models[key] = list; fill(list); }).catch(function (e) {
            ms.innerHTML = ''; var saved = (S.settings.aiModels || {})[r.provider];
            if (saved) ms.innerHTML = '<option value="' + esc(saved) + '">' + esc(saved) + '</option>';
            err('تعذّر تحميل قائمة النماذج: ' + friendly(e.message));
          });
        };
        var rsel = M.qs('#g2-r', m); if (rsel) { rsel.onchange = function () { loadModels(false); }; loadModels(false); }
        var mr = M.qs('#g2-mr', m); if (mr) mr.onclick = function () { loadModels(true); };

        var go = M.qs('#g2-go', m);
        if (go) go.onclick = function () {
          var o = opts(); if (!o.types.length) return M.toast('اختر نوعاً واحداً على الأقل', 'bad');
          var r = routes[+M.qs('#g2-r', m).value], model = M.qs('#g2-m', m).value;
          if (!model) return M.toast('اختر النموذج', 'bad');
          var am = Object.assign({}, S.settings.aiModels || {}); am[r.provider] = model; M.setSetting('aiModels', am);
          o.route = r; o.model = model;
          go.disabled = true;
          st.innerHTML = '<div class="alert info"><span class="pulse">' + I('spark') + '</span><div>جاري قراءة الدرس وإعداد الأسئلة عبر ' + esc(M.AI_PROVIDERS[r.provider].name) + '… <span id="g2-p2">٠ / ' + n(o.types.length) + '</span></div></div>';
          M.sound && M.sound('start');
          M.aiGenerate(o, function (d, t) { var p = M.qs('#g2-p2', m); if (p) p.textContent = n(d) + ' / ' + n(t); M.sound && M.sound('tick'); }).then(function (res) {
            M.log('توليد أسئلة من الدرس', lesson.name, M.AI_PROVIDERS[r.provider].name + ' ' + model + ' · عدد ' + res.questions.length + ' · توكنز ' + (res.usage.input_tokens + res.usage.output_tokens));
            if (!res.questions.length) { go.disabled = false; return err(res.errors.join(' — ') || 'لم تُقترح أسئلة'); }
            M.notifyDone && M.notifyDone('اكتمل توليد الأسئلة', res.questions.length + ' سؤال من درس ' + lesson.name + ' جاهزة للمراجعة');
            close(); M.aiReview(lesson, res);
          }).catch(function (e) { go.disabled = false; err(friendly(e.message)); });
        };

        /* اليدوي */
        var prompt = function () { var o = opts(); if (!o.types.length) { M.toast('اختر نوعاً واحداً على الأقل', 'bad'); return null; } return M.aiManualPrompt(o); };
        M.qs('#g2-copy', m).onclick = function () {
          var p = prompt(); if (!p) return;
          var ta = M.qs('#g2-p', m); ta.value = p;
          (navigator.clipboard ? navigator.clipboard.writeText(p) : Promise.reject()).then(function () { M.toast('تم نسخ الطلب', 'ok'); }).catch(function () { ta.style.display = ''; ta.select(); document.execCommand('copy'); M.toast('تم نسخ الطلب', 'ok'); });
        };
        M.qs('#g2-show', m).onclick = function () { var p = prompt(); if (!p) return; var ta = M.qs('#g2-p', m); ta.value = p; ta.style.display = ta.style.display === 'none' ? '' : 'none'; };
        var dl = M.qs('#g2-dl', m);
        if (dl) dl.onclick = function () {
          imgs.forEach(function (d, i) { setTimeout(function () { fetch(d).then(function (r) { return r.blob(); }).then(function (b) { M.download('صفحة-' + (i + 1) + '-' + lesson.name.replace(/[\\/:*?"<>|\s]+/g, '-') + '.jpg', b); }); }, i * 350); });
          M.toast('جاري تنزيل ' + n(imgs.length) + ' صورة');
        };
        var useJSON = function (txt, src) {
          var d; try { d = parseJSONText(txt); } catch (e) { return err('تعذّر قراءة JSON: ' + e.message); }
          M.log('استيراد أسئلة مولدة يدوياً', lesson.name, src + ' · عدد ' + d.questions.length);
          close(); M.aiReview(lesson, { questions: d.questions, notes: d.notes ? [d.notes] : [], errors: [], usage: {} });
        };
        M.qs('#g2-imp', m).onclick = function () { var t = M.qs('#g2-j', m).value.trim(); if (!t) return M.toast('الصق الرد أولاً', 'bad'); useJSON(t, 'لصق'); };
        M.qs('#g2-file', m).onclick = function () { M.pickFile('.json,.txt,application/json,text/plain').then(function (f) { if (!f[0]) return; M.readFile(f[0]).then(function (t) { useJSON(t, 'ملف ' + f[0].name); }); }); };
      } });
  };

  /* مراجعة الناتج قبل الإضافة للبنك */
  M.aiReview = function (lesson, res) {
    var items = res.questions.map(function (x) { return { x: x, warn: M.aiCheck(x), on: true }; });
    items.forEach(function (it) { if (it.warn.some(function (w) { return BLOCKING.test(w); })) it.on = false; });
    var ok = items.filter(function (it) { return M.TYPE[it.x.type]; });
    var html = (res.errors && res.errors.length ? '<div class="alert bad">' + I('warn') + '<div>' + res.errors.map(esc).join('<br>') + '</div></div>' : '') +
      (res.notes && res.notes.length ? '<div class="alert info">' + I('spark') + '<div>' + res.notes.map(esc).join('<br>') + '</div></div>' : '') +
      '<div class="row"><span class="small muted" style="flex:1">' + n(ok.length) + ' سؤال مقترح — راجع كل سؤال ودليله، وألغِ تحديد غير المناسب. المحدد يُضاف كمسودة.</span><button type="button" class="btn sm" id="ar-all">تحديد الكل</button><button type="button" class="btn sm" id="ar-none">إلغاء الكل</button></div>' +
      items.map(function (it, i) {
        if (!M.TYPE[it.x.type]) return '';
        var q = M.aiToQuestion(it.x, lesson.id);
        return '<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:6px"><div class="row"><input type="checkbox" data-ai="' + i + '"' + (it.on ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent)" aria-label="تحديد">' + M.typeChip(q.type) + '<span class="chip info">' + M.LEVELS[q.level] + '</span><span class="chip">' + M.DIFFS[q.difficulty] + '</span><span class="chip">' + esc(M.toArabic(M.gradeWord(q.grade))) + '</span>' + (it.x.page ? '<span class="chip">صفحة ' + n(it.x.page) + '</span>' : '') + '</div>' +
          '<div style="background:#E9EBF0;border-radius:8px;padding:8px">' + M.renderQuestionPreview(q, S.settings.digits) + '</div>' +
          '<div class="small"><b>الإجابة: </b>' + M.richText(q.type === 'match' ? q.pairs.map(function (p) { return p.a + ' ← ' + p.b; }).join(' · ') : M.answerText(q), 'arabic', { answers: true }) + '</div>' +
          '<div class="small" style="background:#FFFBEB;border-inline-start:3px solid #D97706;padding:6px 10px;border-radius:6px"><b>الدليل من الكتاب: </b>' + esc(it.x.evidence || '—') + '</div>' +
          (it.warn.length ? '<div class="alert warn small">' + I('warn') + '<div>' + it.warn.map(esc).join('، ') + '</div></div>' : '') + '</div>';
      }).join('');
    M.sound && M.sound('done');
    M.modal({ title: 'مراجعة الأسئلة المقترحة — ' + lesson.name, wide: true, body: ok.length ? html : '<div class="empty">لم تُقترح أسئلة صالحة.</div>',
      foot: '<button class="btn pri" data-ok>إضافة المحدد للبنك كمسودات</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        M.qsa('[data-ai]', m).forEach(function (c) { c.onchange = function () { items[+c.dataset.ai].on = c.checked; }; });
        var setAll = function (v) { M.qsa('[data-ai]', m).forEach(function (c) { c.checked = v; items[+c.dataset.ai].on = v; }); };
        var a = M.qs('#ar-all', m); if (a) a.onclick = function () { setAll(true); };
        var nn = M.qs('#ar-none', m); if (nn) nn.onclick = function () { setAll(false); };
        M.qs('[data-ok]', m).onclick = function () {
          var list = items.filter(function (it) { return it.on && M.TYPE[it.x.type]; }).map(function (it) { return M.aiToQuestion(it.x, lesson.id); });
          if (!list.length) return M.toast('لم يُحدد أي سؤال', 'bad');
          Promise.all(list.map(function (q) { return M.save('questions', q, { log: false }); })).then(function () {
            M.log('إضافة أسئلة مولدة', lesson.name, 'عدد ' + list.length + ' — مسودة للمراجعة');
            close(); M.toast('أضيف ' + n(list.length) + ' سؤال كمسودة — راجعها وأرسلها للاعتماد', 'ok'); M.render();
          });
        };
      } });
  };

  /* ===== إعدادات المفاتيح ===== */
  M.aiSettingsHTML = function () {
    var k = keys();
    return '<div class="card" id="ai-card"><h2 style="margin-bottom:6px">الذكاء الاصطناعي لتوليد الأسئلة</h2>' +
      '<p class="small muted" style="margin:0 0 10px">أضف أي مفتاح — Claude أو ChatGPT أو Gemini — ويتعرّف التطبيق على نوعه تلقائياً. المفاتيح تبقى على هذا الجهاز فقط ولا تدخل في الحزم أو النسخ الاحتياطية، والتكلفة على حساب صاحب المفتاح. (مع الخادم الأونلاين يكفي مفتاح واحد على الخادم لكل المدرسين.)</p>' +
      '<div class="row"><input id="ai-newk" class="inp" type="password" dir="ltr" style="max-width:420px" placeholder="الصق المفتاح هنا: sk-ant-… أو sk-… أو AIza…" autocomplete="off" aria-label="مفتاح API"><button class="btn pri" id="ai-addk">إضافة المفتاح</button></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">' + Object.keys(M.AI_PROVIDERS).map(function (p) {
        var P = M.AI_PROVIDERS[p], has = !!k[p];
        return '<div class="row" style="padding:8px 0;border-bottom:1px solid #EEF0F4"><b style="min-width:90px">' + P.name + '</b><span class="small muted" style="flex:1">' + P.by + ' · ' + (has ? '<span class="chip ok">مفعّل ••••' + esc(k[p].slice(-4)) + '</span>' + ((S.settings.aiModels || {})[p] ? ' النموذج: <span class="p-code">' + esc(S.settings.aiModels[p]) + '</span>' : '') : 'المفتاح من ' + P.site) + '</span>' +
          (has ? '<button class="btn sm" data-aitest="' + p + '">اختبار</button><button class="btn sm danger" data-aidel="' + p + '">حذف</button>' : '') + '</div>';
      }).join('') + '</div></div>';
  };
  M.bindAISettings = function (root) {
    var add = M.qs('#ai-addk', root);
    if (add) add.onclick = function () {
      var v = M.qs('#ai-newk', root).value.trim(), p = M.aiDetectProvider(v);
      if (!p) return M.toast('لم أتعرف على نوع المفتاح — Claude يبدأ بـ sk-ant- ، ChatGPT بـ sk- ، Gemini بـ AIza', 'bad');
      var k = keys(); k[p] = v;
      M.setSetting('aiKeys', k).then(function () { if (p === 'anthropic' && S.settings.aiKey) M.setSetting('aiKey', ''); M.toast('تمت إضافة مفتاح ' + M.AI_PROVIDERS[p].name, 'ok'); M.render(); });
    };
    M.qsa('[data-aidel]', root).forEach(function (b) { b.onclick = function () { var k = keys(); delete k[b.dataset.aidel]; var j = [M.setSetting('aiKeys', k)]; if (b.dataset.aidel === 'anthropic') j.push(M.setSetting('aiKey', '')); Promise.all(j).then(M.render); }; });
    M.qsa('[data-aitest]', root).forEach(function (b) {
      b.onclick = function () {
        var p = b.dataset.aitest; b.disabled = true; b.textContent = 'جاري الاختبار…';
        M.aiListModels({ via: 'local', provider: p }).then(function (list) {
          var am = Object.assign({}, S.settings.aiModels || {}); if (!am[p]) am[p] = M.aiDefaultModel(p, list);
          return M.setSetting('aiModels', am).then(function () { M.toast('المفتاح يعمل — ' + n(list.length) + ' نموذج متاح', 'ok'); M.render(); });
        }).catch(function (e) { b.disabled = false; b.textContent = 'اختبار'; M.toast(friendly(e.message), 'bad'); });
      };
    });
  };
})(window.M);
