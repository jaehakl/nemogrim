from pathlib import Path

from sqlalchemy import func, select

from app.db import MovieFile
from app.services.movie_import import normalize_path, register_movie_paths, scan_video_folder


def test_registers_new_paths_and_skips_duplicates(session_factory, tmp_path):
    video = tmp_path / "한글 영상.MP4"
    video.write_bytes(b"video")
    unsupported = tmp_path / "notes.txt"
    unsupported.write_text("not a video", encoding="utf-8")
    result = register_movie_paths([video, video, unsupported])
    assert (result["selected_count"], result["added_count"]) == (3, 1)
    assert (result["duplicate_count"], result["failed_count"]) == (1, 1)

    with session_factory() as database:
        movie = database.scalar(select(MovieFile))
        assert (movie.title, movie.ext, movie.path) == ("한글 영상", ".mp4", str(video.resolve()))

    repeated = register_movie_paths([video])
    assert repeated["added_count"] == 0
    assert repeated["duplicate_count"] == 1


def test_same_filename_in_different_folders_is_not_duplicate(session_factory, tmp_path):
    paths = [tmp_path / "one" / "movie.mp4", tmp_path / "two" / "movie.mp4"]
    for path in paths:
        path.parent.mkdir()
        path.write_bytes(b"video")
    result = register_movie_paths(paths)
    assert result["added_count"] == 2
    with session_factory() as database:
        assert database.scalar(select(func.count(MovieFile.id))) == 2


def test_path_normalization_is_case_insensitive(tmp_path):
    path = tmp_path / "MixedCase" / "Movie.MP4"
    assert normalize_path(path) == normalize_path(str(path).swapcase())


def test_folder_scan_is_recursive_and_filters_extensions(tmp_path):
    nested = tmp_path / "하위 폴더"
    nested.mkdir()
    (tmp_path / "first.mp4").write_bytes(b"one")
    (nested / "second.WEBM").write_bytes(b"two")
    (nested / "third.m4v").write_bytes(b"three")
    for name in ("old.avi", "old.mkv", "old.mov", "old.wmv", "old.flv"):
        (nested / name).write_bytes(b"unsupported")
    (nested / "subtitle.srt").write_text("subtitle", encoding="utf-8")
    videos, failures = scan_video_folder(tmp_path)
    assert failures == []
    assert {Path(path).name for path in videos} == {
        "first.mp4", "second.WEBM", "third.m4v"
    }


def test_rejects_old_non_playable_extensions(session_factory, tmp_path):
    paths = []
    for extension in (".avi", ".mkv", ".mov", ".wmv", ".flv"):
        path = tmp_path / f"movie{extension}"
        path.write_bytes(b"video")
        paths.append(path)
    result = register_movie_paths(paths)
    assert result["added_count"] == 0
    assert result["failed_count"] == 5
