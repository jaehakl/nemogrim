from __future__ import annotations

from sqlalchemy import func, select

from ..db import MovieFile, Scene, SessionLocal
from .media_processing import ACTIVE_METADATA_STATUSES


def iso_utc(value) -> str | None:
    return f"{value.isoformat(timespec='seconds')}Z" if value else None


def serialize_movie(movie: MovieFile) -> dict:
    return {
        "id": movie.id,
        "title": movie.title,
        "path": movie.path,
        "ext": movie.ext,
        "size_bytes": movie.size_bytes,
        "file_modified_at": iso_utc(movie.file_modified_at),
        "duration_ms": movie.duration_ms,
        "width": movie.width,
        "height": movie.height,
        "fps": movie.fps,
        "metadata_status": movie.metadata_status,
        "metadata_error": movie.metadata_error,
        "thumbnail_url": (
            f"/api/movies/{movie.id}/thumbnail"
            if movie.metadata_status == "ready" and movie.thumbnail_path
            else None
        ),
        "created_at": iso_utc(movie.created_at),
        "updated_at": iso_utc(movie.updated_at),
    }


def processing_count(database) -> int:
    return database.scalar(
        select(func.count(MovieFile.id)).where(
            MovieFile.metadata_status.in_(ACTIVE_METADATA_STATUSES)
        )
    ) or 0


def get_movie_page(limit: int, before_id: int | None) -> dict:
    with SessionLocal() as database:
        statement = select(MovieFile).order_by(MovieFile.id.desc())
        if before_id is not None:
            statement = statement.where(MovieFile.id < before_id)
        rows = list(database.scalars(statement.limit(limit + 1)).all())
        has_more = len(rows) > limit
        page = rows[:limit]
        return {
            "items": [serialize_movie(movie) for movie in page],
            "total": database.scalar(select(func.count(MovieFile.id))) or 0,
            "processing_count": processing_count(database),
            "next_cursor": page[-1].id if has_more and page else None,
            "has_more": has_more,
        }


def get_movie_statuses(ids: list[int]) -> dict:
    unique_ids = list(dict.fromkeys(ids))
    with SessionLocal() as database:
        movies = []
        for start in range(0, len(unique_ids), 500):
            movies.extend(
                database.scalars(
                    select(MovieFile).where(
                        MovieFile.id.in_(unique_ids[start : start + 500])
                    )
                ).all()
            )
        return {
            "items": [serialize_movie(movie) for movie in movies],
            "processing_count": processing_count(database),
        }


def get_movie_detail(movie_id: int) -> dict | None:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            return None
        detail = serialize_movie(movie)
        detail.update(
            {
                "video_codec": movie.video_codec,
                "audio_codec": movie.audio_codec,
                "playback_status": movie.playback_status,
                "playback_error": movie.playback_error,
                "stream_url": (
                    f"/api/movies/{movie.id}/stream"
                    if movie.playback_status == "direct"
                    else None
                ),
                "scene_count": database.scalar(
                    select(func.count(Scene.id)).where(Scene.movie_file_id == movie.id)
                ) or 0,
            }
        )
        return detail
