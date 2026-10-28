/* تثبيت التطبيق على الهاتف/الكمبيوتر برسالة تظهر عند الفتح */
(function (M) {
  'use strict';
  var I = M.icon;
  var bip = null;
  M.isStandalone = function () { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; };
  M.isIOS = function () { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
  M.canInstall = function () { return !!bip || (M.isIOS() && !M.isStandalone()); };

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); bip = e;
    setTimeout(function () { M.offerInstall(false); }, 1200);
  });
  window.addEventListener('appinstalled', function () {
    bip = null; closeSheet();
    try { localStorage.setItem('miyar-installed', '1'); } catch (x) { /* */ }
    M.sound && M.sound('done');
    M.toast && M.toast('تم تثبيت معيار — افتحه من أيقونته على الشاشة الرئيسية', 'ok');
    M.log && M.log('تثبيت التطبيق', navigator.userAgent.slice(0, 60));
  });

  function dismissedRecently() {
    try { var t = Number(localStorage.getItem('miyar-install-later') || 0); return Date.now() - t < 3 * 864e5; } catch (e) { return false; }
  }
  function closeSheet() { var s = document.getElementById('install-sheet'); if (s) s.remove(); }

  M.offerInstall = function (manual) {
    if (M.isStandalone() || location.protocol.indexOf('http') !== 0) { if (manual) M.toast('التطبيق مثبت بالفعل أو مفتوح من ملف محلي', 'bad'); return; }
    if (!manual && dismissedRecently()) return;
    if (!bip && !M.isIOS()) { if (manual) M.toast('افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»'); return; }
    if (document.getElementById('install-sheet')) return;
    var ios = !bip && M.isIOS();
    var el = document.createElement('div');
    el.id = 'install-sheet'; el.className = 'install-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'تثبيت التطبيق');
    el.innerHTML = '<div class="install-card"><div class="row" style="flex-wrap:nowrap;gap:14px"><img src="icons/icon-192.png" alt="" width="60" height="60" style="border-radius:14px;flex:none">' +
      '<div style="flex:1;min-width:0"><b style="font-size:17px">ثبّت «معيار» على جهازك</b><div class="small muted">يفتح كتطبيق مستقل بأيقونة على الشاشة، ويعمل بدون إنترنت، وتصلك الإشعارات الفورية، وبياناتك محمية من المسح.</div></div></div>' +
      (ios ? '<ol class="small" style="margin:10px 0 0;padding-inline-start:20px;line-height:1.9"><li>اضغط زر <b>المشاركة</b> <span aria-hidden="true">⬆︎</span> أسفل Safari.</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>اضغط <b>«إضافة»</b>.</li></ol>' : '') +
      '<div class="row" style="margin-top:12px">' + (ios ? '' : '<button class="btn pri" id="ins-go" style="flex:1">' + I('download') + ' تثبيت الآن</button>') + '<button class="btn" id="ins-later"' + (ios ? ' style="flex:1"' : '') + '>' + (ios ? 'فهمت' : 'لاحقاً') + '</button></div></div>';
    document.body.appendChild(el);
    M.sound && M.sound('notify');
    var go = el.querySelector('#ins-go');
    if (go) go.onclick = function () {
      if (!bip) return closeSheet();
      bip.prompt();
      bip.userChoice.then(function (c) {
        if (c.outcome !== 'accepted') { try { localStorage.setItem('miyar-install-later', String(Date.now())); } catch (e) { /* */ } }
        bip = null; closeSheet();
      });
    };
    el.querySelector('#ins-later').onclick = function () { try { localStorage.setItem('miyar-install-later', String(Date.now())); } catch (e) { /* */ } closeSheet(); };
  };

  /* آيفون: لا يوجد حدث تثبيت — نعرض الإرشادات عند الفتح */
  window.addEventListener('load', function () { if (M.isIOS() && !M.isStandalone()) setTimeout(function () { M.offerInstall(false); }, 1500); });
})(window.M);
