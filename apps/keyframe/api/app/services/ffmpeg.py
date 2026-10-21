from __future__ import annotations

import json
import os
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path


def run_command(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=creation_flags,
        )
    except FileNotFoundError as error:
        raise RuntimeError(f"{command[0]} 실행 파일을 찾을 수 없습니다") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"{command[0]} 처리가 제한 시간을 초과했습니다") from error
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or str(error)).strip()
        raise RuntimeError(detail[-1200:]) from error


def probe_video(path: str) -> dict:
    result = run_command(
        [
            "ffprobe", "-v", "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,duration:format=duration",
            "-of", "json", path,
        ],
        timeout=30,
    )
    data = json.loads(result.stdout)
    streams = data.get("streams") or []
    video = next((item for item in streams if item.get("codec_type") == "video"), None)
    if video is None:
        raise RuntimeError("영상 스트림을 찾을 수 없습니다")
    audio = next((item for item in streams if item.get("codec_type") == "audio"), None)

    duration_value = (data.get("format") or {}).get("duration") or video.get("duration")
    duration_seconds = float(duration_value) if duration_value not in (None, "N/A") else 0.0
    rate_value = video.get("avg_frame_rate") or video.get("r_frame_rate")
    fps = None
    if rate_value and rate_value not in ("0/0", "N/A"):
        try:
            fps = float(Fraction(rate_value))
        except (ValueError, ZeroDivisionError):
            fps = None

    return {
        "duration_ms": round(duration_seconds * 1000) if duration_seconds > 0 else None,
        "width": int(video["width"]) if video.get("width") else None,
        "height": int(video["height"]) if video.get("height") else None,
        "fps": fps,
        "video_codec": video.get("codec_name"),
        "audio_codec": audio.get("codec_name") if audio else None,
    }


def extract_frame_webp(
    source: str,
    seconds: float,
    destination: Path,
    *,
    max_width: int,
    quality: int,
    timeout: int,
) -> Path:
    """영상의 한 프레임을 WebP로 저장한다. 임시 파일에 쓴 뒤 원자적으로 교체한다."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.stem}.tmp{destination.suffix}")
    temporary.unlink(missing_ok=True)
    try:
        run_command(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-ss", f"{seconds:.3f}", "-i", source,
                "-map", "0:v:0", "-frames:v", "1",
                "-vf", f"scale={max_width}:-2:force_original_aspect_ratio=decrease",
                "-c:v", "libwebp", "-q:v", str(quality), "-y", str(temporary),
            ],
            timeout=timeout,
        )
        if not temporary.is_file() or temporary.stat().st_size == 0:
            raise RuntimeError("FFmpeg가 프레임 이미지를 만들지 못했습니다")
        temporary.replace(destination)
        return destination
    finally:
        temporary.unlink(missing_ok=True)


def ffmpeg_status() -> dict[str, bool]:
    return {
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
        "ffprobe_available": shutil.which("ffprobe") is not None,
    }
