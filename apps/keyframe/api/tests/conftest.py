from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import db, main, paths  # noqa: E402
from app.ai import runtime as ai_runtime  # noqa: E402
from app.ai.types import (  # noqa: E402
    CLIP_DIMENSIONS,
    CLIP_MODEL_NAME,
    WD14_MODEL_REPO,
    AiStatus,
    ModelState,
    ModelStatus,
    SceneAnalysis,
    pack_embedding,
)
from app.services import media_queue  # noqa: E402
from app.services.vector_index import scene_index  # noqa: E402


def axis(index: int) -> np.ndarray:
    vector = np.zeros(CLIP_DIMENSIONS, dtype=np.float32)
    vector[index] = 1.0
    return vector


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch) -> Path:
    """모든 테스트가 실제 apps/keyframe/data 대신 임시 디렉터리를 쓰게 한다."""
    directory = tmp_path / "data"
    monkeypatch.setattr(paths, "DATA_DIR", directory)
    return directory


@pytest.fixture
def session_factory(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{(tmp_path / 'test.sqlite3').as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    db.Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    monkeypatch.setattr(db, "SessionLocal", factory)
    scene_index.invalidate()
    yield factory
    scene_index.invalidate()
    engine.dispose()


class FakeAiRuntime:
    """AiRuntime과 같은 공개 인터페이스를 가진 테스트 대역. 모델을 로드하지 않는다."""

    request_timeout = 1.0

    def __init__(self) -> None:
        self.text_vector = axis(0)
        self.analysis = SceneAnalysis(
            embedding=pack_embedding(axis(0)),
            prompt="blue sky, 1girl",
            keywords=["blue sky", "1girl"],
        )
        self.error: Exception | None = None
        self.calls: list[tuple] = []
        self.state = ModelState.NOT_LOADED

    def start(self) -> None:
        self.calls.append(("start",))

    def shutdown(self) -> None:
        self.calls.append(("shutdown",))

    def warmup(self) -> None:
        self.calls.append(("warmup",))

    def status(self) -> AiStatus:
        return AiStatus(
            state=self.state,
            requested_device="auto",
            device="cuda:0",
            device_name="Fake GPU",
            note=None,
            models={
                "clip": ModelStatus(CLIP_MODEL_NAME, self.state),
                "tagger": ModelStatus(WD14_MODEL_REPO, self.state),
            },
        )

    def embed_text(self, text: str, timeout: float | None = None) -> np.ndarray:
        self.calls.append(("embed_text", text))
        if self.error:
            raise self.error
        return self.text_vector

    def analyze_image(self, image_path: Path, timeout: float | None = None) -> SceneAnalysis:
        self.calls.append(("analyze_image", image_path))
        if self.error:
            raise self.error
        return self.analysis


@pytest.fixture
def fake_ai():
    fake = FakeAiRuntime()
    ai_runtime.set_ai_runtime(fake)
    yield fake
    ai_runtime.set_ai_runtime(None)


@pytest.fixture
def api_client(session_factory, fake_ai, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main, "AiRuntime", lambda _settings: fake_ai)
    monkeypatch.setattr(media_queue, "reset_interrupted_jobs", lambda: [])
    monkeypatch.setattr(media_queue, "reset_scene_jobs", lambda: [])
    monkeypatch.setattr(media_queue, "process_movie_metadata", lambda _movie_id: None)
    monkeypatch.setattr(media_queue, "process_scene", lambda _scene_id: None)
    with TestClient(main.app) as client:
        yield client
