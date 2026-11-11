/* تصدير PDF مباشر: يصوّر صفحات الامتحان فقط (بمحرك المتصفح نفسه فتظهر العربية والمعادلات كما هي) ثم يجمعها في ملف PDF بمقاس الورق */
(function (M) {
  'use strict';
  var loaded = null;
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('تعذر تحميل ' + src)); }; document.head.appendChild(s); });
  }
  function libs() {
    if (!loaded) loaded = Promise.all([window.jspdf ? 0 : loadScript('js/vendor/jspdf.umd.min.js'), window.htmlToImage ? 0 : loadScript('js/vendor/html-to-image.js')]).catch(function (e) { loaded = null; throw e; });
    return loaded;
  }
  var fontCSS = null;
  function waitImgs(box) {
    return Promise.all(M.qsa('img', box).filter(function (i) { return !i.complete; }).map(function (i) { return new Promise(function (r) { i.onload = i.onerror = r; }); }));
  }

  /* items: صفحات HTML (A4 عمودي) أو أوراق A3 (أفقي) */
  M.exportPDF = function (items, name, size) {
    var a3 = size === 'a3';
    var W = a3 ? 420 : 210, H = 297, pxW = a3 ? 1587 : 794, pxH = 1123;
    M.toast && M.toast('جاري تجهيز ملف PDF…');
    var host = document.createElement('div');
    host.className = 'pdf-host';
    host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + pxW + 'px;background:#fff;z-index:-1';
    document.body.appendChild(host);
    return libs().then(function () {
      return document.fonts && document.fonts.ready;
    }).then(function () {
      var hi = window.htmlToImage, J = window.jspdf.jsPDF;
      var pdf = new J({ orientation: a3 ? 'landscape' : 'portrait', unit: 'mm', format: a3 ? 'a3' : 'a4', compress: true });
      var ratio = a3 ? 1.9 : 2.6;
      var chain = Promise.resolve();
      items.forEach(function (html, i) {
        chain = chain.then(function () {
          host.innerHTML = html;
          var el = host.firstElementChild;
          if (!el) return;
          el.style.margin = '0'; el.style.boxShadow = 'none';
          return waitImgs(host).then(function () {
            var opt = { pixelRatio: ratio, backgroundColor: '#ffffff', width: el.offsetWidth || pxW, height: el.offsetHeight || pxH, cacheBust: false };
            if (fontCSS) opt.fontEmbedCSS = fontCSS;
            var p = fontCSS ? Promise.resolve(fontCSS) : hi.getFontEmbedCSS(el).then(function (css) { fontCSS = css; return css; }).catch(function () { return ''; });
            return p.then(function (css) { opt.fontEmbedCSS = css; return hi.toJpeg(el, Object.assign({ quality: 0.92 }, opt)); });
          }).then(function (jpg) {
            if (i > 0) pdf.addPage(a3 ? 'a3' : 'a4', a3 ? 'landscape' : 'portrait');
            pdf.addImage(jpg, 'JPEG', 0, 0, W, H, undefined, 'FAST');
          });
        });
      });
      return chain.then(function () {
        var file = String(name || 'امتحان').replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.pdf';
        M.download(file, pdf.output('blob'), 'application/pdf');
        M.toast && M.toast('تم حفظ ملف PDF (' + M.n(items.length) + ' ص)', 'ok');
      });
    }).catch(function (e) {
      console.error(e);
      M.toast && M.toast('تعذر إنشاء PDF — استخدم «طباعة» ثم «حفظ كـ PDF»', 'bad');
    }).then(function () { host.remove(); });
  };
})(window.M);
