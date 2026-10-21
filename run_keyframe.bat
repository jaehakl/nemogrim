@echo off
setlocal
cd /d "%~dp0"

start "Keyframe API" /D "%~dp0apps\keyframe\api" cmd /k call run.bat
start "Keyframe UI" /D "%~dp0apps\keyframe\ui" cmd /k call run.bat

rem Open the browser only after the API answers (up to 60 seconds).
echo Waiting for Keyframe API...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); while((Get-Date) -lt $deadline){ try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8002/api/health | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 700 } }; exit 1"
if errorlevel 1 echo Keyframe API did not respond within 60 seconds. Check the "Keyframe API" window. The UI reconnects automatically once the API is up.

start "" http://127.0.0.1:5175
endlocal
