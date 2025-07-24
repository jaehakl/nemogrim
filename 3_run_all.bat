@echo off
REM 백엔드 실행 (새 창)
start cmd /k "call 1_win_run_api.bat"

REM 프론트엔드 실행 (새 창)
start cmd /k "call 2_win_run_client.bat" 