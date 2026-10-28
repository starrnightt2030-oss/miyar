@echo off
REM Miyar - run as a standalone app (local files, offline)
set "APP=%~dp0index.html"
set "APP=%APP:\=/%"
start "" msedge --app="file:///%APP%" --window-size=1400,900
