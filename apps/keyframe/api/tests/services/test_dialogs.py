import json
import os
import shutil
import subprocess

import pytest

from app.services import dialogs


def completed(stdout="[]", returncode=0, stderr=""):
    return subprocess.CompletedProcess([], returncode, stdout=stdout, stderr=stderr)


@pytest.mark.parametrize(
    ("mode", "payload", "expected"),
    [
        ("files", [r"E:\영상 폴더\a.mp4", r"E:\videos\b.mkv"], [r"E:\영상 폴더\a.mp4", r"E:\videos\b.mkv"]),
        ("folder", [r"E:\한글 폴더"], [r"E:\한글 폴더"]),
        ("files", [], []),
    ],
)
def test_picker_parses_utf8_json(monkeypatch, mode, payload, expected):
    monkeypatch.setattr(dialogs.shutil, "which", lambda _name: "powershell.exe")
    monkeypatch.setattr(dialogs.subprocess, "run", lambda *args, **kwargs: completed(json.dumps(payload, ensure_ascii=False)))
    assert dialogs._run_picker(mode) == expected


def test_picker_reports_process_and_json_errors(monkeypatch):
    monkeypatch.setattr(dialogs.shutil, "which", lambda _name: "powershell.exe")
    monkeypatch.setattr(dialogs.subprocess, "run", lambda *args, **kwargs: completed("", 1, "boom"))
    with pytest.raises(RuntimeError, match="비정상 종료"):
        dialogs._run_picker("files")

    monkeypatch.setattr(dialogs.subprocess, "run", lambda *args, **kwargs: completed("not-json"))
    with pytest.raises(RuntimeError, match="선택 결과"):
        dialogs._run_picker("files")


def test_picker_filter_only_lists_direct_playback_extensions():
    script = dialogs._PICKER_SCRIPT.read_text(encoding="utf-8")
    assert "*.mp4;*.m4v;*.webm" in script
    assert not any(extension in script for extension in ("*.avi", "*.mkv", "*.mov", "*.wmv", "*.flv"))


def test_picker_owner_is_centered_on_screen():
    script = dialogs._PICKER_SCRIPT.read_text(encoding="utf-8")
    assert "FormStartPosition]::CenterScreen" in script
    assert "-32000" not in script


@pytest.mark.skipif(os.name != "nt" or not shutil.which("powershell.exe"), reason="Windows PowerShell 필요")
def test_picker_script_loads_winforms_in_sta():
    assert dialogs._run_picker("probe") == ["STA", "WinForms"]
