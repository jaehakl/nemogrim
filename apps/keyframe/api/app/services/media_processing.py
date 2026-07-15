from __future__ import annotations

import json
import os
import shutil
import subprocess
from fractions import Fraction

from sqlalchemy import select

from ..db import DATA_DIR, THUMBNAIL_DIR, MovieFile, SessionLocal, utc_now


ACTIVE_METADATA_STATUSES = ("pending", "processing")


def _run_command(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
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
    result = _run_command(
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
    stream = next(
        (item for item in streams if item.get("codec_type") == "video"),
        None,
    )
    if stream is None:
        raise RuntimeError("영상 스트림을 찾을 수 없습니다")

    audio_stream = next(
        (item for item in streams if item.get("codec_type") == "audio"),
        None,
    )
    duration_value = (data.get("format") or {}).get("duration") or stream.get("duration")
    duration_seconds = float(duration_value) if duration_value not in (None, "N/A") else 0.0
    rate_value = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
    fps = None
    if rate_value and rate_value not in ("0/0", "N/A"):
        try:
            fps = float(Fraction(rate_value))
        except (ValueError, ZeroDivisionError):
            fps = None

    return {
        "duration_ms": round(duration_seconds * 1000) if duration_seconds > 0 else None,
        "width": int(stream["width"]) if stream.get("width") else None,
        "height": int(stream["height"]) if stream.get("height") else None,
        "fps": fps,
        "video_codec": stream.get("codec_name"),
        "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
    }


def create_thumbnail(path: str, movie_id: int, duration_ms: int | None) -> str:
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    duration_seconds = (duration_ms or 0) / 1000
    primary_time = (
        min(max(duration_seconds * 0.1, 1.0), 60.0, max(duration_seconds - 0.1, 0.0))
        if duration_seconds > 0
        else 1.0
    )
    final_path = THUMBNAIL_DIR / f"{movie_id}.webp"
    temporary_path = THUMBNAIL_DIR / f"{movie_id}.tmp.webp"
    attempts = [primary_time, 0.0] if primary_time > 0 else [primary_time]
    last_error: RuntimeError | None = None

    for timestamp in attempts:
        temporary_path.unlink(missing_ok=True)
        try:
            _run_command(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-ss",
                    f"{timestamp:.3f}", "-i", path, "-map", "0:v:0", "-frames:v", "1",
                    "-vf", "scale=640:-2:force_original_aspect_ratio=decrease",
                    "-c:v", "libwebp", "-q:v", "78", "-y", str(temporary_path),
                ],
                timeout=90,
            )
            if not temporary_path.exists() or temporary_path.stat().st_size == 0:
                raise RuntimeError("FFmpeg가 썸네일 파일을 만들지 못했습니다")
            temporary_path.replace(final_path)
            return final_path.relative_to(DATA_DIR).as_posix()
        except RuntimeError as error:
            last_error = error

    temporary_path.unlink(missing_ok=True)
    raise last_error or RuntimeError("썸네일을 만들지 못했습니다")


def process_movie_metadata(movie_id: int) -> None:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None or movie.metadata_status not in ACTIVE_METADATA_STATUSES:
            return
        movie.metadata_status = "processing"
        movie.metadata_error = None
        movie.updated_at = utc_now()
        source_path = movie.path
        database.commit()

    metadata: dict = {}
    thumbnail_path: str | None = None
    error_message: str | None = None
    try:
        metadata = probe_video(source_path)
        thumbnail_path = create_thumbnail(source_path, movie_id, metadata.get("duration_ms"))
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        error_message = str(error) or error.__class__.__name__

    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            return
        for key in ("duration_ms", "width", "height", "fps", "video_codec", "audio_codec"):
            if key in metadata:
                setattr(movie, key, metadata[key])
        movie.thumbnail_path = thumbnail_path
        movie.metadata_status = "failed" if error_message else "ready"
        movie.metadata_error = error_message
        movie.updated_at = utc_now()
        database.commit()


def reset_interrupted_jobs() -> list[int]:
    with SessionLocal() as database:
        processing = database.scalars(
            select(MovieFile).where(MovieFile.metadata_status == "processing")
        ).all()
        for movie in processing:
            movie.metadata_status = "pending"
            movie.metadata_error = None
            movie.updated_at = utc_now()
        database.flush()
        pending_ids = database.scalars(
            select(MovieFile.id)
            .where(MovieFile.metadata_status == "pending")
            .order_by(MovieFile.id)
        ).all()
        database.commit()
        return list(pending_ids)


def ffmpeg_status() -> dict[str, bool]:
    return {
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
        "ffprobe_available": shutil.which("ffprobe") is not None,
    }
