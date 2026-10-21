"""API 요청/응답 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, Field, PlainSerializer

from .ai.types import AiStatus
from .db import MovieFile, Scene


def _iso_utc(value: datetime) -> str:
    return f"{value.isoformat(timespec='seconds')}Z"


UtcDateTime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]
JobStatus = Literal["pending", "processing", "ready", "failed"]
PlaybackStatus = Literal["unprepared", "direct", "failed"]
AiState = Literal["not_loaded", "loading", "ready", "error"]

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """목록 응답. `next_cursor`를 그대로 다음 요청의 `cursor`로 넘긴다. 끝이면 null."""

    items: list[T]
    total: int
    next_cursor: int | None


# 영상 ----------------------------------------------------------------------


class MovieOut(BaseModel):
    id: int
    title: str
    path: str
    ext: str
    size_bytes: int
    file_modified_at: UtcDateTime
    duration_ms: int | None
    width: int | None
    height: int | None
    fps: float | None
    metadata_status: JobStatus
    metadata_error: str | None
    thumbnail_url: str | None
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @classmethod
    def build(cls, movie: MovieFile) -> MovieOut:
        return cls(**_movie_fields(movie))


class MovieDetailOut(MovieOut):
    video_codec: str | None
    audio_codec: str | None
    playback_status: PlaybackStatus
    playback_error: str | None
    stream_url: str | None
    scene_count: int

    @classmethod
    def build_detail(cls, movie: MovieFile, scene_count: int) -> MovieDetailOut:
        return cls(
            **_movie_fields(movie),
            video_codec=movie.video_codec,
            audio_codec=movie.audio_codec,
            playback_status=movie.playback_status,
            playback_error=movie.playback_error,
            stream_url=(
                f"/api/movies/{movie.id}/stream" if movie.playback_status == "direct" else None
            ),
            scene_count=scene_count,
        )


def _movie_fields(movie: MovieFile) -> dict:
    return {
        "id": movie.id,
        "title": movie.title,
        "path": movie.path,
        "ext": movie.ext,
        "size_bytes": movie.size_bytes,
        "file_modified_at": movie.file_modified_at,
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
        "created_at": movie.created_at,
        "updated_at": movie.updated_at,
    }


class MoviePage(Page[MovieOut]):
    processing_count: int


class ImportResultOut(BaseModel):
    cancelled: bool
    selected_count: int
    added_count: int
    duplicate_count: int
    failed_count: int
    added_ids: list[int]
    failures: list[str]

    @classmethod
    def empty(cls) -> ImportResultOut:
        return cls(
            cancelled=True,
            selected_count=0,
            added_count=0,
            duplicate_count=0,
            failed_count=0,
            added_ids=[],
            failures=[],
        )


# Scene ---------------------------------------------------------------------


class SceneCreateIn(BaseModel):
    timestamp_ms: int = Field(ge=0)


class SceneOut(BaseModel):
    id: int
    movie_file_id: int
    timestamp_ms: int
    prompt: str | None
    keywords: list[str] | None
    embedding_model: str | None
    prompt_model: str | None
    analysis_status: JobStatus
    analysis_error: str | None
    snapshot_url: str | None
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @classmethod
    def build(cls, scene: Scene) -> SceneOut:
        return cls(**_scene_fields(scene))


class ExplorerSceneOut(SceneOut):
    movie_title: str

    @classmethod
    def build_with_title(cls, scene: Scene, movie_title: str) -> ExplorerSceneOut:
        return cls(**_scene_fields(scene), movie_title=movie_title)


def _scene_fields(scene: Scene) -> dict:
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
        "snapshot_url": f"/api/scenes/{scene.id}/snapshot" if scene.snapshot_path else None,
        "created_at": scene.created_at,
        "updated_at": scene.updated_at,
    }


class SceneListOut(BaseModel):
    items: list[SceneOut]


class ScenePage(Page[ExplorerSceneOut]):
    pass


class SimilarScenePage(Page[ExplorerSceneOut]):
    available: bool


# AI / 상태 -----------------------------------------------------------------


class ModelStatusOut(BaseModel):
    name: str
    state: AiState
    error: str | None


class AiStatusOut(BaseModel):
    state: AiState
    requested_device: str
    device: str | None
    device_name: str | None
    note: str | None
    models: dict[str, ModelStatusOut]

    @classmethod
    def build(cls, status: AiStatus) -> AiStatusOut:
        return cls(
            state=status.state.value,
            requested_device=status.requested_device,
            device=status.device,
            device_name=status.device_name,
            note=status.note,
            models={
                key: ModelStatusOut(name=model.name, state=model.state.value, error=model.error)
                for key, model in status.models.items()
            },
        )


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    database_ok: bool
    ffmpeg_available: bool
    ffprobe_available: bool
    ai: AiStatusOut | None
