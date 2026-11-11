@echo off
REM Exam Studio - opens the online app (GitHub Pages) as a desktop window.
REM It works offline after the first open and receives every update automatically.
REM Designed and Developed by Mohamed-Eldawly
set "URL=https://starrnightt2030-oss.github.io/miyar/"
where msedge >nul 2>nul && (start "" msedge --app="%URL%" --window-size=1440,900 & exit /b)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1440,900 & exit /b)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%URL%" --window-size=1440,900 & exit /b)
start "" "%URL%"
