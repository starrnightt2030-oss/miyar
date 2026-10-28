/* المعادلات: صيغة مبسطة داخل $...$ تُعرض بدقة طباعية وتحترم الأرقام الهندية/الإنجليزية
   \frac{أ}{ب}  \sqrt{س}  \sqrt[3]{س}  س^{2}  س_{1}  \vec{AB}  \bar{AB}  \vop{+}{125,37}  */
(function (M) {
  'use strict';
  var SYM = {
    times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', ge: '≥', ne: '≠', approx: '≈', pi: 'π', infty: '∞', deg: '°', angle: '∠',
    to: '→', eq: '⇌', cdot: '·', perp: '⊥', parallel: '∥', triangle: '△', therefore: '∴', because: '∵', in: '∈', notin: '∉',
    subset: '⊂', cup: '∪', cap: '∩', empty: 'Ø', alpha: 'α', beta: 'β', theta: 'θ', lambda: 'λ', mu: 'μ', omega: 'ω', Omega: 'Ω', Delta: 'Δ', sum: '∑', minus: '−'
  };
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', 'n': 'ⁿ' };
  var SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '(': '₍', ')': '₎' };

  function group(s, i) {
    if (s[i] !== '{') return [s[i] || '', i + 1];
    var d = 0;
    for (var j = i; j < s.length; j++) {
      if (s[j] === '{') d++;
      else if (s[j] === '}') { d--; if (d === 0) return [s.slice(i + 1, j), j + 1]; }
    }
    return [s.slice(i + 1), s.length];
  }
  function cmdAt(s, i) { var m = /^\\([a-zA-Z]+)/.exec(s.slice(i)); return m ? m[1] : null; }

  /* شجرة بسيطة */
  function parse(s) {
    var out = [], buf = '', i = 0;
    function flush() { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } }
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        var cmd = cmdAt(s, i);
        if (!cmd) { buf += c; i++; continue; }
        i += cmd.length + 1;
        if (cmd === 'frac') { var a = group(s, i); var b = group(s, a[1]); flush(); out.push({ t: 'frac', a: parse(a[0]), b: parse(b[0]) }); i = b[1]; }
        else if (cmd === 'sqrt') {
          var idx = '';
          if (s[i] === '[') { var e = s.indexOf(']', i); idx = s.slice(i + 1, e); i = e + 1; }
          var g = group(s, i); flush(); out.push({ t: 'sqrt', n: idx, a: parse(g[0]) }); i = g[1];
        }
        else if (cmd === 'vec' || cmd === 'bar') { var g2 = group(s, i); flush(); out.push({ t: cmd, a: parse(g2[0]) }); i = g2[1]; }
        else if (cmd === 'vop') {
          var op = group(s, i); var nums = group(s, op[1]); flush();
          out.push({ t: 'vop', op: op[0], nums: nums[0].split(/[,،\n]/).map(function (x) { return x.trim(); }).filter(Boolean) }); i = nums[1];
        }
        else if (SYM[cmd]) buf += SYM[cmd];
        else buf += '\\' + cmd;
      } else if (c === '^' || c === '_') {
        var g3 = group(s, i + 1); flush(); out.push({ t: c === '^' ? 'sup' : 'sub', a: parse(g3[0]) }); i = g3[1];
      } else { buf += c; i++; }
    }
    flush();
    return out;
  }

  function html(nodes, T) {
    return nodes.map(function (nd) {
      switch (nd.t) {
        case 'text': return T(nd.v);
        case 'frac': return '<span class="m-frac"><span class="m-num">' + html(nd.a, T) + '</span><span class="m-den">' + html(nd.b, T) + '</span></span>';
        case 'sqrt': return '<span class="m-sqrt">' + (nd.n ? '<span class="m-idx">' + T(nd.n) + '</span>' : '') + '<span class="m-rad">√</span><span class="m-under">' + html(nd.a, T) + '</span></span>';
        case 'sup': return '<sup>' + html(nd.a, T) + '</sup>';
        case 'sub': return '<sub>' + html(nd.a, T) + '</sub>';
        case 'vec': return '<span class="m-vec">' + html(nd.a, T) + '</span>';
        case 'bar': return '<span class="m-bar">' + html(nd.a, T) + '</span>';
        case 'vop':
          var rows = nd.nums.map(function (x, k) { return '<span class="m-op">' + (k === nd.nums.length - 1 ? T(nd.op) : '') + '</span><span class="m-n">' + T(x) + '</span>'; }).join('');
          return '<span class="m-vop" dir="ltr">' + rows + '<span class="m-line"></span><span class="m-op"></span><span class="m-n m-ans"></span></span>';
      }
      return '';
    }).join('');
  }

  M.mathHTML = function (src, mode) {
    var T = function (s) { return M.digits(M.esc(s), mode); };
    var rtl = /[؀-ۿ]/.test(src.replace(/\\[a-zA-Z]+/g, ''));
    return '<span class="m" dir="' + (rtl ? 'rtl' : 'ltr') + '">' + html(parse(src), T) + '</span>';
  };

  /* نص الورقة: معادلات + فراغات + أسطر */
  M.richText = function (s, mode, opts) {
    opts = opts || {};
    var parts = String(s == null ? '' : s).split(/(\$[^$]+\$)/g);
    return parts.map(function (p) {
      if (/^\$[^$]+\$$/.test(p)) return M.mathHTML(p.slice(1, -1), mode);
      var t = M.digits(M.esc(p), mode);
      t = opts.answers ? t.replace(/\[\[(.+?)\]\]/g, '<u class="ans">$1</u>') : t.replace(/\[\[(.+?)\]\]/g, '<span class="blank"></span>');
      return t.replace(/\n/g, '<br>');
    }).join('');
  };
  M.hasMath = function (s) { return /\$[^$]+\$/.test(String(s || '')); };

  /* لملفات Word: مقاطع نصية مع رفع وخفض */
  function runs(nodes, out, fmt) {
    nodes.forEach(function (nd) {
      if (nd.t === 'text') out.push({ text: nd.v, sup: fmt.sup, sub: fmt.sub });
      else if (nd.t === 'frac') { out.push({ text: '(' }); runs(nd.a, out, fmt); out.push({ text: ')/(' }); runs(nd.b, out, fmt); out.push({ text: ')' }); }
      else if (nd.t === 'sqrt') { if (nd.n) out.push({ text: nd.n, sup: true }); out.push({ text: '√(' }); runs(nd.a, out, fmt); out.push({ text: ')' }); }
      else if (nd.t === 'sup') runs(nd.a, out, { sup: true });
      else if (nd.t === 'sub') runs(nd.a, out, { sub: true });
      else if (nd.t === 'vec') { runs(nd.a, out, fmt); out.push({ text: '⃗' }); }
      else if (nd.t === 'bar') { out.push({ text: '‾' }); runs(nd.a, out, fmt); }
      else if (nd.t === 'vop') out.push({ text: nd.nums.join(' ' + nd.op + ' ') + ' = …………' });
    });
    return out;
  }
  M.mathRuns = function (src) { return runs(parse(src), [], {}); };
  /* نص سطري بسيط (للمفاتيح والبحث) */
  M.mathPlain = function (src) {
    return M.mathRuns(src).map(function (r) {
      if (r.sup) return r.text.split('').map(function (ch) { return SUP[ch] || ch; }).join('');
      if (r.sub) return r.text.split('').map(function (ch) { return SUB[ch] || ch; }).join('');
      return r.text;
    }).join('');
  };
  M.plainText = function (s) { return String(s || '').replace(/\$([^$]+)\$/g, function (_, m) { return M.mathPlain(m); }); };

  /* ===== محرر المعادلات ===== */
  var BTNS = [
    ['كسر', '\\frac{}{}', 6], ['جذر', '\\sqrt{}', 6], ['جذر نوني', '\\sqrt[3]{}', 9], ['أس', '^{}', 2], ['دليل سفلي', '_{}', 2], ['متجه', '\\vec{}', 5], ['خط فوق', '\\bar{}', 5],
    ['×', '\\times '], ['÷', '\\div '], ['±', '\\pm '], ['−', '\\minus '], ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '], ['≈', '\\approx '], ['π', '\\pi '], ['∞', '\\infty '], ['°', '\\deg'], ['∠', '\\angle '],
    ['△', '\\triangle '], ['∥', '\\parallel '], ['⊥', '\\perp '], ['∴', '\\therefore '], ['→', '\\to '], ['⇌', '\\eq '], ['θ', '\\theta '], ['Δ', '\\Delta '], ['Ω', '\\Omega '], ['μ', '\\mu '], ['λ', '\\lambda '],
    ['س', 'س'], ['ص', 'ص'], ['ع', 'ع'], ['جا', 'جا '], ['جتا', 'جتا '], ['ظا', 'ظا '], ['لو', 'لو '], ['نق', 'نق']
  ];
  M.mathEditor = function (initial, onInsert) {
    var digits = M.S.settings.digits || 'arabic';
    M.modal({ title: 'محرر المعادلات', wide: true,
      body: '<div class="symbar">' + BTNS.map(function (b, i) { return '<button type="button" class="btn sm" data-mb="' + i + '" style="min-width:40px;font-family:Naskh,serif">' + M.esc(b[0]) + '</button>'; }).join('') + '</div>' +
        '<div class="field"><label for="me-src">المعادلة</label><textarea id="me-src" class="inp" dir="auto" style="min-height:70px;font-family:monospace;font-size:15px">' + M.esc(initial || '') + '</textarea>' +
        '<div class="small muted">مثال: \\frac{3}{4} + س^{2} = \\sqrt{16} — الأزرار تكتب الصيغة، وما بين { } هو المحتوى.</div></div>' +
        '<div class="card" style="padding:12px"><div class="row" style="margin-bottom:8px"><b style="flex:1">المعاينة</b><div class="seg" id="me-dg"><button type="button" data-v="arabic" class="' + (digits !== 'english' ? 'on' : '') + '">١٢٣</button><button type="button" data-v="english" class="' + (digits === 'english' ? 'on' : '') + '">123</button></div></div><div id="me-pv" class="page" style="height:auto;min-height:60px;width:auto;box-shadow:none;padding:12px;font-size:20px;margin:0"></div></div>' +
        '<details class="card" style="padding:12px"><summary class="bold" style="cursor:pointer">عملية عمودية (جمع / طرح / ضرب)</summary><div class="grid2" style="margin-top:10px"><div class="field"><label for="vo-op">العملية</label><select id="vo-op" class="inp"><option value="+">جمع +</option><option value="−">طرح −</option><option value="×">ضرب ×</option></select></div>' +
        '<div class="field"><label for="vo-n">الأعداد (كل عدد في سطر)</label><textarea id="vo-n" class="inp" style="min-height:70px" dir="ltr">1250\n378</textarea></div></div><button type="button" class="btn sm" id="vo-add">إدراج العملية</button></details>',
      foot: '<button class="btn pri" data-ok>إدراج في السؤال</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var ta = M.qs('#me-src', m);
        var upd = function () { M.qs('#me-pv', m).innerHTML = ta.value.trim() ? M.mathHTML(ta.value, digits) : '<span class="muted small">اكتب أو استخدم الأزرار</span>'; };
        ta.oninput = upd; upd();
        M.qsa('[data-mb]', m).forEach(function (b) {
          b.onclick = function () {
            var d = BTNS[+b.dataset.mb], s = ta.selectionStart, e = ta.selectionEnd, ins = d[1];
            var sel = ta.value.slice(s, e);
            if (sel && d[2]) { ins = ins.slice(0, d[2]) + sel + ins.slice(d[2]); }
            ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
            ta.focus(); var pos = s + (d[2] && !sel ? d[2] : ins.length); ta.selectionStart = ta.selectionEnd = pos; upd();
          };
        });
        M.qsa('#me-dg button', m).forEach(function (b) { b.onclick = function () { digits = b.dataset.v; M.qsa('#me-dg button', m).forEach(function (x) { x.classList.toggle('on', x === b); }); upd(); }; });
        M.qs('#vo-add', m).onclick = function () {
          var nums = M.toWestern(M.qs('#vo-n', m).value).split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
          if (nums.length < 2) return M.toast('أدخل عددين على الأقل', 'bad');
          ta.value += (ta.value ? ' ' : '') + '\\vop{' + M.qs('#vo-op', m).value + '}{' + nums.join(',') + '}'; upd();
        };
        M.qs('[data-ok]', m).onclick = function () { var v = ta.value.trim(); if (!v) return M.toast('المعادلة فارغة', 'bad'); close(); onInsert('$' + v + '$'); };
      } });
  };
})(window.M);
