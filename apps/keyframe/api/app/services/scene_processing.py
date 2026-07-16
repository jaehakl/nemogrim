from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from ..db import DATA_DIR, SCENE_DIR, MovieFile, Scene, SessionLocal, utc_now
from .media_processing import _run_command
from .scene_models import CLIP_MODEL_NAME, WD14_MODEL_REPO, analyze_scene


ACTIVE_SCENE_STATUSES = ("pending", "processing")


def process_scene(scene_id: int) -> None:
    with SessionLocal() as database:
        scene = database.get(Scene, scene_id)
        if scene is None or scene.analysis_status not in ACTIVE_SCENE_STATUSES:
            return
        movie = database.get(MovieFile, scene.movie_file_id)
        if movie is None:
            return
        scene.analysis_status = "processing"
        scene.analysis_error = None
        scene.updated_at = utc_now()
        source_path = movie.path
        movie_id = movie.id
        timestamp_ms = scene.timestamp_ms
        snapshot_path = scene.snapshot_path
        database.commit()

    error_message: str | None = None
    snapshot: Path | None = None
    try:
        snapshot = (DATA_DIR / snapshot_path).resolve() if snapshot_path else None
        if (
            snapshot is None
            or not snapshot.is_relative_to(DATA_DIR.resolve())
            or not snapshot.is_file()
        ):
            snapshot = create_scene_snapshot(source_path, movie_id, scene_id, timestamp_ms)
            with SessionLocal() as database:
                scene = database.get(Scene, scene_id)
                if scene is None:
                    snapshot.unlink(missing_ok=True)
                    return
                scene.snapshot_path = snapshot.relative_to(DATA_DIR).as_posix()
                scene.updated_at = utc_now()
                database.commit()

        analysis = analyze_scene(snapshot)
    except Exception as error:
        error_message = str(error) or error.__class__.__name__

    with SessionLocal() as database:
        scene = database.get(Scene, scene_id)
        if scene is None:
            if snapshot and snapshot.is_relative_to(SCENE_DIR.resolve()):
                snapshot.unlink(missing_ok=True)
            return
        if error_message:
            scene.analysis_status = "failed"
            scene.analysis_error = error_message[-2000:]
        else:
            scene.embedding = analysis.embedding
            scene.embedding_model = CLIP_MODEL_NAME
            scene.prompt = analysis.prompt
            scene.keywords = analysis.keywords
            scene.prompt_model = WD14_MODEL_REPO
            scene.analysis_status = "ready"
            scene.analysis_error = None
        scene.updated_at = utc_now()
        database.commit()


def create_scene_snapshot(
    source_path: str,
    movie_id: int,
    scene_id: int,
    timestamp_ms: int,
) -> Path:
    directory = SCENE_DIR / str(movie_id)
    directory.mkdir(parents=True, exist_ok=True)
    final_path = directory / f"{scene_id}.webp"
    temporary_path = directory / f"{scene_id}.tmp.webp"
    temporary_path.unlink(missing_ok=True)
    try:
        _run_command(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-ss",
                f"{timestamp_ms / 1000:.3f}", "-i", source_path, "-map", "0:v:0",
                "-frames:v", "1", "-vf",
                "scale=1280:-2:force_original_aspect_ratio=decrease",
                "-c:v", "libwebp", "-q:v", "90", "-y", str(temporary_path),
            ],
            timeout=180,
        )
        if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
            raise RuntimeError("FFmpeg가 Scene snapshot을 만들지 못했습니다")
        temporary_path.replace(final_path)
        return final_path
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def reset_scene_jobs() -> list[int]:
    with SessionLocal() as database:
        processing = database.scalars(
            select(Scene).where(Scene.analysis_status == "processing")
        ).all()
        for scene in processing:
            scene.analysis_status = "pending"
            scene.analysis_error = None
            scene.updated_at = utc_now()
        database.flush()
        ids = list(database.scalars(
            select(Scene.id).where(Scene.analysis_status == "pending").order_by(Scene.id)
        ).all())
        database.commit()
        return ids
