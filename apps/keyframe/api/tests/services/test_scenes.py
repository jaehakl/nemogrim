import math
import struct

import pytest
from sqlalchemy import select

from app.db import Scene
from app.routers import scenes
from app.services import scene_models, scene_processing, scene_query
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


def test_scene_explorer_lists_latest_and_searches_by_clip_similarity(
    api_client, session_factory, tmp_path, monkeypatch
):
    first_axis = [1.0] + [0.0] * 767
    second_axis = [0.0, 1.0] + [0.0] * 766
    first_embedding = struct.pack("<768f", *first_axis)
    second_embedding = struct.pack("<768f", *second_axis)
    monkeypatch.setattr(
        scene_query,
        "extract_clip_text_embedding",
        lambda _query: first_embedding,
    )
    with session_factory() as database:
        movie = make_movie(str(tmp_path / "탐색 영상.mp4"))
        movie.title = "탐색 영상"
        database.add(movie)
        database.flush()
        database.add_all([
            Scene(
                movie_file_id=movie.id,
                timestamp_ms=1_000,
                analysis_status="ready",
                embedding=first_embedding,
                embedding_model="OpenAI CLIP ViT-L/14",
            ),
            Scene(
                movie_file_id=movie.id,
                timestamp_ms=2_000,
                analysis_status="ready",
                embedding=first_embedding,
                embedding_model="OpenAI CLIP ViT-L/14",
            ),
            Scene(
                movie_file_id=movie.id,
                timestamp_ms=3_000,
                analysis_status="ready",
                embedding=second_embedding,
                embedding_model="OpenAI CLIP ViT-L/14",
            ),
            Scene(
                movie_file_id=movie.id,
                timestamp_ms=4_000,
                analysis_status="ready",
                embedding=first_embedding,
                embedding_model="다른 모델",
            ),
            Scene(
                movie_file_id=movie.id,
                timestamp_ms=5_000,
                analysis_status="processing",
                embedding=first_embedding,
                embedding_model="OpenAI CLIP ViT-L/14",
            ),
        ])
        database.commit()

    first_page = api_client.get("/api/scenes", params={"limit": 2}).json()
    assert [item["timestamp_ms"] for item in first_page["items"]] == [5_000, 4_000]
    assert first_page["total"] == 5
    assert first_page["next_offset"] == 2
    assert first_page["has_more"] is True
    assert first_page["items"][0]["movie_title"] == "탐색 영상"

    search = api_client.get(
        "/api/scenes", params={"query": "blue sky", "limit": 2}
    ).json()
    assert [item["timestamp_ms"] for item in search["items"]] == [2_000, 1_000]
    assert search["total"] == 3
    assert search["next_offset"] == 2
    assert all("embedding" not in item and "similarity" not in item for item in search["items"])

    last_page = api_client.get(
        "/api/scenes",
        params={"query": "blue sky", "offset": 2, "limit": 2},
    ).json()
    assert [item["timestamp_ms"] for item in last_page["items"]] == [3_000]
    assert last_page["next_offset"] is None
    assert last_page["has_more"] is False


def test_scene_explorer_validates_paging_and_reports_search_model_errors(
    api_client, monkeypatch
):
    assert api_client.get("/api/scenes", params={"offset": -1}).status_code == 422
    assert api_client.get("/api/scenes", params={"limit": 101}).status_code == 422
    assert api_client.get("/api/scenes", params={"query": "x" * 501}).status_code == 422

    monkeypatch.setattr(
        scene_query,
        "extract_clip_text_embedding",
        lambda _query: (_ for _ in ()).throw(RuntimeError("model load failure")),
    )
    response = api_client.get("/api/scenes", params={"query": "blue sky"})
    assert response.status_code == 503
    assert response.json()["detail"] == (
        "Scene 검색을 실행하지 못했습니다: model load failure"
    )


def test_scene_detail_and_similar_scenes_rank_across_movies(
    api_client, session_factory, tmp_path
):
    first_axis = struct.pack("<768f", 1.0, *([0.0] * 767))
    second_axis = struct.pack("<768f", 0.0, 1.0, *([0.0] * 766))
    with session_factory() as database:
        first_movie = make_movie(str(tmp_path / "첫 영상.mp4"))
        first_movie.title = "첫 영상"
        second_movie = make_movie(str(tmp_path / "둘째 영상.mp4"))
        second_movie.title = "둘째 영상"
        database.add_all([first_movie, second_movie])
        database.flush()
        source = Scene(
            movie_file_id=first_movie.id,
            timestamp_ms=1_000,
            analysis_status="ready",
            embedding=first_axis,
            embedding_model="OpenAI CLIP ViT-L/14",
        )
        same_movie = Scene(
            movie_file_id=first_movie.id,
            timestamp_ms=2_000,
            analysis_status="ready",
            embedding=first_axis,
            embedding_model="OpenAI CLIP ViT-L/14",
        )
        other_movie = Scene(
            movie_file_id=second_movie.id,
            timestamp_ms=3_000,
            analysis_status="ready",
            embedding=first_axis,
            embedding_model="OpenAI CLIP ViT-L/14",
        )
        orthogonal = Scene(
            movie_file_id=second_movie.id,
            timestamp_ms=4_000,
            analysis_status="ready",
            embedding=second_axis,
            embedding_model="OpenAI CLIP ViT-L/14",
        )
        database.add_all([
            source,
            same_movie,
            other_movie,
            orthogonal,
            Scene(
                movie_file_id=second_movie.id,
                timestamp_ms=5_000,
                analysis_status="ready",
                embedding=first_axis,
                embedding_model="다른 모델",
            ),
            Scene(
                movie_file_id=second_movie.id,
                timestamp_ms=6_000,
                analysis_status="processing",
                embedding=first_axis,
                embedding_model="OpenAI CLIP ViT-L/14",
            ),
            Scene(
                movie_file_id=second_movie.id,
                timestamp_ms=7_000,
                analysis_status="ready",
                embedding=struct.pack("<2f", 1.0, 0.0),
                embedding_model="OpenAI CLIP ViT-L/14",
            ),
        ])
        database.commit()
        source_id = source.id
        same_movie_id = same_movie.id
        other_movie_id = other_movie.id
        orthogonal_id = orthogonal.id

    detail = api_client.get(f"/api/scenes/{source_id}")
    assert detail.status_code == 200
    assert detail.json()["movie_title"] == "첫 영상"
    assert "embedding" not in detail.json()

    first_page = api_client.get(
        f"/api/scenes/{source_id}/similar", params={"limit": 2}
    ).json()
    assert [item["id"] for item in first_page["items"]] == [
        other_movie_id,
        same_movie_id,
    ]
    assert first_page["total"] == 3
    assert first_page["next_offset"] == 2
    assert first_page["has_more"] is True
    assert first_page["available"] is True

    last_page = api_client.get(
        f"/api/scenes/{source_id}/similar",
        params={"offset": 2, "limit": 2},
    ).json()
    assert [item["id"] for item in last_page["items"]] == [orthogonal_id]
    assert last_page["next_offset"] is None
    assert last_page["has_more"] is False


def test_similar_scenes_reports_unavailable_not_found_and_invalid_paging(
    api_client, session_factory, tmp_path
):
    with session_factory() as database:
        movie = make_movie(str(tmp_path / "미분석 영상.mp4"))
        database.add(movie)
        database.flush()
        scene = Scene(
            movie_file_id=movie.id,
            timestamp_ms=1_000,
            analysis_status="pending",
        )
        database.add(scene)
        database.commit()
        scene_id = scene.id

    unavailable = api_client.get(f"/api/scenes/{scene_id}/similar").json()
    assert unavailable == {
        "items": [],
        "total": 0,
        "next_offset": None,
        "has_more": False,
        "available": False,
    }
    assert api_client.get("/api/scenes/999999").status_code == 404
    assert api_client.get("/api/scenes/999999/similar").status_code == 404
    assert api_client.get(
        f"/api/scenes/{scene_id}/similar", params={"offset": -1}
    ).status_code == 422
    assert api_client.get(
        f"/api/scenes/{scene_id}/similar", params={"limit": 101}
    ).status_code == 422


def test_scene_delete_removes_database_row_and_snapshot_artifacts(
    api_client, session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    scene_dir = data_dir / "scenes"
    monkeypatch.setattr(scene_query, "DATA_DIR", data_dir)
    monkeypatch.setattr(scene_query, "SCENE_DIR", scene_dir)
    with session_factory() as database:
        movie = make_movie(str(tmp_path / "삭제 영상.mp4"))
        database.add(movie)
        database.flush()
        stored = Scene(
            movie_file_id=movie.id,
            timestamp_ms=1_000,
            analysis_status="ready",
        )
        without_snapshot = Scene(
            movie_file_id=movie.id,
            timestamp_ms=2_000,
            analysis_status="pending",
        )
        database.add_all([stored, without_snapshot])
        database.flush()
        stored.snapshot_path = f"scenes/{movie.id}/{stored.id}.webp"
        database.commit()
        stored_id = stored.id
        without_snapshot_id = without_snapshot.id
        movie_id = movie.id

    snapshot = scene_dir / str(movie_id) / f"{stored_id}.webp"
    temporary = scene_dir / str(movie_id) / f"{stored_id}.tmp.webp"
    snapshot.parent.mkdir(parents=True)
    snapshot.write_bytes(b"webp")
    temporary.write_bytes(b"temporary")

    response = api_client.delete(f"/api/scenes/{stored_id}")
    assert response.status_code == 200
    assert response.json() == {"deleted_id": stored_id}
    assert not snapshot.exists()
    assert not temporary.exists()
    with session_factory() as database:
        assert database.get(Scene, stored_id) is None
        assert database.get(Scene, without_snapshot_id) is not None

    assert api_client.delete(f"/api/scenes/{without_snapshot_id}").status_code == 200
    missing = api_client.delete("/api/scenes/999999")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Scene을 찾을 수 없습니다"


def test_scene_processing_removes_snapshot_when_scene_is_deleted_mid_job(
    session_factory, tmp_path, monkeypatch
):
    data_dir = tmp_path / "data"
    scene_dir = data_dir / "scenes"
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    monkeypatch.setattr(scene_processing, "DATA_DIR", data_dir)
    monkeypatch.setattr(scene_processing, "SCENE_DIR", scene_dir)
    with session_factory() as database:
        movie = make_movie(str(source))
        database.add(movie)
        database.flush()
        scene = Scene(movie_file_id=movie.id, timestamp_ms=1_000, analysis_status="pending")
        database.add(scene)
        database.commit()
        scene_id = scene.id
        movie_id = movie.id

    def snapshot(_source, _movie_id, _scene_id, _timestamp_ms):
        target = scene_dir / str(movie_id) / f"{scene_id}.webp"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"webp")
        with session_factory() as database:
            database.delete(database.get(Scene, scene_id))
            database.commit()
        return target

    monkeypatch.setattr(scene_processing, "create_scene_snapshot", snapshot)
    scene_processing.process_scene(scene_id)

    assert not (scene_dir / str(movie_id) / f"{scene_id}.webp").exists()


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
    monkeypatch.setattr(
        scene_processing,
        "analyze_scene",
        lambda _path: scene_models.SceneAnalysis(
            embedding=embedding,
            prompt="blue sky, 1girl",
            keywords=["blue sky", "1girl"],
        ),
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
        "analyze_scene",
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
