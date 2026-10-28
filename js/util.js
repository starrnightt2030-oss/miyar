/* أدوات عامة — معيار */
window.M = window.M || {};
(function (M) {
  'use strict';

  M.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };

  M.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var AR = '٠١٢٣٤٥٦٧٨٩';
  M.toArabic = function (s) {
    return String(s == null ? '' : s)
      .replace(/(\d)\.(\d)/g, '$1٫$2')
      .replace(/[0-9]/g, function (c) { return AR[+c]; });
  };
  M.toWestern = function (s) {
    return String(s == null ? '' : s)
      .replace(/٫/g, '.')
      .replace(/[٠-٩]/g, function (c) { return String(AR.indexOf(c)); });
  };
  M.digits = function (s, mode) { return mode === 'english' ? M.toWestern(s) : M.toArabic(s); };
  /* أرقام الواجهة دائماً هندية */
  M.n = function (x) { return M.toArabic(x); };

  M.now = function () { return new Date().toISOString(); };
  M.fmtDate = function (iso, withTime) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    var s = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    if (withTime) s += ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return s;
  };
  M.today = function () { return new Date().toISOString().slice(0, 10); };

  M.debounce = function (fn, ms) {
    var t;
    return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); };
  };

  M.qs = function (sel, root) { return (root || document).querySelector(sel); };
  M.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  M.toast = function (msg, kind) {
    var box = M.qs('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, kind === 'bad' ? 6000 : 3200);
  };

  /* نافذة منبثقة. يرجع دالة الإغلاق */
  M.modal = function (opts) {
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + M.esc(opts.title) + '">' +
      '<div class="modal-h"><h2>' + M.esc(opts.title) + '</h2><button class="btn icon ghost" data-x aria-label="إغلاق">' + M.icon('x') + '</button></div>' +
      '<div class="modal-b">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="modal-f">' + opts.foot + '</div>' : '') + '</div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) close(); });
    if (opts.onMount) opts.onMount(ov.querySelector('.modal'), close);
    var f = ov.querySelector('input,select,textarea'); if (f) setTimeout(function () { f.focus(); }, 30);
    return close;
  };

  M.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      M.modal({
        title: title,
        body: '<p style="margin:0">' + M.esc(text) + '</p>',
        foot: '<button class="btn ' + (danger ? 'danger' : 'pri') + '" data-ok>' + M.esc(okLabel || 'تأكيد') + '</button><button class="btn" data-x>إلغاء</button>',
        onMount: function (m, close) { m.querySelector('[data-ok]').onclick = function () { done = true; close(); resolve(true); }; },
        onClose: function () { if (!done) resolve(false); }
      });
    });
  };

  M.prompt = function (title, label, value) {
    return new Promise(function (resolve) {
      var done = false;
      M.modal({
        title: title,
        body: '<div class="field"><label for="pv">' + M.esc(label) + '</label><input id="pv" class="inp" value="' + M.esc(value || '') + '"></div>',
        foot: '<button class="btn pri" data-ok>حفظ</button><button class="btn" data-x>إلغاء</button>',
        onMount: function (m, close) {
          var go = function () { done = true; var v = m.querySelector('#pv').value.trim(); close(); resolve(v); };
          m.querySelector('[data-ok]').onclick = go;
          m.querySelector('#pv').onkeydown = function (e) { if (e.key === 'Enter') go(); };
        },
        onClose: function () { if (!done) resolve(null); }
      });
    });
  };

  M.download = function (name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  /* مشاركة ملف على الموبايل عند الإمكان، وإلا تنزيل */
  M.shareOrDownload = function (name, blob, title) {
    try {
      var file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: title || name }).catch(function () { M.download(name, blob); });
      }
    } catch (e) { /* ignore */ }
    M.download(name, blob);
    return Promise.resolve();
  };

  M.readFile = function (file, as) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      if (as === 'dataurl') r.readAsDataURL(file);
      else if (as === 'buffer') r.readAsArrayBuffer(file);
      else r.readAsText(file, 'utf-8');
    });
  };

  M.pickFile = function (accept, multiple) {
    return new Promise(function (res) {
      var i = document.createElement('input');
      i.type = 'file'; i.accept = accept || ''; i.multiple = !!multiple;
      i.onchange = function () { res(Array.prototype.slice.call(i.files || [])); };
      i.click();
    });
  };

  /* تصغير صورة قبل الحفظ للحفاظ على حجم البنك */
  M.shrinkImage = function (dataUrl, maxSide) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, (maxSide || 1200) / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = function () { res(dataUrl); };
      img.src = dataUrl;
    });
  };

  /* بصمة SHA-256 (مع بديل عند عدم توفر crypto.subtle) */
  M.hash = function (text) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      }).catch(fallback);
    }
    return Promise.resolve(fallback());
    function fallback() {
      var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (var i = 0; i < text.length; i++) {
        var ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return 'fnv-' + (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
    }
  };

  /* مولد أرقام عشوائية ثابت بالبذرة */
  M.rng = function (seed) {
    var a = 0;
    var s = String(seed);
    for (var i = 0; i < s.length; i++) a = (Math.imul(31, a) + s.charCodeAt(i)) | 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  M.shuffle = function (arr, rnd) {
    var a = arr.slice(); rnd = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  /* تطبيع النص العربي للمقارنة وكشف التكرار */
  M.norm = function (s) {
    return M.toWestern(String(s || ''))
      .replace(/[ً-ْـ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[^؀-ۿa-zA-Z0-9]+/g, ' ')
      .trim().toLowerCase();
  };
  M.similarity = function (a, b) {
    var A = M.norm(a).split(' ').filter(Boolean), B = M.norm(b).split(' ').filter(Boolean);
    if (!A.length || !B.length) return 0;
    var sa = {}, inter = 0, uni = {};
    A.forEach(function (w) { sa[w] = 1; uni[w] = 1; });
    B.forEach(function (w) { if (sa[w]) { inter++; sa[w] = 0; } uni[w] = 1; });
    return inter / Object.keys(uni).length;
  };

  M.gradeWord = function (g) {
    var n = Number(g);
    if (!isFinite(n)) return '';
    var s = String(Math.round(n * 100) / 100);
    if (n === 1) return 'درجة واحدة';
    if (n === 2) return 'درجتان';
    if (n === 0.5) return 'نصف درجة';
    if (n >= 3 && n <= 10 && n === Math.floor(n)) return s + ' درجات';
    return s + ' درجة';
  };
  var ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
  M.ordinal = function (i) { return ORD[i] || String(i + 1); };
  M.AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل'];
  M.EN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  var IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    bank: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    exam: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    review: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>',
    merge: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    docs: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M8 7h8M8 11h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>',
    up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    print: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    back: '<path d="M9 6l6 6-6 6"/>',
    file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    /* أنواع الأسئلة */
    t_mcq: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M12 7h8M12 17h8"/>',
    t_tf: '<path d="M3 12l4 4 6-8"/><path d="M15 9l6 6M21 9l-6 6"/>',
    t_complete: '<path d="M3 9h5M16 9h5M3 15h18"/><path d="M10 9h4" stroke-dasharray="1.5 2"/>',
    t_match: '<circle cx="4" cy="6" r="1.8"/><circle cx="20" cy="18" r="1.8"/><circle cx="4" cy="18" r="1.8"/><circle cx="20" cy="6" r="1.8"/><path d="M6 6l12 12M6 18L18 6"/>',
    t_term: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/>',
    t_reason: '<path d="M9 9a3 3 0 115 2.2c-1 .8-2 1.4-2 2.8M12 18h.01"/><circle cx="12" cy="12" r="9"/>',
    t_essay: '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>',
    t_draw: '<path d="M4 20L20 20 4 6z"/><path d="M4 16h4v4"/>',
    t_image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
    t_problem: '<path d="M5 12h6M8 9v6M14 10h5M14 14h5"/><rect x="2" y="3" width="20" height="18" rx="3"/>'
  };
  M.icon = function (name, size) {
    var s = size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>';
  };
})(window.M);
