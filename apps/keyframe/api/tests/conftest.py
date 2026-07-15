from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import main  # noqa: E402
from app.db import Base  # noqa: E402
from app.routers import health, movies  # noqa: E402
from app.services import (  # noqa: E402
    media_processing,
    media_queue,
    movie_import,
    movie_query,
    playback,
    scene_processing,
    scene_query,
)


@pytest.fixture
def session_factory(tmp_path, monkeypatch):
    database_path = tmp_path / "test.sqlite3"
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    for module in (
        movie_import,
        movie_query,
        media_processing,
        playback,
        scene_processing,
        scene_query,
        health,
        movies,
    ):
        monkeypatch.setattr(module, "SessionLocal", factory)
    yield factory
    engine.dispose()


@pytest.fixture
def api_client(session_factory, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main, "KeyframeSettings", lambda: object())
    monkeypatch.setattr(main, "start_scene_model_runtime", lambda _settings: None)
    monkeypatch.setattr(main, "stop_scene_model_runtime", lambda: None)
    monkeypatch.setattr(media_queue, "reset_interrupted_jobs", lambda: [])
    monkeypatch.setattr(media_queue, "reset_scene_jobs", lambda: [])
    monkeypatch.setattr(media_queue, "process_movie_metadata", lambda _movie_id: None)
    monkeypatch.setattr(media_queue, "process_scene", lambda _scene_id: None)
    with TestClient(main.app) as client:
        yield client
