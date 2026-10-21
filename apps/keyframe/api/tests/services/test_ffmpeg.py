import json
import subprocess

import pytest

from app.services import ffmpeg


def test_extract_frame_builds_command_and_replaces_atomically(tmp_path, monkeypatch):
    commands = []

    def fake_run(command, timeout):
        commands.append((command, timeout))
        output = command[-1]
        with open(output, "wb") as file:
            file.write(b"webp")
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr(ffmpeg, "run_command", fake_run)
    destination = tmp_path / "scenes" / "1" / "2.webp"

    result = ffmpeg.extract_frame_webp(
        "movie.mp4", 5.5, destination, max_width=1280, quality=90, timeout=180
    )

    command, timeout = commands[0]
    assert result == destination and destination.read_bytes() == b"webp"
    assert command[command.index("-ss") + 1] == "5.500"
    assert "scale=1280:-2:force_original_aspect_ratio=decrease" in command
    assert command[command.index("-q:v") + 1] == "90"
    assert command[-1].endswith("2.tmp.webp")
    assert timeout == 180
    assert not (destination.parent / "2.tmp.webp").exists()


def test_extract_frame_removes_temporary_file_on_failure(tmp_path, monkeypatch):
    def failing_run(command, timeout):
        with open(command[-1], "wb"):
            pass  # 빈 파일만 남기고 실패한 상황
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr(ffmpeg, "run_command", failing_run)
    destination = tmp_path / "1.webp"
    with pytest.raises(RuntimeError, match="프레임 이미지"):
        ffmpeg.extract_frame_webp("movie.mp4", 0, destination, max_width=640, quality=78, timeout=90)
    assert list(tmp_path.iterdir()) == []


def test_probe_video_parses_streams(monkeypatch):
    payload = {
        "streams": [
            {"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080, "avg_frame_rate": "30000/1001"},
            {"codec_type": "audio", "codec_name": "aac"},
        ],
        "format": {"duration": "12.345"},
    }
    monkeypatch.setattr(
        ffmpeg,
        "run_command",
        lambda command, timeout: subprocess.CompletedProcess(command, 0, json.dumps(payload), ""),
    )
    assert ffmpeg.probe_video("movie.mp4") == {
        "duration_ms": 12_345,
        "width": 1920,
        "height": 1080,
        "fps": pytest.approx(29.97, abs=0.01),
        "video_codec": "h264",
        "audio_codec": "aac",
    }


def test_run_command_reports_missing_executable():
    with pytest.raises(RuntimeError, match="실행 파일을 찾을 수 없습니다"):
        ffmpeg.run_command(["keyframe-command-that-does-not-exist"], timeout=5)
