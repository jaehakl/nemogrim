from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..db import DATA_DIR, MovieFile, Scene, SessionLocal, utc_now
from .movie_query import iso_utc


def serialize_scene(scene: Scene) -> dict:
    return {
        "id": scene.id,
        "movie_file_id": scene.movie_file_id,
        "timestamp_ms": scene.timestamp_ms,
        "prompt": scene.prompt,
        "keywords": scene.keywords,
        "embedding_model": scene.embedding_model,
        "prompt_model": scene.prompt_model,
        "analysis_status": scene.analysis_status,
        "analysis_error": scene.analysis_error,
        "snapshot_url": (
            f"/api/scenes/{scene.id}/snapshot" if scene.snapshot_path else None
        ),
        "created_at": iso_utc(scene.created_at),
        "updated_at": iso_utc(scene.updated_at),
    }


def list_scenes(movie_id: int) -> list[dict] | None:
    with SessionLocal() as database:
        if database.get(MovieFile, movie_id) is None:
            return None
        scenes = database.scalars(
            select(Scene)
            .where(Scene.movie_file_id == movie_id)
            .order_by(Scene.timestamp_ms, Scene.id)
        ).all()
        return [serialize_scene(scene) for scene in scenes]


def create_scene(movie_id: int, timestamp_ms: int) -> dict:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise LookupError("영상을 찾을 수 없습니다")
        if movie.duration_ms is not None and timestamp_ms > movie.duration_ms:
            raise ValueError("영상 길이를 벗어난 timestamp입니다")
        scene = Scene(
            movie_file_id=movie_id,
            timestamp_ms=timestamp_ms,
            analysis_status="pending",
            play_count=0,
        )
        database.add(scene)
        try:
            database.commit()
        except IntegrityError:
            database.rollback()
            raise
        database.refresh(scene)
        return serialize_scene(scene)


def retry_scene(scene_id: int) -> dict | None:
    with SessionLocal() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            return None
        if scene.analysis_status == "failed":
            scene.analysis_status = "pending"
            scene.analysis_error = None
            scene.updated_at = utc_now()
            database.commit()
            database.refresh(scene)
        return serialize_scene(scene)


def scene_snapshot_file(scene_id: int) -> Path:
    with SessionLocal() as database:
        scene = database.get(Scene, scene_id)
        if scene is None or not scene.snapshot_path:
            raise FileNotFoundError("Scene snapshot을 찾을 수 없습니다")
        path = (DATA_DIR / scene.snapshot_path).resolve()
    if not path.is_relative_to(DATA_DIR.resolve()) or not path.is_file():
        raise FileNotFoundError("Scene snapshot을 찾을 수 없습니다")
    return path
