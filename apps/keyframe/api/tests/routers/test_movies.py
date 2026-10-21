from app.routers import movies
from tests.test_models import make_movie


def test_movies_api_uses_stable_id_cursor(api_client, session_factory, tmp_path):
    with session_factory() as database:
        for number in range(30):
            database.add(make_movie(str(tmp_path / f"movie-{number}.mp4"), "pending" if number < 2 else "ready"))
        database.commit()

    first = api_client.get("/api/movies", params={"limit": 24}).json()
    second = api_client.get("/api/movies", params={"limit": 24, "cursor": first["next_cursor"]}).json()

    assert len(first["items"]) == 24 and first["total"] == 30
    assert first["processing_count"] == 2
    assert len(second["items"]) == 6 and second["next_cursor"] is None
    assert not ({item["id"] for item in first["items"]} & {item["id"] for item in second["items"]})
    assert first["items"][0]["created_at"].endswith("Z")


def test_movie_detail_reports_missing_movie(api_client):
    response = api_client.get("/api/movies/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "영상을 찾을 수 없습니다"}


def test_movie_thumbnail_is_served_with_revalidation_cache_policy(
    api_client, session_factory, tmp_path, data_dir
):
    thumbnail = data_dir / "thumbnails" / "1.webp"
    thumbnail.parent.mkdir(parents=True)
    thumbnail.write_bytes(b"thumbnail")
    with session_factory() as database:
        movie = make_movie(str(tmp_path / "movie.mp4"), thumbnail_path="thumbnails/1.webp")
        escaped = make_movie(str(tmp_path / "escaped.mp4"), thumbnail_path="../outside.webp")
        database.add_all([movie, escaped])
        database.commit()
        movie_id, escaped_id = movie.id, escaped.id

    response = api_client.get(f"/api/movies/{movie_id}/thumbnail")

    assert response.content == b"thumbnail"
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["cache-control"] == "no-cache"
    assert api_client.get(f"/api/movies/{escaped_id}/thumbnail").status_code == 404


def test_file_import_cancel_and_success(api_client, tmp_path, monkeypatch):
    monkeypatch.setattr(movies, "choose_video_files", lambda: [])
    assert api_client.post("/api/movies/import/files").json()["cancelled"] is True

    video = tmp_path / "새 영상.mp4"
    video.write_bytes(b"video")
    monkeypatch.setattr(movies, "choose_video_files", lambda: [str(video)])
    added = api_client.post("/api/movies/import/files").json()
    assert added["added_count"] == 1
    listed = api_client.get("/api/movies").json()
    assert listed["items"][0]["id"] == added["added_ids"][0]


def test_import_reports_picker_failure_as_unavailable(api_client, monkeypatch):
    def fail():
        raise RuntimeError("no desktop")

    monkeypatch.setattr(movies, "choose_video_folder", fail)
    response = api_client.post("/api/movies/import/folder")
    assert response.status_code == 503
    assert response.json()["detail"] == "폴더 탐색기를 열 수 없습니다: no desktop"


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
