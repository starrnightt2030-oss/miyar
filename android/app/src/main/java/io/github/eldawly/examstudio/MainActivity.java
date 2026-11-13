package io.github.eldawly.examstudio;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Parcelable;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/* Exam Studio — غلاف أندرويد: يفتح نسخة GitHub (تتحدّث تلقائياً وتعمل بلا إنترنت بعد أول تشغيل)
   ويضيف ما لا يدعمه WebView: الطباعة / PDF، حفظ الملفات في التنزيلات، اختيار الصور والملفات والكاميرا، زر الرجوع. */
public class MainActivity extends Activity {
    static final String HOME = "https://starrnightt2030-oss.github.io/miyar/";
    static final String HOST = "starrnightt2030-oss.github.io";
    static final int REQ_FILE = 41;
    static final int REQ_PERM = 42;

    WebView web;
    ValueCallback<Uri[]> fileCb;
    Uri camUri;
    byte[] pendingBytes;
    String pendingName, pendingMime;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor("#1D4ED8"));
        if (Build.VERSION.SDK_INT >= 26) {
            getWindow().setNavigationBarColor(Color.WHITE);
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " ExamStudioApp/1");

        web.addJavascriptInterface(new Bridge(), "ExamStudioAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                String path = u.getPath() == null ? "" : u.getPath();
                if (HOST.equals(u.getHost()) && path.startsWith("/miyar")) return false;
                if (scheme.equals("blob") || scheme.equals("data") || scheme.equals("about")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError err) {
                if (r.isForMainFrame()) showOffline();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                camUri = null;
                boolean images = true;
                String[] acc = p.getAcceptTypes();
                if (acc == null || acc.length == 0) images = false;
                else for (String a : acc) { if (a == null || !a.trim().startsWith("image/")) { images = false; break; } }

                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType(images ? "image/*" : "*/*");
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

                Intent chooser = Intent.createChooser(pick, images ? "اختر صورة" : "اختر ملفاً");
                if (images && Build.VERSION.SDK_INT >= 29) {
                    try {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Images.Media.DISPLAY_NAME, "exam_" + System.currentTimeMillis() + ".jpg");
                        cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                        cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ExamStudio");
                        camUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                        if (camUri != null) {
                            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                            cam.putExtra(MediaStore.EXTRA_OUTPUT, camUri);
                            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Parcelable[]{cam});
                        }
                    } catch (Exception ignored) { camUri = null; }
                }
                try {
                    startActivityForResult(chooser, REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCb.onReceiveValue(null);
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (url != null && url.startsWith("http")) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(HOME);
    }

    void showOffline() {
        String html = "<!doctype html><html dir='rtl'><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;font-family:sans-serif;background:#F5F7FB;color:#0B1F4D;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}"
                + ".c{background:#fff;border-radius:18px;padding:28px 22px;margin:18px;box-shadow:0 10px 30px rgba(11,31,77,.12);max-width:360px}"
                + "h2{margin:0 0 10px;color:#1D4ED8}p{color:#475569;line-height:1.7}a{display:inline-block;margin-top:12px;background:#1D4ED8;color:#fff;text-decoration:none;padding:12px 26px;border-radius:12px;font-weight:bold}</style></head>"
                + "<body><div class='c'><h2>Exam Studio</h2><p>محتاج اتصال بالإنترنت أول مرة بس عشان التطبيق يتحمّل.<br>بعد كده بيشتغل من غير إنترنت.</p>"
                + "<a href='" + HOME + "'>إعادة المحاولة</a></div></body></html>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || fileCb == null) return;
        Uri[] out = null;
        if (res == RESULT_OK) {
            if (data != null && data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                int n = data.getClipData().getItemCount();
                out = new Uri[n];
                for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                out = new Uri[]{data.getData()};
            } else if (camUri != null) {
                out = new Uri[]{camUri};
            }
        }
        if (out == null && camUri != null) {
            try { getContentResolver().delete(camUri, null, null); } catch (Exception ignored) { }
        }
        fileCb.onReceiveValue(out);
        fileCb = null;
        camUri = null;
    }

    /* حفظ ملف في التنزيلات/ExamStudio ثم فتحه */
    void saveBytes(String name, String mime, byte[] bytes) {
        try {
            Uri uri;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver cr = getContentResolver();
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ExamStudio");
                uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("insert failed");
                OutputStream os = cr.openOutputStream(uri);
                if (os == null) throw new Exception("open failed");
                os.write(bytes);
                os.close();
                toast("تم الحفظ في التنزيلات ← ExamStudio\n" + name);
                openFile(uri, mime);
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingBytes = bytes; pendingName = name; pendingMime = mime;
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_PERM);
                    return;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "ExamStudio");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream fo = new FileOutputStream(f);
                fo.write(bytes);
                fo.close();
                toast("تم الحفظ في التنزيلات ← ExamStudio\n" + name);
                final String m = mime;
                MediaScannerConnection.scanFile(this, new String[]{f.getAbsolutePath()}, new String[]{mime},
                        (path, u) -> { if (u != null) runOnUiThread(() -> openFile(u, m)); });
            }
        } catch (Exception e) {
            toast("تعذّر حفظ الملف: " + e.getMessage());
        }
    }

    void openFile(Uri uri, String mime) {
        try {
            Intent v = new Intent(Intent.ACTION_VIEW);
            v.setDataAndType(uri, mime);
            v.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(v, "فتح الملف"));
        } catch (Exception ignored) { }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req == REQ_PERM && pendingBytes != null) {
            byte[] b = pendingBytes; String n = pendingName, m = pendingMime;
            pendingBytes = null;
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) saveBytes(n, m, b);
            else toast("لازم تسمح بالتخزين عشان يتحفظ الملف");
        }
    }

    void toast(String t) { Toast.makeText(this, t, Toast.LENGTH_LONG).show(); }

    static String safeName(String n) {
        String s = n == null ? "" : n.replaceAll("[\\\\/:*?\"<>|\\n\\r\\t]+", " ").trim();
        return s.isEmpty() ? "ExamStudio" : s;
    }

    class Bridge {
        @JavascriptInterface
        public void print(final String title, final String size) {
            runOnUiThread(() -> {
                try {
                    PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                    String t = safeName(title);
                    PrintDocumentAdapter ad = web.createPrintDocumentAdapter(t);
                    PrintAttributes.MediaSize ms = "a3".equals(size) ? PrintAttributes.MediaSize.ISO_A3.asLandscape() : PrintAttributes.MediaSize.ISO_A4;
                    PrintAttributes attrs = new PrintAttributes.Builder()
                            .setMediaSize(ms)
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build();
                    pm.print(t, ad, attrs);
                } catch (Exception e) {
                    toast("تعذّر فتح الطباعة: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String base64) {
            final byte[] bytes;
            try { bytes = Base64.decode(base64, Base64.DEFAULT); } catch (Exception e) { return; }
            final String m = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
            runOnUiThread(() -> saveBytes(safeName(name), m, bytes));
        }

        @JavascriptInterface
        public String platform() { return "android"; }

        /* رقم إصدار التطبيق (versionCode) — لتنبيه المستخدم عند وجود APK أحدث */
        @JavascriptInterface
        public int appVersion() {
            try { return (int) getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); if (web != null) web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
}
