/* أدوات الصورة: قص · تبييض الخلفية وتحسين التباين · تدوير — كلها على الجهاز */
(function (M) {
  'use strict';
  var I = M.icon;

  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }

  /* تبييض: الخلفية الرمادية لصور الموبايل تصبح بيضاء، والخطوط أغمق */
  function whiten(img, strength) {
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    /* نقدّر لون الورق من أفتح ١٠٪ من البكسلات */
    var hist = new Array(256).fill(0), i, L;
    for (i = 0; i < p.length; i += 16) hist[Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2])]++;
    var total = hist.reduce(function (a, b) { return a + b; }, 0), acc = 0, white = 255;
    for (L = 255; L >= 0; L--) { acc += hist[L]; if (acc > total * 0.12) { white = L; break; } }
    var black = Math.min(white - 60, 70 + (1 - strength) * 30), span = Math.max(30, white * (0.92 - 0.12 * strength) - black);
    for (i = 0; i < p.length; i += 4) {
      for (var k = 0; k < 3; k++) {
        var v = (p[i + k] - black) / span;
        v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, 1.15);
        p[i + k] = Math.round(v * 255);
      }
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/jpeg', 0.9);
  }
  function rotate(img, deg) {
    var c = document.createElement('canvas'), r = deg % 180 !== 0;
    c.width = r ? img.height : img.width; c.height = r ? img.width : img.height;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.translate(c.width / 2, c.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(img, -img.width / 2, -img.height / 2);
    return c.toDataURL('image/jpeg', 0.92);
  }
  function crop(img, box) {
    var x = Math.round(box.x * img.width), y = Math.round(box.y * img.height), w = Math.max(8, Math.round(box.w * img.width)), h = Math.max(8, Math.round(box.h * img.height));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }
  /* قص الحواف البيضاء تلقائياً (للشعارات) */
  M.trimWhite = function (src) {
    return loadImg(src).then(function (img) {
      var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      var g = c.getContext('2d'); g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
      var minX = W, minY = H, maxX = -1, maxY = -1;
      for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) {
        var o = (y * W + x) * 4; if (d[o + 3] < 20) continue;
        if (d[o] < 235 || d[o + 1] < 235 || d[o + 2] < 235) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      if (maxX < 0) return src;
      var pad = Math.round(Math.max(W, H) * 0.02);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(W, maxX + pad); maxY = Math.min(H, maxY + pad);
      if (maxX - minX > W * 0.97 && maxY - minY > H * 0.97) return src;
      var o2 = document.createElement('canvas'); o2.width = maxX - minX; o2.height = maxY - minY;
      o2.getContext('2d').drawImage(img, minX, minY, o2.width, o2.height, 0, 0, o2.width, o2.height);
      return o2.toDataURL('image/png');
    });
  };
  M.cropImage = function (src, box) { return loadImg(src).then(function (img) { return crop(img, box); }); };

  /* نافذة أدوات الصورة */
  M.imageTools = function (src, onDone) {
    var cur = src, hist = [], box = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }, cropping = false;
    M.modal({ title: 'أدوات الصورة', wide: true,
      body: '<div class="row" style="gap:6px" id="it-bar">' +
        '<button type="button" class="btn sm" data-a="crop">' + I('fit', 16) + ' قص</button>' +
        '<button type="button" class="btn sm" data-a="white">' + I('spark', 16) + ' تبييض الخلفية وتوضيح الخطوط</button>' +
        '<button type="button" class="btn sm" data-a="rot">↻ تدوير</button>' +
        '<span style="flex:1"></span><button type="button" class="btn sm" data-a="undo">' + I('undo', 16) + ' تراجع</button></div>' +
        '<div class="it-stage" id="it-stage"><div class="it-wrap" id="it-wrap"><img id="it-img" alt="الصورة"><div class="it-crop" id="it-crop" hidden><span data-h="nw"></span><span data-h="ne"></span><span data-h="sw"></span><span data-h="se"></span></div></div></div>' +
        '<div class="small muted" id="it-hint">اختر أداة. القص: حرّك المربع من أركانه أو اسحبه ثم «تطبيق القص».</div>',
      foot: '<button class="btn pri" data-ok>حفظ الصورة</button><button class="btn" id="it-apply" hidden>تطبيق القص</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var im = M.qs('#it-img', m), cr = M.qs('#it-crop', m), wrap = M.qs('#it-wrap', m), ap = M.qs('#it-apply', m);
        var show = function () { im.src = cur; };
        var place = function () { cr.style.left = box.x * 100 + '%'; cr.style.top = box.y * 100 + '%'; cr.style.width = box.w * 100 + '%'; cr.style.height = box.h * 100 + '%'; };
        var set = function (p) { p.then(function (d) { hist.push(cur); cur = d; show(); }); };
        show();
        M.qsa('[data-a]', m).forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.a;
            if (a === 'crop') { cropping = !cropping; cr.hidden = !cropping; ap.hidden = !cropping; place(); return; }
            if (a === 'white') set(loadImg(cur).then(function (img) { return whiten(img, 0.8); }));
            if (a === 'rot') set(loadImg(cur).then(function (img) { return rotate(img, 90); }));
            if (a === 'undo' && hist.length) { cur = hist.pop(); show(); }
          };
        });
        ap.onclick = function () { set(loadImg(cur).then(function (img) { return crop(img, box); })); cropping = false; cr.hidden = true; ap.hidden = true; box = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }; };
        /* سحب مربع القص */
        var drag = null;
        cr.addEventListener('pointerdown', function (ev) {
          ev.preventDefault(); cr.setPointerCapture(ev.pointerId);
          drag = { h: ev.target.dataset.h || 'move', x: ev.clientX, y: ev.clientY, b: Object.assign({}, box), r: wrap.getBoundingClientRect() };
        });
        cr.addEventListener('pointermove', function (ev) {
          if (!drag) return;
          var dx = (ev.clientX - drag.x) / drag.r.width, dy = (ev.clientY - drag.y) / drag.r.height, b = Object.assign({}, drag.b), MIN = 0.06;
          if (drag.h === 'move') { b.x = Math.min(1 - b.w, Math.max(0, b.x + dx)); b.y = Math.min(1 - b.h, Math.max(0, b.y + dy)); }
          else {
            if (drag.h.indexOf('w') >= 0) { var nx = Math.min(b.x + b.w - MIN, Math.max(0, b.x + dx)); b.w += b.x - nx; b.x = nx; }
            if (drag.h.indexOf('e') >= 0) b.w = Math.min(1 - b.x, Math.max(MIN, b.w + dx));
            if (drag.h.indexOf('n') >= 0) { var ny = Math.min(b.y + b.h - MIN, Math.max(0, b.y + dy)); b.h += b.y - ny; b.y = ny; }
            if (drag.h.indexOf('s') >= 0) b.h = Math.min(1 - b.y, Math.max(MIN, b.h + dy));
          }
          box = b; place();
        });
        cr.addEventListener('pointerup', function () { drag = null; });
        M.qs('[data-ok]', m).onclick = function () { close(); onDone(cur); };
      } });
  };
})(window.M);
