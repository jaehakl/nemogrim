from __future__ import annotations

import struct
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from ..db import DATA_DIR, MovieFile, Scene, SessionLocal, utc_now
from .movie_query import iso_utc
from .scene_models import CLIP_MODEL_NAME, extract_clip_text_embedding


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


def serialize_explorer_scene(scene: Scene, movie_title: str) -> dict:
    return {**serialize_scene(scene), "movie_title": movie_title}


def _rank_scenes_by_embedding(reference_embedding: bytes, rows) -> list[tuple]:
    reference_values = struct.unpack(
        f"<{len(reference_embedding) // 4}f", reference_embedding
    )
    ranked = []
    for scene, movie_title in rows:
        if scene.embedding is None or len(scene.embedding) != len(reference_embedding):
            continue
        values = struct.unpack(f"<{len(scene.embedding) // 4}f", scene.embedding)
        similarity = sum(
            reference_value * scene_value
            for reference_value, scene_value in zip(
                reference_values, values, strict=True
            )
        )
        ranked.append((similarity, scene.id, scene, movie_title))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return ranked


def get_scene_page(query: str | None, offset: int, limit: int) -> dict:
    search_query = query.strip() if query else ""
    query_embedding = (
        extract_clip_text_embedding(search_query) if search_query else None
    )
    if query_embedding is not None and (
        len(query_embedding) == 0 or len(query_embedding) % 4
    ):
        raise RuntimeError("CLIP 텍스트 임베딩 형식이 올바르지 않습니다")

    with SessionLocal() as database:
        if not search_query:
            rows = database.execute(
                select(Scene, MovieFile.title)
                .join(MovieFile, MovieFile.id == Scene.movie_file_id)
                .order_by(Scene.id.desc())
                .offset(offset)
                .limit(limit)
            ).all()
            total = database.scalar(select(func.count(Scene.id))) or 0
        else:
            assert query_embedding is not None
            candidates = database.execute(
                select(Scene, MovieFile.title)
                .join(MovieFile, MovieFile.id == Scene.movie_file_id)
                .where(
                    Scene.analysis_status == "ready",
                    Scene.embedding.is_not(None),
                    Scene.embedding_model == CLIP_MODEL_NAME,
                )
            ).all()
            ranked = _rank_scenes_by_embedding(query_embedding, candidates)
            total = len(ranked)
            rows = [
                (scene, movie_title)
                for _score, _id, scene, movie_title in ranked[offset : offset + limit]
            ]

        next_offset = offset + len(rows)
        has_more = next_offset < total
        return {
            "items": [
                serialize_explorer_scene(scene, movie_title)
                for scene, movie_title in rows
            ],
            "total": total,
            "next_offset": next_offset if has_more else None,
            "has_more": has_more,
        }


def get_scene_detail(scene_id: int) -> dict | None:
    with SessionLocal() as database:
        row = database.execute(
            select(Scene, MovieFile.title)
            .join(MovieFile, MovieFile.id == Scene.movie_file_id)
            .where(Scene.id == scene_id)
        ).one_or_none()
        if row is None:
            return None
        scene, movie_title = row
        return serialize_explorer_scene(scene, movie_title)


def get_similar_scene_page(scene_id: int, offset: int, limit: int) -> dict | None:
    with SessionLocal() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            return None
        if (
            scene.analysis_status != "ready"
            or scene.embedding is None
            or scene.embedding_model != CLIP_MODEL_NAME
            or len(scene.embedding) != 768 * 4
        ):
            return {
                "items": [],
                "total": 0,
                "next_offset": None,
                "has_more": False,
                "available": False,
            }

        candidates = database.execute(
            select(Scene, MovieFile.title)
            .join(MovieFile, MovieFile.id == Scene.movie_file_id)
            .where(
                Scene.id != scene_id,
                Scene.analysis_status == "ready",
                Scene.embedding.is_not(None),
                Scene.embedding_model == CLIP_MODEL_NAME,
            )
        ).all()
        ranked = _rank_scenes_by_embedding(scene.embedding, candidates)
        total = len(ranked)
        page = ranked[offset : offset + limit]
        next_offset = offset + len(page)
        has_more = next_offset < total
        return {
            "items": [
                serialize_explorer_scene(candidate, movie_title)
                for _score, _id, candidate, movie_title in page
            ],
            "total": total,
            "next_offset": next_offset if has_more else None,
            "has_more": has_more,
            "available": True,
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
