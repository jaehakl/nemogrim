from __future__ import annotations

from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..ai.runtime import get_ai_runtime
from ..ai.types import unpack_embedding
from ..db import MovieFile, Scene, new_session
from ..errors import ConflictError, InvalidRequestError, NotFoundError
from ..paths import resolve_data_path, scene_dir
from ..schemas import ExplorerSceneOut, SceneOut, ScenePage, SimilarScenePage
from .playback import MOVIE_NOT_FOUND
from .vector_index import scene_index


SCENE_NOT_FOUND = "Scene을 찾을 수 없습니다"


def _with_title():
    return select(Scene, MovieFile.title).join(MovieFile, MovieFile.id == Scene.movie_file_id)


def _ranked_page(
    database: Session,
    ranked_ids: list[int],
    offset: int,
    limit: int,
) -> tuple[list[ExplorerSceneOut], int | None]:
    page_ids = ranked_ids[offset : offset + limit]
    rows = database.execute(_with_title().where(Scene.id.in_(page_ids))).all() if page_ids else []
    by_id = {scene.id: ExplorerSceneOut.build_with_title(scene, title) for scene, title in rows}
    items = [by_id[scene_id] for scene_id in page_ids if scene_id in by_id]
    next_offset = offset + len(page_ids)
    return items, next_offset if next_offset < len(ranked_ids) else None


def get_scene_page(query: str | None, cursor: int | None, limit: int) -> ScenePage:
    """검색어가 없으면 최신순(cursor = 직전 페이지 마지막 id), 있으면 CLIP 유사도순(cursor = offset)."""
    text = (query or "").strip()
    if text:
        runtime = get_ai_runtime()
        query_vector = runtime.embed_text(text)
        with new_session() as database:
            ranked_ids = scene_index.rank(database, query_vector)
            items, next_cursor = _ranked_page(database, ranked_ids, cursor or 0, limit)
            return ScenePage(items=items, total=len(ranked_ids), next_cursor=next_cursor)

    with new_session() as database:
        statement = _with_title().order_by(Scene.id.desc())
        if cursor is not None:
            statement = statement.where(Scene.id < cursor)
        rows = database.execute(statement.limit(limit + 1)).all()
        page = rows[:limit]
        return ScenePage(
            items=[ExplorerSceneOut.build_with_title(scene, title) for scene, title in page],
            total=database.scalar(select(func.count(Scene.id))) or 0,
            next_cursor=page[-1][0].id if len(rows) > limit else None,
        )


def get_scene_detail(scene_id: int) -> ExplorerSceneOut:
    with new_session() as database:
        row = database.execute(_with_title().where(Scene.id == scene_id)).one_or_none()
        if row is None:
            raise NotFoundError(SCENE_NOT_FOUND)
        scene, title = row
        return ExplorerSceneOut.build_with_title(scene, title)


def get_similar_scene_page(scene_id: int, offset: int, limit: int) -> SimilarScenePage:
    with new_session() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            raise NotFoundError(SCENE_NOT_FOUND)
        reference = unpack_embedding(scene.embedding)
        searchable = scene.analysis_status == "ready" and reference is not None
        if not searchable:
            return SimilarScenePage(items=[], total=0, next_cursor=None, available=False)

        ranked_ids = scene_index.rank(database, reference, exclude_id=scene_id)
        items, next_cursor = _ranked_page(database, ranked_ids, offset, limit)
        return SimilarScenePage(
            items=items, total=len(ranked_ids), next_cursor=next_cursor, available=True
        )


def list_scenes(movie_id: int) -> list[SceneOut]:
    with new_session() as database:
        if database.get(MovieFile, movie_id) is None:
            raise NotFoundError(MOVIE_NOT_FOUND)
        scenes = database.scalars(
            select(Scene)
            .where(Scene.movie_file_id == movie_id)
            .order_by(Scene.timestamp_ms, Scene.id)
        )
        return [SceneOut.build(scene) for scene in scenes]


def create_scene(movie_id: int, timestamp_ms: int) -> SceneOut:
    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise NotFoundError(MOVIE_NOT_FOUND)
        if movie.duration_ms is not None and timestamp_ms > movie.duration_ms:
            raise InvalidRequestError("영상 길이를 벗어난 timestamp입니다")
        scene = Scene(movie_file_id=movie_id, timestamp_ms=timestamp_ms, analysis_status="pending")
        database.add(scene)
        try:
            database.commit()
        except IntegrityError as error:
            database.rollback()
            raise ConflictError("같은 timestamp의 Scene이 이미 있습니다") from error
        database.refresh(scene)
        return SceneOut.build(scene)


def retry_scene(scene_id: int) -> SceneOut:
    with new_session() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            raise NotFoundError(SCENE_NOT_FOUND)
        if scene.analysis_status == "failed":
            scene.analysis_status = "pending"
            scene.analysis_error = None
            database.commit()
            database.refresh(scene)
        return SceneOut.build(scene)


def delete_scene(scene_id: int) -> None:
    with new_session() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            raise NotFoundError(SCENE_NOT_FOUND)
        movie_id = scene.movie_file_id
        snapshot_path = scene.snapshot_path
        database.delete(scene)
        database.commit()
    scene_index.invalidate()

    directory = scene_dir(movie_id)
    candidates = {directory / f"{scene_id}.webp", directory / f"{scene_id}.tmp.webp"}
    stored = resolve_data_path(snapshot_path)
    if stored is not None:
        candidates.add(stored)
    scene_root = scene_dir().resolve()
    for path in candidates:
        resolved = path.resolve()
        if resolved.is_relative_to(scene_root):
            resolved.unlink(missing_ok=True)


def scene_snapshot_file(scene_id: int) -> Path:
    with new_session() as database:
        scene = database.get(Scene, scene_id)
        relative_path = scene.snapshot_path if scene else None
    path = resolve_data_path(relative_path)
    if path is None:
        raise NotFoundError("Scene snapshot을 찾을 수 없습니다")
    return path
