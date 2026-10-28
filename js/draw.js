/* أداة الرسم الهندسي: أشكال قابلة لإعادة التعديل وتُحفظ صورة نظيفة داخل السؤال */
(function (M) {
  'use strict';
  var W = 720, H = 440;
  var COLORS = ['#111827', '#1E3A8A', '#B91C1C', '#0E7C6B'];
  var TOOLS = [
    ['pen', 'قلم حر'], ['line', 'قطعة مستقيمة'], ['arrow', 'سهم / شعاع'], ['rect', 'مستطيل'], ['circle', 'دائرة'], ['poly', 'مضلع / مثلث'], ['point', 'نقطة بحرف'], ['text', 'نص'], ['angle', 'قوس زاوية']
  ];

  function drawShape(g, s) {
    g.save();
    g.strokeStyle = s.color || '#111827'; g.fillStyle = s.color || '#111827';
    g.lineWidth = s.w || 2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.setLineDash(s.dash ? [8, 6] : []);
    var p = s.pts || [];
    if (s.k === 'pen' && p.length > 1) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); p.forEach(function (q) { g.lineTo(q[0], q[1]); }); g.stroke(); }
    if ((s.k === 'line' || s.k === 'arrow') && p.length === 2) {
      g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.stroke();
      if (s.k === 'arrow') arrowHead(g, p[0], p[1], s.w || 2);
    }
    if (s.k === 'rect' && p.length === 2) { g.strokeRect(Math.min(p[0][0], p[1][0]), Math.min(p[0][1], p[1][1]), Math.abs(p[1][0] - p[0][0]), Math.abs(p[1][1] - p[0][1])); }
    if (s.k === 'circle' && p.length === 2) { var r = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]); g.beginPath(); g.arc(p[0][0], p[0][1], r, 0, Math.PI * 2); g.stroke(); }
    if (s.k === 'poly' && p.length > 1) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); p.slice(1).forEach(function (q) { g.lineTo(q[0], q[1]); }); if (s.closed) g.closePath(); g.stroke(); }
    if (s.k === 'point' && p.length) { g.setLineDash([]); g.beginPath(); g.arc(p[0][0], p[0][1], 3.5, 0, Math.PI * 2); g.fill(); if (s.text) label(g, s.text, p[0][0] + 8, p[0][1] - 8, s.color); }
    if (s.k === 'text' && p.length) label(g, s.text, p[0][0], p[0][1], s.color, s.size);
    if (s.k === 'angle' && p.length === 3) {
      var a1 = Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]), a2 = Math.atan2(p[2][1] - p[0][1], p[2][0] - p[0][0]);
      var d = a2 - a1; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
      g.setLineDash([]); g.beginPath(); g.arc(p[0][0], p[0][1], 26, a1, a1 + d, d < 0); g.stroke();
      if (s.right) { /* علامة الزاوية القائمة */ }
    }
    if (s.k === 'axes') axes(g, s);
    if (s.k === 'nline') numberLine(g, s);
    g.restore();
  }
  function arrowHead(g, a, b, w) {
    var ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 10 + w * 2;
    g.setLineDash([]); g.beginPath(); g.moveTo(b[0], b[1]);
    g.lineTo(b[0] - L * Math.cos(ang - 0.4), b[1] - L * Math.sin(ang - 0.4));
    g.lineTo(b[0] - L * Math.cos(ang + 0.4), b[1] - L * Math.sin(ang + 0.4)); g.closePath(); g.fill();
  }
  function label(g, t, x, y, color, size) {
    g.setLineDash([]); g.font = '600 ' + (size || 20) + 'px Naskh, "Plex Arabic", serif'; g.fillStyle = color || '#111827';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(t, x, y);
  }
  function axes(g, s) {
    var n = s.n || 5, cx = W / 2, cy = H / 2, u = Math.min((W - 80) / (2 * n), (H - 60) / (2 * n));
    g.lineWidth = 1; g.strokeStyle = '#D1D5DB'; g.setLineDash([]);
    if (s.grid) for (var i = -n; i <= n; i++) { g.beginPath(); g.moveTo(cx + i * u, cy - n * u); g.lineTo(cx + i * u, cy + n * u); g.stroke(); g.beginPath(); g.moveTo(cx - n * u, cy + i * u); g.lineTo(cx + n * u, cy + i * u); g.stroke(); }
    g.strokeStyle = '#111827'; g.fillStyle = '#111827'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - n * u - 14, cy); g.lineTo(cx + n * u + 14, cy); g.stroke(); arrowHead(g, [cx, cy], [cx + n * u + 16, cy], 1); arrowHead(g, [cx, cy], [cx - n * u - 16, cy], 1);
    g.beginPath(); g.moveTo(cx, cy + n * u + 14); g.lineTo(cx, cy - n * u - 14); g.stroke(); arrowHead(g, [cx, cy], [cx, cy - n * u - 16], 1); arrowHead(g, [cx, cy], [cx, cy + n * u + 16], 1);
    g.font = '13px "Plex Arabic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (var k = -n; k <= n; k++) {
      if (!k) continue;
      g.beginPath(); g.moveTo(cx + k * u, cy - 4); g.lineTo(cx + k * u, cy + 4); g.stroke();
      g.fillText(M.digits(String(k), s.digits), cx + k * u, cy + 7);
      g.beginPath(); g.moveTo(cx - 4, cy - k * u); g.lineTo(cx + 4, cy - k * u); g.stroke();
      g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(M.digits(String(k), s.digits), cx - 8, cy - k * u); g.textAlign = 'center'; g.textBaseline = 'top';
    }
    g.fillText(M.digits('0', s.digits), cx - 10, cy + 6);
    label(g, s.digits === 'english' ? 'x' : 'س', cx + n * u + 10, cy - 18, '#111827', 17);
    label(g, s.digits === 'english' ? 'y' : 'ص', cx + 16, cy - n * u - 12, '#111827', 17);
  }
  function numberLine(g, s) {
    var a = s.from == null ? -5 : s.from, b = s.to == null ? 5 : s.to, cy = H / 2, x0 = 50, x1 = W - 50, u = (x1 - x0) / (b - a);
    g.strokeStyle = '#111827'; g.fillStyle = '#111827'; g.lineWidth = 1.8; g.setLineDash([]);
    g.beginPath(); g.moveTo(x0 - 20, cy); g.lineTo(x1 + 20, cy); g.stroke(); arrowHead(g, [x0, cy], [x1 + 22, cy], 1); arrowHead(g, [x1, cy], [x0 - 22, cy], 1);
    g.font = '15px "Plex Arabic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (var k = a; k <= b; k++) { var x = x0 + (k - a) * u; g.beginPath(); g.moveTo(x, cy - 7); g.lineTo(x, cy + 7); g.stroke(); g.fillText(M.digits(String(k), s.digits), x, cy + 11); }
  }

  function render(g, shapes, grid, scale) {
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (grid) { g.strokeStyle = '#E5E7EB'; g.lineWidth = 1; for (var x = 0; x <= W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (var y = 0; y <= H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    shapes.forEach(function (s) { drawShape(g, s); });
  }

  /* قص الفراغ الأبيض حول الرسم */
  function exportPNG(shapes, grid) {
    var sc = 2, c = document.createElement('canvas'); c.width = W * sc; c.height = H * sc;
    var g = c.getContext('2d'); render(g, shapes, grid, sc);
    var d = g.getImageData(0, 0, c.width, c.height).data, minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    for (var y = 0; y < c.height; y += 2) for (var x = 0; x < c.width; x += 2) {
      var i = (y * c.width + x) * 4; if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    }
    if (grid || maxX <= minX) return c.toDataURL('image/png');
    var pad = 24; minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(c.width, maxX + pad); maxY = Math.min(c.height, maxY + pad);
    var o = document.createElement('canvas'); o.width = maxX - minX; o.height = maxY - minY;
    o.getContext('2d').drawImage(c, minX, minY, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }

  var PRESETS = {
    rtri: function () { return [{ k: 'poly', pts: [[220, 330], [500, 330], [220, 120]], closed: true, w: 2 }, { k: 'poly', pts: [[220, 310], [240, 310], [240, 330]], w: 1.5 }, { k: 'point', pts: [[220, 120]], text: 'أ' }, { k: 'point', pts: [[220, 330]], text: 'ب' }, { k: 'point', pts: [[500, 330]], text: 'ج' }]; },
    iso: function () { return [{ k: 'poly', pts: [[240, 340], [480, 340], [360, 110]], closed: true, w: 2 }, { k: 'point', pts: [[360, 110]], text: 'أ' }, { k: 'point', pts: [[240, 340]], text: 'ب' }, { k: 'point', pts: [[480, 340]], text: 'ج' }]; },
    rect: function () { return [{ k: 'rect', pts: [[200, 130], [520, 320]], w: 2 }, { k: 'point', pts: [[200, 130]], text: 'أ' }, { k: 'point', pts: [[520, 130]], text: 'ب' }, { k: 'point', pts: [[520, 320]], text: 'ج' }, { k: 'point', pts: [[200, 320]], text: 'د' }]; },
    circle: function () { return [{ k: 'circle', pts: [[360, 220], [480, 220]], w: 2 }, { k: 'line', pts: [[360, 220], [480, 220]], w: 1.5, dash: true }, { k: 'point', pts: [[360, 220]], text: 'م' }, { k: 'text', pts: [[420, 200]], text: 'نق' }]; },
    parallel: function () { return [{ k: 'line', pts: [[140, 160], [580, 160]], w: 2 }, { k: 'line', pts: [[140, 290], [580, 290]], w: 2 }, { k: 'line', pts: [[240, 380], [480, 70]], w: 2 }, { k: 'text', pts: [[600, 160]], text: 'ل١' }, { k: 'text', pts: [[600, 290]], text: 'ل٢' }]; },
    axes: function (dg) { return [{ k: 'axes', n: 5, grid: true, digits: dg }]; },
    nline: function (dg) { return [{ k: 'nline', from: -5, to: 5, digits: dg }]; }
  };

  M.drawEditor = function (initial, onDone) {
    var shapes = JSON.parse(JSON.stringify((initial && initial.shapes) || []));
    var grid = !!(initial && initial.grid);
    var st = { tool: 'line', color: COLORS[0], w: 2, dash: false, poly: null, drag: null };
    var undo = [];
    var digits = M.S.settings.digits || 'arabic';
    M.modal({ title: 'الرسم الهندسي', wide: true,
      body: '<div class="row" style="gap:6px" id="dr-tools">' + TOOLS.map(function (t) { return '<button type="button" class="btn sm' + (t[0] === st.tool ? ' pri' : '') + '" data-tool="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="row" style="gap:6px"><span class="small muted">أشكال جاهزة:</span>' +
        [['rtri', 'مثلث قائم'], ['iso', 'متساوي الساقين'], ['rect', 'مستطيل بحروف'], ['circle', 'دائرة ونصف قطر'], ['parallel', 'متوازيان وقاطع'], ['axes', 'مستوى إحداثي'], ['nline', 'خط أعداد']].map(function (p) { return '<button type="button" class="btn sm" data-pre="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        '<div class="row" style="gap:10px"><span class="small muted">اللون:</span>' + COLORS.map(function (c) { return '<button type="button" data-col="' + c + '" aria-label="لون" style="width:30px;height:30px;border-radius:99px;background:' + c + ';border:3px solid ' + (c === st.color ? '#9CC9BF' : '#fff') + ';box-shadow:0 0 0 1px #D5D9E1"></button>'; }).join('') +
        '<label class="small">السُمك <input type="range" id="dr-w" min="1" max="5" step="0.5" value="2"></label><label class="check small"><input type="checkbox" id="dr-dash"> متقطع</label><label class="check small"><input type="checkbox" id="dr-grid"' + (grid ? ' checked' : '') + '> شبكة في الصورة</label>' +
        '<span style="flex:1"></span><button type="button" class="btn sm" id="dr-close" hidden>إغلاق المضلع</button><button type="button" class="btn sm" id="dr-undo">تراجع</button><button type="button" class="btn sm danger" id="dr-clear">مسح الكل</button></div>' +
        '<div style="border:1px solid var(--line2);border-radius:10px;overflow:hidden;background:#fff"><canvas id="dr-c" width="' + W + '" height="' + H + '" style="width:100%;display:block;touch-action:none;cursor:crosshair"></canvas></div>' +
        '<div class="small muted" id="dr-hint">اسحب لرسم الخط. المضلع: انقر كل رأس ثم «إغلاق المضلع». النقطة والنص: انقر المكان ثم اكتب.</div>',
      foot: '<button class="btn pri" data-ok>حفظ الشكل</button><button class="btn" data-x>إلغاء</button>',
      onMount: function (m, close) {
        var cv = M.qs('#dr-c', m), g = cv.getContext('2d');
        var redraw = function (temp) { render(g, temp ? shapes.concat([temp]) : shapes, grid, 1); };
        redraw();
        var pos = function (e) { var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; };
        var base = function (k) { return { k: k, color: st.color, w: st.w, dash: st.dash, pts: [] }; };
        var push = function (s) { undo.push(JSON.stringify(shapes)); shapes.push(s); redraw(); };
        var closeBtn = M.qs('#dr-close', m);
        cv.addEventListener('pointerdown', function (e) {
          var p = pos(e); cv.setPointerCapture(e.pointerId);
          if (st.tool === 'point' || st.tool === 'text') {
            M.prompt(st.tool === 'point' ? 'حرف النقطة' : 'النص', st.tool === 'point' ? 'مثال: أ' : 'النص الذي يظهر في الرسم', '').then(function (t) {
              if (t == null) return; var s = base(st.tool); s.pts = [p]; s.text = t; push(s);
            });
            return;
          }
          if (st.tool === 'poly' || st.tool === 'angle') {
            if (!st.poly) { st.poly = base(st.tool); st.poly.pts = [p]; }
            else st.poly.pts.push(p);
            if (st.tool === 'angle' && st.poly.pts.length === 3) { push(st.poly); st.poly = null; }
            else redraw(st.poly);
            closeBtn.hidden = st.tool !== 'poly' || !st.poly || st.poly.pts.length < 3;
            return;
          }
          st.drag = base(st.tool); st.drag.pts = st.tool === 'pen' ? [p] : [p, p];
        });
        cv.addEventListener('pointermove', function (e) {
          if (!st.drag) return; var p = pos(e);
          if (st.tool === 'pen') st.drag.pts.push(p); else st.drag.pts[1] = p;
          redraw(st.drag);
        });
        cv.addEventListener('pointerup', function () {
          if (!st.drag) return; var s = st.drag; st.drag = null;
          if (s.k !== 'pen' && Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) < 4) { redraw(); return; }
          push(s);
        });
        closeBtn.onclick = function () { if (st.poly && st.poly.pts.length >= 3) { st.poly.closed = true; push(st.poly); st.poly = null; closeBtn.hidden = true; } };
        M.qsa('[data-tool]', m).forEach(function (b) {
          b.onclick = function () {
            if (st.poly && st.poly.pts.length >= 2 && st.tool === 'poly') push(st.poly);
            st.poly = null; closeBtn.hidden = true; st.tool = b.dataset.tool;
            M.qsa('[data-tool]', m).forEach(function (x) { x.classList.toggle('pri', x === b); });
            M.qs('#dr-hint', m).textContent = { pen: 'ارسم بحرية بالسحب.', line: 'اسحب من نقطة البداية للنهاية.', arrow: 'اسحب لرسم سهم.', rect: 'اسحب من ركن للركن المقابل.', circle: 'اسحب من المركز لتحديد نصف القطر.', poly: 'انقر كل رأس ثم «إغلاق المضلع» (٣ رؤوس = مثلث).', point: 'انقر مكان النقطة ثم اكتب حرفها.', text: 'انقر المكان ثم اكتب النص.', angle: 'انقر رأس الزاوية ثم نقطة على كل ضلع.' }[st.tool];
          };
        });
        M.qsa('[data-pre]', m).forEach(function (b) { b.onclick = function () { undo.push(JSON.stringify(shapes)); shapes = shapes.concat(PRESETS[b.dataset.pre](digits)); redraw(); }; });
        M.qsa('[data-col]', m).forEach(function (b) { b.onclick = function () { st.color = b.dataset.col; M.qsa('[data-col]', m).forEach(function (x) { x.style.borderColor = x === b ? '#9CC9BF' : '#fff'; }); }; });
        M.qs('#dr-w', m).oninput = function (e) { st.w = Number(e.target.value); };
        M.qs('#dr-dash', m).onchange = function (e) { st.dash = e.target.checked; };
        M.qs('#dr-grid', m).onchange = function (e) { grid = e.target.checked; redraw(); };
        M.qs('#dr-undo', m).onclick = function () { if (st.poly) { st.poly = null; closeBtn.hidden = true; redraw(); return; } if (undo.length) { shapes = JSON.parse(undo.pop()); redraw(); } };
        M.qs('#dr-clear', m).onclick = function () { undo.push(JSON.stringify(shapes)); shapes = []; st.poly = null; redraw(); };
        M.qs('[data-ok]', m).onclick = function () {
          if (st.poly && st.poly.pts.length >= 2) shapes.push(st.poly);
          if (!shapes.length) return M.toast('الرسم فارغ', 'bad');
          var url = exportPNG(shapes, grid); close(); onDone({ image: url, shapes: shapes, grid: grid });
        };
      } });
  };
})(window.M);
