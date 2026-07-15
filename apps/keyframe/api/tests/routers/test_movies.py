from app.routers import movies
from tests.test_models import make_movie


def test_movies_api_uses_stable_id_cursor(api_client, session_factory, tmp_path):
    with session_factory() as database:
        for number in range(30):
            database.add(make_movie(str(tmp_path / f"movie-{number}.mp4")))
        database.commit()
    first = api_client.get("/api/movies?limit=24").json()
    second = api_client.get("/api/movies", params={"limit": 24, "before_id": first["next_cursor"]}).json()
    assert len(first["items"]) == 24 and first["total"] == 30 and first["has_more"] is True
    assert len(second["items"]) == 6 and second["has_more"] is False
    assert not ({item["id"] for item in first["items"]} & {item["id"] for item in second["items"]})


def test_file_import_cancel_and_status_response(api_client, tmp_path, monkeypatch):
    monkeypatch.setattr(movies, "choose_video_files", lambda: [])
    assert api_client.post("/api/movies/import/files").json()["cancelled"] is True

    video = tmp_path / "새 영상.mp4"
    video.write_bytes(b"video")
    monkeypatch.setattr(movies, "choose_video_files", lambda: [str(video)])
    added = api_client.post("/api/movies/import/files").json()
    assert added["added_count"] == 1
    statuses = api_client.post("/api/movies/statuses", json={"ids": added["added_ids"]}).json()
    assert statuses["items"][0]["id"] == added["added_ids"][0]


def test_folder_endpoint_registers_nested_videos(api_client, tmp_path, monkeypatch):
    nested = tmp_path / "선택 폴더" / "하위"
    nested.mkdir(parents=True)
    (nested / "clip.mp4").write_bytes(b"video")
    (nested / "ignore.txt").write_text("ignore", encoding="utf-8")
    monkeypatch.setattr(movies, "choose_video_folder", lambda: str(tmp_path / "선택 폴더"))
    scheduled = []
    monkeypatch.setattr(movies, "schedule_movies", lambda _app, ids: scheduled.extend(ids))
    response = api_client.post("/api/movies/import/folder")
    assert response.status_code == 200
    assert response.json()["added_count"] == 1
    assert scheduled == response.json()["added_ids"]
