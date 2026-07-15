from app.db import MovieFile
from app.services import playback
from tests.test_models import make_movie


def test_direct_playback_compatibility_rules():
    assert playback.is_direct_playback(".mp4", "h264", "aac") is True
    assert playback.is_direct_playback(".m4v", "h264", "mp3") is True
    assert playback.is_direct_playback(".webm", "vp9", "opus") is True
    assert playback.is_direct_playback(".mkv", "h264", "aac") is False
    assert playback.is_direct_playback(".mp4", "hevc", "aac") is False


def test_prepare_marks_direct_and_blocks_unsupported_files(
    session_factory, tmp_path
):
    direct_path = tmp_path / "direct.mp4"
    hevc_path = tmp_path / "hevc.mp4"
    legacy_path = tmp_path / "legacy.mkv"
    for path in (direct_path, hevc_path, legacy_path):
        path.write_bytes(b"video")
    with session_factory() as database:
        direct = make_movie(str(direct_path), video_codec="h264", audio_codec="aac")
        hevc = make_movie(str(hevc_path), video_codec="hevc", audio_codec="aac")
        legacy = make_movie(
            str(legacy_path),
            video_codec="h264",
            audio_codec="aac",
            playback_status="ready",
            playback_path="playback/legacy.mp4",
        )
        database.add_all([direct, hevc, legacy])
        database.commit()
        ids = direct.id, hevc.id, legacy.id

    for movie_id in ids:
        assert playback.prepare_playback(movie_id) is None

    with session_factory() as database:
        direct, hevc, legacy = [database.get(MovieFile, movie_id) for movie_id in ids]
        assert direct.playback_status == "direct"
        assert hevc.playback_status == "failed"
        assert hevc.playback_error == playback.UNSUPPORTED_CODEC_ERROR
        assert legacy.playback_status == "failed"
        assert legacy.playback_error == playback.UNSUPPORTED_EXTENSION_ERROR
        assert legacy.playback_path == "playback/legacy.mp4"


def test_stream_endpoint_supports_ranges_only_for_direct_original(
    api_client, session_factory, tmp_path
):
    direct_path = tmp_path / "range.mp4"
    blocked_path = tmp_path / "blocked.mkv"
    direct_path.write_bytes(b"0123456789")
    blocked_path.write_bytes(b"legacy")
    with session_factory() as database:
        direct = make_movie(
            str(direct_path),
            video_codec="h264",
            audio_codec="aac",
            playback_status="direct",
        )
        blocked = make_movie(
            str(blocked_path),
            video_codec="h264",
            audio_codec="aac",
            playback_status="ready",
            playback_path="playback/blocked.mp4",
        )
        database.add_all([direct, blocked])
        database.commit()
        direct_id, blocked_id = direct.id, blocked.id

    response = api_client.get(
        f"/api/movies/{direct_id}/stream", headers={"Range": "bytes=2-5"}
    )
    assert response.status_code == 206
    assert response.content == b"2345"
    assert response.headers["content-range"] == "bytes 2-5/10"
    assert response.headers["accept-ranges"] == "bytes"
    assert api_client.get(f"/api/movies/{blocked_id}/stream").status_code == 409


def test_prepare_endpoint_blocks_incompatible_codec_without_queue(
    api_client, session_factory, tmp_path
):
    source = tmp_path / "movie.mp4"
    source.write_bytes(b"video")
    with session_factory() as database:
        movie = make_movie(str(source), video_codec="hevc", audio_codec="aac")
        database.add(movie)
        database.commit()
        movie_id = movie.id

    response = api_client.post(f"/api/movies/{movie_id}/playback/prepare")
    assert response.status_code == 200
    assert response.json()["playback_status"] == "failed"
    assert response.json()["stream_url"] is None


def test_startup_normalizes_states_without_deleting_rows_or_legacy_proxy(
    session_factory, tmp_path
):
    legacy_proxy = tmp_path / "legacy-proxy.mp4"
    legacy_proxy.write_bytes(b"keep me")
    with session_factory() as database:
        movies = [
            make_movie(
                str(tmp_path / "legacy.avi"),
                video_codec="h264",
                audio_codec="aac",
                playback_status="ready",
                playback_path=str(legacy_proxy),
            ),
            make_movie(
                str(tmp_path / "hevc.mp4"),
                video_codec="hevc",
                audio_codec="aac",
                playback_status="ready",
            ),
            make_movie(
                str(tmp_path / "unknown.mp4"),
                playback_status="processing",
            ),
            make_movie(
                str(tmp_path / "direct.webm"),
                video_codec="vp9",
                audio_codec="opus",
                playback_status="unprepared",
            ),
        ]
        database.add_all(movies)
        database.commit()
        ids = [movie.id for movie in movies]

    playback.normalize_playback_states()

    with session_factory() as database:
        movies = [database.get(MovieFile, movie_id) for movie_id in ids]
        assert [movie.playback_status for movie in movies] == [
            "failed", "failed", "unprepared", "direct"
        ]
        assert movies[0].playback_path == str(legacy_proxy)
        assert database.query(MovieFile).count() == 4
    assert legacy_proxy.read_bytes() == b"keep me"
