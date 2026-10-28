/* طبقة التخزين — IndexedDB على الجهاز */
(function (M) {
  'use strict';
  var DB_NAME = 'miyar', DB_VER = 3;
  M.STORES = ['subjects', 'units', 'lessons', 'outcomes', 'questions', 'exams', 'docs', 'log', 'packs'];
  var dbp = null, memory = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      if (!window.indexedDB) { memory = {}; resolve(null); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { memory = {}; resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        M.STORES.forEach(function (s) { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('conflicts')) db.createObjectStore('conflicts', { keyPath: 'id' });
      };
      req.onsuccess = function () {
        var db = req.result;
        /* نسخة أحدث فُتحت في تبويب آخر: نغلق القاعدة ونعيد التحميل بدل تعطيلها */
        db.onversionchange = function () { try { db.close(); } catch (e) { /* */ } setTimeout(function () { location.reload(); }, 300); };
        resolve(db);
      };
      req.onerror = function () { memory = {}; resolve(null); };
      req.onblocked = function () {
        window.__bootBlocked = true;
        var a = document.getElementById('app');
        if (a) a.innerHTML = '<div style="max-width:460px;margin:60px auto;padding:24px;border-radius:16px;background:#fff;border:1px solid #e3e6ee;font-family:sans-serif;line-height:1.8;text-align:center"><b style="font-size:18px">نسخة قديمة من «معيار» مفتوحة</b><p>أغلق أي تبويب أو نافذة أخرى للتطبيق (أو التطبيق المثبت)، وسيفتح هنا تلقائياً.</p></div>';
      };
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      if (!db) {
        memory[store] = memory[store] || {};
        return fn(null, memory[store]);
      }
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var os = t.objectStore(store);
        var out = fn(os);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  M.db = {
    ready: open,
    persistent: function () { return !memory; },
    all: function (store) {
      return tx(store, 'readonly', function (os, mem) {
        if (!os) return Object.keys(mem).map(function (k) { return mem[k]; });
        return os.getAll();
      });
    },
    put: function (store, obj) {
      return tx(store, 'readwrite', function (os, mem) {
        var key = store === 'settings' ? obj.key : obj.id;
        if (!os) { mem[key] = obj; return obj; }
        os.put(obj); return obj;
      });
    },
    putMany: function (store, list) {
      if (!list.length) return Promise.resolve();
      return tx(store, 'readwrite', function (os, mem) {
        list.forEach(function (o) { if (!os) mem[o.id] = o; else os.put(o); });
        return list.length;
      });
    },
    del: function (store, key) {
      return tx(store, 'readwrite', function (os, mem) { if (!os) { delete mem[key]; return true; } os.delete(key); return true; });
    },
    clear: function (store) {
      return tx(store, 'readwrite', function (os, mem) { if (!os) { Object.keys(mem).forEach(function (k) { delete mem[k]; }); return true; } os.clear(); return true; });
    }
  };

  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }
})(window.M);
