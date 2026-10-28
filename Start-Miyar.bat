@echo off
REM تشغيل معيار كبرنامج مستقل بدون إنترنت (نسخة الملفات المحلية)
set "APP=%~dp0index.html"
set "APP=%APP:\=/%"
start "" msedge --app="file:///%APP%" --window-size=1400,900
