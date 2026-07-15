from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from ..db import MovieFile, SessionLocal, utc_now
from .media_processing import probe_video


SUPPORTED_PLAYBACK_EXTENSIONS = frozenset({".mp4", ".m4v", ".webm"})
UNSUPPORTED_EXTENSION_ERROR = "브라우저에서 직접 재생할 수 없는 파일 형식입니다"
UNSUPPORTED_CODEC_ERROR = "브라우저에서 직접 재생할 수 없는 영상 codec입니다"


def is_direct_playback(ext: str, video_codec: str | None, audio_codec: str | None) -> bool:
    if ext in {".mp4", ".m4v"}:
        return video_codec == "h264" and audio_codec in {None, "aac", "mp3"}
    if ext == ".webm":
        return video_codec in {"vp8", "vp9"} and audio_codec in {None, "opus", "vorbis"}
    return False


def prepare_playback(movie_id: int) -> None:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise LookupError("영상을 찾을 수 없습니다")
        if not Path(movie.path).is_file():
            raise FileNotFoundError("원본 영상 파일을 찾을 수 없습니다")

        if movie.ext not in SUPPORTED_PLAYBACK_EXTENSIONS:
            _mark_failed(movie, UNSUPPORTED_EXTENSION_ERROR)
            database.commit()
            return

        if not movie.video_codec:
            metadata = probe_video(movie.path)
            movie.video_codec = metadata.get("video_codec")
            movie.audio_codec = metadata.get("audio_codec")

        if is_direct_playback(movie.ext, movie.video_codec, movie.audio_codec):
            movie.playback_status = "direct"
            movie.playback_error = None
        else:
            _mark_failed(movie, UNSUPPORTED_CODEC_ERROR)
        movie.updated_at = utc_now()
        database.commit()


def playback_file(movie_id: int) -> tuple[Path, str]:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise LookupError("영상을 찾을 수 없습니다")
        if movie.playback_status != "direct" or not is_direct_playback(
            movie.ext, movie.video_codec, movie.audio_codec
        ):
            raise RuntimeError("브라우저에서 직접 재생할 수 없는 영상입니다")
        path = Path(movie.path).resolve()
        media_type = "video/webm" if movie.ext == ".webm" else "video/mp4"
    if not path.is_file():
        raise FileNotFoundError("재생할 영상 파일을 찾을 수 없습니다")
    return path, media_type


def normalize_playback_states() -> None:
    with SessionLocal() as database:
        movies = database.scalars(select(MovieFile)).all()
        changed = False
        for movie in movies:
            if movie.ext not in SUPPORTED_PLAYBACK_EXTENSIONS:
                status, error = "failed", UNSUPPORTED_EXTENSION_ERROR
            elif movie.video_codec:
                direct = is_direct_playback(movie.ext, movie.video_codec, movie.audio_codec)
                status = "direct" if direct else "failed"
                error = None if direct else UNSUPPORTED_CODEC_ERROR
            elif movie.playback_status in {"direct", "pending", "processing", "ready"}:
                status, error = "unprepared", None
            else:
                continue

            if movie.playback_status != status or movie.playback_error != error:
                movie.playback_status = status
                movie.playback_error = error
                movie.updated_at = utc_now()
                changed = True
        if changed:
            database.commit()


def _mark_failed(movie: MovieFile, message: str) -> None:
    movie.playback_status = "failed"
    movie.playback_error = message
    movie.updated_at = utc_now()
