from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db import Image, MovieFile, Scene
from app.services.movie_import import normalize_path


def make_movie(path: str, status: str = "ready", **values) -> MovieFile:
    return MovieFile(
        title=Path(path).stem,
        path=path,
        normalized_path=normalize_path(path),
        ext=Path(path).suffix.lower() or ".mp4",
        size_bytes=1234,
        file_modified_at=datetime(2026, 1, 1),
        metadata_status=status,
        **values,
    )


def test_scene_timestamp_is_unique_and_cascades_on_delete(session_factory, tmp_path):
    with session_factory() as database:
        movie = make_movie(str(tmp_path / "movie.mp4"))
        database.add(movie)
        database.flush()
        database.add(Scene(movie_file_id=movie.id, timestamp_ms=1500, play_count=0))
        database.commit()
        movie_id = movie.id

    with session_factory() as database:
        database.add(Scene(movie_file_id=movie_id, timestamp_ms=1500, play_count=0))
        with pytest.raises(IntegrityError):
            database.commit()
        database.rollback()

    with session_factory() as database:
        database.delete(database.get(MovieFile, movie_id))
        database.commit()
        assert database.scalar(select(func.count(Scene.id))) == 0


def test_image_persists_requested_columns(session_factory):
    embedding = b"\x00\x01\x02\x03"
    with session_factory() as database:
        image = Image(
            file_path="scenes/1/1.webp",
            prompt="blue sky",
            embedding=embedding,
        )
        database.add(image)
        database.commit()
        image_id = image.id

    with session_factory() as database:
        image = database.get(Image, image_id)
        assert image is not None
        assert image.file_path == "scenes/1/1.webp"
        assert image.prompt == "blue sky"
        assert image.embedding == embedding
