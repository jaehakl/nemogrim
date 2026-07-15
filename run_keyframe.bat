@echo off
setlocal
cd /d "%~dp0"

start "Keyframe API" /D "%~dp0apps\keyframe\api" cmd /k call run.bat
start "Keyframe UI" /D "%~dp0apps\keyframe\ui" cmd /k call run.bat

timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:5175
endlocal
