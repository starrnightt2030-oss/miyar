/* قراءة مصادر الأسئلة على الجهاز: صور · PDF (نصي أو ممسوح) · Word (DOCX)
   كل مصدر يتحول إلى «صفحات» موحدة: { id, srcId, n, label, img (للإرسال)، orig (الأصل)، thumb، text، images[] }
   محتوى الملفات بيانات تعليمية فقط — لا يُنفَّذ منه شيء، ويُعرض دائماً كنص مُهرَّب */
(function (M) {
  'use strict';
  var LIM = M.SRC_LIMITS = { imageMB: 15, images: 30, pdfMB: 40, pdfPages: 300, perRun: 30, docxMB: 20, docxChars: 7000 };

  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function mb(f) { return f.size / 1048576; }
  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(err('bad-image', 'تعذّرت قراءة الصورة')); }; i.src = src; }); }
  function toJpeg(canvasOrImg, maxSide, q) {
    var w = canvasOrImg.width, h = canvasOrImg.height, s = Math.min(1, maxSide / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvasOrImg, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q || 0.85);
  }
  M.srcThumb = function (dataUrl) { return loadImg(dataUrl).then(function (i) { return toJpeg(i, 1100, 0.72); }); };

  /* نوع الملف */
  M.srcKind = function (f) {
    var nm = (f.name || '').toLowerCase();
    if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|bmp|gif)$/.test(nm)) return 'image';
    if (f.type === 'application/pdf' || /\.pdf$/.test(nm)) return 'pdf';
    if (/\.docx$/.test(nm) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (/\.doc$/.test(nm) || f.type === 'application/msword') return 'doc';
    return 'other';
  };

  /* ===== الصور ===== */
  M.srcFromImage = function (f, srcId, n) {
    if (mb(f) > LIM.imageMB) return Promise.reject(err('too-big', '«' + f.name + '» أكبر من ' + LIM.imageMB + ' ميجا'));
    return M.readFile(f, 'dataurl').then(function (d) { return loadImg(d); }).then(function (img) {
      var big = toJpeg(img, 2200, 0.9);
      return { id: M.uid(), srcId: srcId, n: n || 1, label: 'صورة ' + M.n(n || 1), img: big, orig: big, text: '', kind: 'image' };
    });
  };

  /* ===== PDF ===== */
  var pdfLib = null;
  function loadPdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfLib) pdfLib = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'js/vendor/pdfjs/pdf.min.js';
      s.onload = function () { if (!window.pdfjsLib) return rej(err('lib', 'تعذّر تحميل قارئ PDF')); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdfjs/pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = function () { pdfLib = null; rej(err('lib', 'تعذّر تحميل قارئ PDF — افتح التطبيق مرة بالإنترنت ثم أعد المحاولة')); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }
  M.pdfOpen = function (f) {
    if (mb(f) > LIM.pdfMB) return Promise.reject(err('too-big', '«' + f.name + '» أكبر من ' + LIM.pdfMB + ' ميجا — قسّمه أو صدّر الصفحات المطلوبة فقط'));
    return Promise.all([loadPdfLib(), M.readFile(f, 'buffer')]).then(function (x) {
      return x[0].getDocument({ data: new Uint8Array(x[1]), isEvalSupported: false }).promise;
    }).catch(function (e) {
      if (e && e.name === 'PasswordException') throw err('password', '«' + f.name + '» محمي بكلمة مرور — افتحه وصدّره بدون كلمة مرور ثم أعد المحاولة');
      if (e && (e.name === 'InvalidPDFException' || e.name === 'MissingPDFException' || e.name === 'UnexpectedResponseException')) throw err('corrupt', '«' + f.name + '» تالف أو ليس ملف PDF صحيحاً');
      throw e.code ? e : err('corrupt', 'تعذّرت قراءة «' + f.name + '»: ' + (e && e.message || ''));
    }).then(function (doc) {
      if (doc.numPages > LIM.pdfPages) throw err('too-many', '«' + f.name + '» فيه ' + M.n(doc.numPages) + ' صفحة — الحد ' + M.n(LIM.pdfPages));
      return doc;
    });
  };
  /* "1-3, 5" → [1,2,3,5] */
  M.parsePages = function (spec, max) {
    var s = M.toWestern(String(spec || '')).replace(/[،؛]/g, ',').replace(/[–—]/g, '-').trim();
    if (!s) { var all = []; for (var i = 1; i <= max; i++) all.push(i); return all; }
    var out = [];
    s.split(',').forEach(function (part) {
      var m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part); if (!m) throw err('pages', 'صيغة الصفحات غير صحيحة: «' + part.trim() + '» — مثال: 1-3, 5');
      var a = Number(m[1]), b = m[2] ? Number(m[2]) : a; if (a > b) { var t = a; a = b; b = t; }
      for (var k = a; k <= b; k++) { if (k < 1 || k > max) throw err('pages', 'الصفحة ' + M.n(k) + ' غير موجودة — الملف فيه ' + M.n(max) + ' صفحة'); if (out.indexOf(k) < 0) out.push(k); }
    });
    return out.sort(function (x, y) { return x - y; });
  };
  /* نص الصفحة من طبقة النص (إن وُجدت): سطور مرتبة من أعلى لأسفل، والعربية من اليمين */
  function pageText(page) {
    return page.getTextContent().then(function (tc) {
      var lines = {};
      tc.items.forEach(function (it) { if (!it.str || !it.str.trim()) return; var y = Math.round(it.transform[5] / 3); (lines[y] = lines[y] || []).push({ x: it.transform[4], s: it.str.normalize('NFKC') }); });
      return Object.keys(lines).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
        var row = lines[y], ar = row.some(function (r) { return /[؀-ۿ]/.test(r.s); });
        row.sort(function (a, b) { return ar ? b.x - a.x : a.x - b.x; });
        return row.map(function (r) { return r.s; }).join(' ').replace(/\s+/g, ' ').trim();
      }).filter(Boolean).join('\n');
    }).catch(function () { return ''; });
  }
  M.pdfPage = function (doc, n, srcId, name) {
    return doc.getPage(n).then(function (page) {
      var v1 = page.getViewport({ scale: 1 }), sc = Math.min(3, 1800 / Math.max(v1.width, v1.height) * (v1.width > v1.height ? 1 : 1.2)), vp = page.getViewport({ scale: sc });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      return page.render({ canvasContext: g, viewport: vp }).promise.then(function () { return pageText(page); }).then(function (txt) {
        var img = toJpeg(c, 2200, 0.88);
        var letters = (txt.match(/[؀-ۿA-Za-z]/g) || []).length;
        return { id: M.uid(), srcId: srcId, n: n, label: 'صفحة ' + M.n(n), img: img, orig: img, text: letters > 60 ? txt : '', scanned: letters <= 60, kind: 'pdf' };
      });
    });
  };

  /* ===== DOCX: قارئ ZIP صغير (بفك الضغط المدمج في المتصفح) ===== */
  function inflate(bytes) {
    if (!window.DecompressionStream) return Promise.reject(err('lib', 'المتصفح لا يدعم فتح ملفات Word — حدّث المتصفح أو احفظ الملف PDF'));
    var ds = new DecompressionStream('deflate-raw');
    var out = new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return out.then(function (b) { return new Uint8Array(b); });
  }
  function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw err('corrupt', 'الملف تالف أو ليس DOCX صحيحاً');
    var cnt = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), files = {};
    for (var k = 0; k < cnt; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw err('corrupt', 'الملف تالف');
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), loc = dv.getUint32(off + 42, true);
      var name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
      var lnl = dv.getUint16(loc + 26, true), lxl = dv.getUint16(loc + 28, true), start = loc + 30 + lnl + lxl;
      files[name] = { method: method, data: u8.subarray(start, start + csize) };
      off += 46 + nlen + xlen + clen;
    }
    return {
      has: function (n) { return !!files[n]; },
      bytes: function (n) { var f = files[n]; if (!f) return Promise.resolve(null); return f.method === 0 ? Promise.resolve(f.data) : f.method === 8 ? inflate(f.data) : Promise.reject(err('corrupt', 'ضغط غير مدعوم')); },
      text: function (n) { return this.bytes(n).then(function (b) { return b ? new TextDecoder().decode(b) : null; }); },
      names: Object.keys(files)
    };
  }
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  function kids(el) { return Array.prototype.slice.call(el.childNodes).filter(function (x) { return x.nodeType === 1; }); }
  function ln(el) { return el.localName; }
  M.docxRead = function (f) {
    if (mb(f) > LIM.docxMB) return Promise.reject(err('too-big', '«' + f.name + '» أكبر من ' + LIM.docxMB + ' ميجا'));
    return M.readFile(f, 'buffer').then(function (buf) {
      var z;
      try { z = unzip(buf); } catch (e) { throw e.code ? e : err('corrupt', '«' + f.name + '» تالف'); }
      if (z.has('EncryptedPackage') || !z.has('word/document.xml')) throw err(z.has('EncryptedPackage') ? 'password' : 'corrupt', z.has('EncryptedPackage') ? '«' + f.name + '» محمي بكلمة مرور' : '«' + f.name + '» ليس ملف Word صحيحاً');
      return Promise.all([z.text('word/document.xml'), z.text('word/_rels/document.xml.rels')]).then(function (x) {
        var dp = new DOMParser(), doc = dp.parseFromString(x[0], 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw err('corrupt', '«' + f.name + '» تالف');
        var rels = {};
        if (x[1]) { var rd = dp.parseFromString(x[1], 'application/xml'); Array.prototype.forEach.call(rd.getElementsByTagName('Relationship'), function (r) { rels[r.getAttribute('Id')] = r.getAttribute('Target'); }); }
        var body = doc.getElementsByTagNameNS(W, 'body')[0]; if (!body) throw err('corrupt', 'المستند فارغ');
        var blocks = [], imgs = [], page = 1, numCount = {}, para = 0, tables = 0;
        function runText(p, images) {
          var out = '';
          (function walk(el) {
            kids(el).forEach(function (c) {
              var n = ln(c);
              if (n === 't' && c.namespaceURI === W) out += c.textContent;
              else if (n === 'tab') out += '\t';
              else if (n === 'br') { if (c.getAttributeNS(W, 'type') === 'page') page++; else out += '\n'; }
              else if (n === 'lastRenderedPageBreak') page++;
              else if (n === 'oMath' || n === 'oMathPara') { var mt = Array.prototype.map.call(c.getElementsByTagName('*'), function (e) { return ln(e) === 't' ? e.textContent : ''; }).join(''); if (mt) out += ' $' + mt + '$ '; }
              else if (n === 'blip' || n === 'imagedata') { var rid = c.getAttribute('r:embed') || c.getAttribute('r:id') || c.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || c.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'); if (rid && rels[rid]) { images.push(rels[rid]); out += ' ⟪صورة⟫ '; } }
              else if (n !== 'instrText' && n !== 'delText') walk(c);
            });
          })(p);
          return out;
        }
        function numPrefix(p) {
          var np = p.getElementsByTagNameNS(W, 'numPr')[0]; if (!np) return '';
          var id = (np.getElementsByTagNameNS(W, 'numId')[0] || {}).getAttribute ? np.getElementsByTagNameNS(W, 'numId')[0].getAttributeNS(W, 'val') : '0';
          var lv = np.getElementsByTagNameNS(W, 'ilvl')[0] ? np.getElementsByTagNameNS(W, 'ilvl')[0].getAttributeNS(W, 'val') : '0';
          var k = id + ':' + lv; numCount[k] = (numCount[k] || 0) + 1;
          Object.keys(numCount).forEach(function (o) { if (o.indexOf(id + ':') === 0 && Number(o.split(':')[1]) > Number(lv)) numCount[o] = 0; });
          return (Number(lv) ? '(' + numCount[k] + ') ' : numCount[k] + ') ');
        }
        kids(body).forEach(function (el) {
          if (ln(el) === 'p') {
            para++; var ims = []; var t = runText(el, ims).replace(/[ \t]+/g, ' ').trim();
            if (t || ims.length) { var b = { k: 'p', i: para, page: page, text: (t ? numPrefix(el) : '') + t, imgs: [] }; ims.forEach(function (target) { b.imgs.push(imgs.length); imgs.push({ target: target, para: para }); }); blocks.push(b); }
          } else if (ln(el) === 'tbl') {
            tables++; var rows = [], tims = [];
            Array.prototype.forEach.call(el.getElementsByTagNameNS(W, 'tr'), function (tr) {
              rows.push(kids(tr).filter(function (c) { return ln(c) === 'tc'; }).map(function (tc) { return kids(tc).filter(function (c) { return ln(c) === 'p'; }).map(function (p) { return runText(p, tims).replace(/\s+/g, ' ').trim(); }).filter(Boolean).join(' / '); }));
            });
            var b2 = { k: 'table', i: para + 1, t: tables, page: page, rows: rows, imgs: [] };
            tims.forEach(function (target) { b2.imgs.push(imgs.length); imgs.push({ target: target, para: para + 1 }); });
            blocks.push(b2);
          }
        });
        /* تحميل الصور المدعومة فقط (EMF/WMF لا تُعرض في المتصفح) */
        var skipped = 0;
        return Promise.all(imgs.map(function (im) {
          var path = 'word/' + im.target.replace(/^\.?\//, '').replace(/^word\//, ''), ext = (path.split('.').pop() || '').toLowerCase();
          var mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext];
          if (!mime) { skipped++; return null; }
          return z.bytes(path).then(function (b) {
            if (!b) return null;
            return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(new Blob([b], { type: mime })); })
              .then(function (d) { return loadImg(d).then(function (i) { return toJpeg(i, 1600, 0.88); }).catch(function () { return null; }); });
          });
        })).then(function (data) { imgs.forEach(function (im, i) { im.data = data[i]; }); return { blocks: blocks, images: imgs, skipped: skipped, pages: page }; });
      });
    });
  };
  /* تقسيم المستند إلى أجزاء متتالية بلا تداخل (حتى لا تتكرر الأسئلة) */
  M.docxParts = function (d, srcId, name) {
    var parts = [], cur = null;
    function flush() { if (cur && cur.text.trim()) parts.push(cur); cur = null; }
    d.blocks.forEach(function (b) {
      var line = b.k === 'p' ? '[ف' + b.i + '] ' + b.text : '[جدول ' + b.t + ' عند الفقرة ' + b.i + ']\n' + b.rows.map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n');
      b.imgs.forEach(function (ix) { if (d.images[ix].data) line += ' [صورة ' + (ix + 1) + ']'; });
      if (!cur || (cur.text.length + line.length > LIM.docxChars && cur.text.length > 800)) {
        flush(); cur = { id: M.uid(), srcId: srcId, n: parts.length + 1, from: b.i, to: b.i, text: '', images: [], imageIdx: [], kind: 'docx', page0: b.page };
      }
      cur.text += line + '\n'; cur.to = b.i;
      b.imgs.forEach(function (ix) { if (d.images[ix].data && cur.images.length < 8) { cur.images.push(d.images[ix].data); cur.imageIdx.push(ix + 1); } });
    });
    flush();
    parts.forEach(function (p) { p.label = 'الفقرات ' + M.n(p.from) + '–' + M.n(p.to); });
    return parts;
  };
})(window.M);
