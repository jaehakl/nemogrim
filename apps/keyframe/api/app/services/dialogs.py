from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from pathlib import Path


_DIALOG_LOCK = threading.Lock()
_PICKER_SCRIPT = Path(__file__).with_name("native_picker.ps1")


def _run_picker(mode: str) -> list[str]:
    if os.name != "nt":
        raise RuntimeError("네이티브 파일 탐색기는 Windows에서만 사용할 수 있습니다")

    powershell = shutil.which("powershell.exe") or shutil.which("powershell")
    if not powershell:
        raise RuntimeError("Windows PowerShell 실행 파일을 찾을 수 없습니다")

    command = [
        powershell,
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(_PICKER_SCRIPT),
        "-Mode",
        mode,
    ]
    try:
        with _DIALOG_LOCK:
            result = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
    except OSError as error:
        raise RuntimeError(f"Windows 파일 탐색기를 실행하지 못했습니다: {error}") from error

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "알 수 없는 오류").strip()
        raise RuntimeError(f"Windows 파일 탐색기가 비정상 종료되었습니다: {detail[-1000:]}")

    try:
        selected = json.loads(result.stdout.lstrip("\ufeff").strip() or "[]")
    except json.JSONDecodeError as error:
        raise RuntimeError("Windows 파일 탐색기의 선택 결과를 읽지 못했습니다") from error

    if not isinstance(selected, list) or not all(isinstance(path, str) for path in selected):
        raise RuntimeError("Windows 파일 탐색기가 잘못된 선택 결과를 반환했습니다")
    return selected


def choose_video_files() -> list[str]:
    return _run_picker("files")


def choose_video_folder() -> str:
    selected = _run_picker("folder")
    return selected[0] if selected else ""
