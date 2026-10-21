import pytest
from sqlalchemy import select

from app.db import MovieFile
from app.services import media_processing
from tests.test_models import make_movie


def test_interrupted_processing_is_returned_to_pending(session_factory, tmp_path):
    with session_factory() as database:
        database.add_all([
            make_movie(str(tmp_path / "pending.mp4"), "pending"),
            make_movie(str(tmp_path / "processing.mp4"), "processing"),
            make_movie(str(tmp_path / "ready.mp4"), "ready"),
        ])
        database.commit()
    pending_ids = media_processing.reset_interrupted_jobs()
    with session_factory() as database:
        pending = list(
            database.scalars(
                select(MovieFile).where(MovieFile.id.in_(pending_ids)).order_by(MovieFile.id)
            )
        )
        assert [movie.metadata_status for movie in pending] == ["pending", "pending"]


def test_metadata_worker_keeps_success_and_failure_states(session_factory, tmp_path, monkeypatch):
    with session_factory() as database:
        success = make_movie(str(tmp_path / "success.mp4"), "pending")
        failure = make_movie(str(tmp_path / "failure.mp4"), "pending")
        database.add_all([success, failure])
        database.commit()
        success_id, failure_id = success.id, failure.id

    monkeypatch.setattr(
        media_processing,
        "probe_video",
        lambda _path: {"duration_ms": 120_000, "width": 1920, "height": 1080, "fps": 30.0},
    )
    monkeypatch.setattr(
        media_processing,
        "create_thumbnail",
        lambda _path, movie_id, _duration: f"thumbnails/{movie_id}.webp",
    )
    media_processing.process_movie_metadata(success_id)

    def fail_probe(_path):
        raise RuntimeError("codec error")

    monkeypatch.setattr(media_processing, "probe_video", fail_probe)
    media_processing.process_movie_metadata(failure_id)

    with session_factory() as database:
        success = database.get(MovieFile, success_id)
        failure = database.get(MovieFile, failure_id)
        assert success.metadata_status == "ready"
        assert success.duration_ms == 120_000
        assert success.thumbnail_path == f"thumbnails/{success_id}.webp"
        assert failure.metadata_status == "failed"
        assert failure.metadata_error == "codec error"


@pytest.mark.parametrize(
    ("duration_ms", "expected"),
    [
        (None, [1.0, 0.0]),
        (120_000, [12.0, 0.0]),
        (3_600_000, [60.0, 0.0]),
        (5_000, [1.0, 0.0]),
        (50, [0.0]),
    ],
)
def test_thumbnail_timestamps(duration_ms, expected):
    assert media_processing.thumbnail_timestamps(duration_ms) == pytest.approx(expected)


def test_create_thumbnail_falls_back_to_first_frame(data_dir, monkeypatch):
    attempts = []

    def extract(_source, seconds, destination, **_options):
        attempts.append(seconds)
        if seconds > 0:
            raise RuntimeError("seek failed")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"webp")
        return destination

    monkeypatch.setattr(media_processing, "extract_frame_webp", extract)
    assert media_processing.create_thumbnail("movie.mp4", 7, 120_000) == "thumbnails/7.webp"
    assert attempts == [12.0, 0.0]
