from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from ..ai.runtime import get_ai_runtime
from ..ai.types import CLIP_MODEL_NAME, WD14_MODEL_REPO, SceneAnalysis
from ..db import ACTIVE_JOB_STATUSES, MovieFile, Scene, new_session
from ..paths import resolve_data_path, scene_dir, to_data_relative
from .ffmpeg import extract_frame_webp
from .vector_index import scene_index


def process_scene(scene_id: int) -> None:
    with new_session() as database:
        scene = database.get(Scene, scene_id)
        if scene is None or scene.analysis_status not in ACTIVE_JOB_STATUSES:
            return
        movie = database.get(MovieFile, scene.movie_file_id)
        if movie is None:
            return
        scene.analysis_status = "processing"
        scene.analysis_error = None
        source_path = movie.path
        movie_id = movie.id
        timestamp_ms = scene.timestamp_ms
        snapshot_path = scene.snapshot_path
        database.commit()

    error_message: str | None = None
    analysis: SceneAnalysis | None = None
    snapshot: Path | None = None
    try:
        snapshot = resolve_data_path(snapshot_path)
        if snapshot is None:
            snapshot = create_scene_snapshot(source_path, movie_id, scene_id, timestamp_ms)
            with new_session() as database:
                scene = database.get(Scene, scene_id)
                if scene is None:
                    snapshot.unlink(missing_ok=True)
                    return
                scene.snapshot_path = to_data_relative(snapshot)
                database.commit()

        analysis = get_ai_runtime().analyze_image(snapshot)
    except Exception as error:
        error_message = str(error) or error.__class__.__name__

    with new_session() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            if snapshot and snapshot.is_relative_to(scene_dir().resolve()):
                snapshot.unlink(missing_ok=True)
            return
        if analysis is None:
            scene.analysis_status = "failed"
            scene.analysis_error = (error_message or "알 수 없는 오류")[-2000:]
        else:
            scene.embedding = analysis.embedding
            scene.embedding_model = CLIP_MODEL_NAME
            scene.prompt = analysis.prompt
            scene.keywords = analysis.keywords
            scene.prompt_model = WD14_MODEL_REPO
            scene.analysis_status = "ready"
            scene.analysis_error = None
        database.commit()
    scene_index.invalidate()


def create_scene_snapshot(
    source_path: str,
    movie_id: int,
    scene_id: int,
    timestamp_ms: int,
) -> Path:
    return extract_frame_webp(
        source_path,
        timestamp_ms / 1000,
        scene_dir(movie_id) / f"{scene_id}.webp",
        max_width=1280,
        quality=90,
        timeout=180,
    )


def reset_scene_jobs() -> list[int]:
    with new_session() as database:
        for scene in database.scalars(select(Scene).where(Scene.analysis_status == "processing")):
            scene.analysis_status = "pending"
            scene.analysis_error = None
        database.flush()
        pending_ids = list(
            database.scalars(
                select(Scene.id).where(Scene.analysis_status == "pending").order_by(Scene.id)
            )
        )
        database.commit()
        return pending_ids
