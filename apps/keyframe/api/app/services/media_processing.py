from __future__ import annotations

import json

from sqlalchemy import select

from ..db import ACTIVE_JOB_STATUSES, MovieFile, new_session
from ..paths import thumbnail_dir, to_data_relative
from .ffmpeg import extract_frame_webp, probe_video


METADATA_FIELDS = ("duration_ms", "width", "height", "fps", "video_codec", "audio_codec")


def thumbnail_timestamps(duration_ms: int | None) -> list[float]:
    """영상 앞부분 10% 지점(1~60초)을 먼저 시도하고, 실패하면 0초에서 다시 시도한다."""
    duration_seconds = (duration_ms or 0) / 1000
    if duration_seconds <= 0:
        return [1.0, 0.0]
    primary = min(max(duration_seconds * 0.1, 1.0), 60.0, max(duration_seconds - 0.1, 0.0))
    return [primary, 0.0] if primary > 0 else [0.0]


def create_thumbnail(path: str, movie_id: int, duration_ms: int | None) -> str:
    destination = thumbnail_dir() / f"{movie_id}.webp"
    last_error: RuntimeError | None = None
    for seconds in thumbnail_timestamps(duration_ms):
        try:
            extract_frame_webp(
                path, seconds, destination, max_width=640, quality=78, timeout=90
            )
            return to_data_relative(destination)
        except RuntimeError as error:
            last_error = error
    raise last_error or RuntimeError("썸네일을 만들지 못했습니다")


def process_movie_metadata(movie_id: int) -> None:
    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None or movie.metadata_status not in ACTIVE_JOB_STATUSES:
            return
        movie.metadata_status = "processing"
        movie.metadata_error = None
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

    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            return
        for key in METADATA_FIELDS:
            if key in metadata:
                setattr(movie, key, metadata[key])
        movie.thumbnail_path = thumbnail_path
        movie.metadata_status = "failed" if error_message else "ready"
        movie.metadata_error = error_message
        database.commit()


def reset_interrupted_jobs() -> list[int]:
    with new_session() as database:
        for movie in database.scalars(
            select(MovieFile).where(MovieFile.metadata_status == "processing")
        ):
            movie.metadata_status = "pending"
            movie.metadata_error = None
        database.flush()
        pending_ids = list(
            database.scalars(
                select(MovieFile.id)
                .where(MovieFile.metadata_status == "pending")
                .order_by(MovieFile.id)
            )
        )
        database.commit()
        return pending_ids
