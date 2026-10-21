from __future__ import annotations

from pathlib import Path

from sqlalchemy import func, select

from ..db import ACTIVE_JOB_STATUSES, MovieFile, Scene, new_session
from ..errors import NotFoundError
from ..paths import resolve_data_path
from ..schemas import MovieDetailOut, MovieOut, MoviePage
from .playback import MOVIE_NOT_FOUND


def get_movie_page(limit: int, cursor: int | None) -> MoviePage:
    """id 내림차순 keyset 페이지. cursor는 직전 페이지 마지막 영상의 id다."""
    with new_session() as database:
        statement = select(MovieFile).order_by(MovieFile.id.desc())
        if cursor is not None:
            statement = statement.where(MovieFile.id < cursor)
        rows = list(database.scalars(statement.limit(limit + 1)))
        page = rows[:limit]
        return MoviePage(
            items=[MovieOut.build(movie) for movie in page],
            total=database.scalar(select(func.count(MovieFile.id))) or 0,
            processing_count=database.scalar(
                select(func.count(MovieFile.id)).where(
                    MovieFile.metadata_status.in_(ACTIVE_JOB_STATUSES)
                )
            ) or 0,
            next_cursor=page[-1].id if len(rows) > limit else None,
        )


def get_movie_detail(movie_id: int) -> MovieDetailOut:
    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise NotFoundError(MOVIE_NOT_FOUND)
        scene_count = database.scalar(
            select(func.count(Scene.id)).where(Scene.movie_file_id == movie.id)
        ) or 0
        return MovieDetailOut.build_detail(movie, scene_count)


def movie_thumbnail_file(movie_id: int) -> Path:
    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        relative_path = movie.thumbnail_path if movie else None
    path = resolve_data_path(relative_path)
    if path is None:
        raise NotFoundError("썸네일을 찾을 수 없습니다")
    return path
