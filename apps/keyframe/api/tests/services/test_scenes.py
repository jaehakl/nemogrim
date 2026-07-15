import math
import struct

import pytest
from sqlalchemy import select

from app.db import Scene
from app.routers import scenes
from app.services import scene_processing
from tests.test_models import make_movie


def test_scene_api_validates_timestamp_sorts_and_rejects_duplicates(
    api_client, session_factory, tmp_path, monkeypatch
):
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    with session_factory() as database:
        movie = make_movie(str(source), duration_ms=10_000)
        database.add(movie)
        database.commit()
        movie_id = movie.id
    scheduled = []
    monkeypatch.setattr(scenes, "schedule_scenes", lambda _app, ids: scheduled.extend(ids))

    assert api_client.post(
        f"/api/movies/{movie_id}/scenes", json={"timestamp_ms": -1}
    ).status_code == 422
    assert api_client.post(
        f"/api/movies/{movie_id}/scenes", json={"timestamp_ms": 10_001}
    ).status_code == 422
    later = api_client.post(
        f"/api/movies/{movie_id}/scenes", json={"timestamp_ms": 9_000}
    )
    earlier = api_client.post(
        f"/api/movies/{movie_id}/scenes", json={"timestamp_ms": 1_500}
    )
    duplicate = api_client.post(
        f"/api/movies/{movie_id}/scenes", json={"timestamp_ms": 1_500}
    )

    assert later.status_code == earlier.status_code == 201
    assert later.json()["analysis_status"] == "pending"
    assert duplicate.status_code == 409
    assert scheduled == [later.json()["id"], earlier.json()["id"]]
    listed = api_client.get(f"/api/movies/{movie_id}/scenes").json()["items"]
    assert [item["timestamp_ms"] for item in listed] == [1_500, 9_000]
    assert all("embedding" not in item for item in listed)


def test_scene_analysis_saves_snapshot_embedding_and_prompt(
    session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    scene_dir = data_dir / "scenes"
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    values = [1 / math.sqrt(768)] * 768
    embedding = struct.pack("<768f", *values)
    monkeypatch.setattr(scene_processing, "DATA_DIR", data_dir)
    monkeypatch.setattr(scene_processing, "SCENE_DIR", scene_dir)

    def snapshot(_source, movie_id, scene_id, _timestamp_ms):
        target = scene_dir / str(movie_id) / f"{scene_id}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"webp")
        return target

    monkeypatch.setattr(scene_processing, "create_scene_snapshot", snapshot)
    monkeypatch.setattr(scene_processing, "extract_clip_embedding", lambda _path: embedding)
    monkeypatch.setattr(
        scene_processing,
        "extract_wd14_tags",
        lambda _path: ("blue sky, 1girl", ["blue sky", "1girl"]),
    )
    with session_factory() as database:
        movie = make_movie(str(source), duration_ms=30_000)
        database.add(movie)
        database.flush()
        scene = Scene(movie_file_id=movie.id, timestamp_ms=5_500, analysis_status="pending")
        database.add(scene)
        database.commit()
        scene_id = scene.id

    scene_processing.process_scene(scene_id)
    with session_factory() as database:
        result = database.get(Scene, scene_id)
        assert result.analysis_status == "ready"
        assert result.snapshot_path == f"scenes/{result.movie_file_id}/{scene_id}.webp"
        assert result.embedding_model == "OpenAI CLIP ViT-L/14"
        assert result.prompt_model == "SmilingWolf/wd-eva02-large-tagger-v3"
        assert len(result.embedding) == 768 * 4
        norm = math.sqrt(sum(value * value for value in struct.unpack("<768f", result.embedding)))
        assert norm == pytest.approx(1.0, abs=1e-5)
        assert result.prompt == "blue sky, 1girl"
        assert result.keywords == ["blue sky", "1girl"]


def test_scene_analysis_failure_keeps_snapshot_and_can_retry(
    api_client, session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    scene_dir = data_dir / "scenes"
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    monkeypatch.setattr(scene_processing, "DATA_DIR", data_dir)
    monkeypatch.setattr(scene_processing, "SCENE_DIR", scene_dir)

    def snapshot(_source, movie_id, scene_id, _timestamp_ms):
        target = scene_dir / str(movie_id) / f"{scene_id}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"webp")
        return target

    monkeypatch.setattr(scene_processing, "create_scene_snapshot", snapshot)
    monkeypatch.setattr(
        scene_processing,
        "extract_clip_embedding",
        lambda _path: (_ for _ in ()).throw(RuntimeError("model failure")),
    )
    with session_factory() as database:
        movie = make_movie(str(source), duration_ms=30_000)
        database.add(movie)
        database.flush()
        scene = Scene(movie_file_id=movie.id, timestamp_ms=2_000, analysis_status="pending")
        database.add(scene)
        database.commit()
        scene_id = scene.id

    scene_processing.process_scene(scene_id)
    with session_factory() as database:
        failed = database.get(Scene, scene_id)
        assert failed.analysis_status == "failed"
        assert failed.analysis_error == "model failure"
        assert failed.snapshot_path is not None

    scheduled = []
    monkeypatch.setattr(scenes, "schedule_scenes", lambda _app, ids: scheduled.extend(ids))
    response = api_client.post(f"/api/scenes/{scene_id}/retry")
    assert response.status_code == 200
    assert response.json()["analysis_status"] == "pending"
    assert scheduled == [scene_id]


def test_interrupted_scene_jobs_return_to_pending(session_factory, tmp_path):
    source = tmp_path / "movie.mp4"
    with session_factory() as database:
        movie = make_movie(str(source))
        database.add(movie)
        database.flush()
        database.add_all([
            Scene(movie_file_id=movie.id, timestamp_ms=1_000, analysis_status="pending"),
            Scene(movie_file_id=movie.id, timestamp_ms=2_000, analysis_status="processing"),
            Scene(movie_file_id=movie.id, timestamp_ms=3_000, analysis_status="ready"),
        ])
        database.commit()

    pending_ids = scene_processing.reset_scene_jobs()
    with session_factory() as database:
        pending = database.scalars(
            select(Scene).where(Scene.id.in_(pending_ids)).order_by(Scene.id)
        ).all()
        assert [scene.analysis_status for scene in pending] == ["pending", "pending"]
