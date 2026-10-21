from __future__ import annotations

from pathlib import Path

from ..db import MovieFile, new_session
from ..errors import NotFoundError, PlaybackUnavailableError, ServiceUnavailableError
from .ffmpeg import probe_video
from .movie_import import SUPPORTED_EXTENSIONS


UNSUPPORTED_EXTENSION_ERROR = "브라우저에서 직접 재생할 수 없는 파일 형식입니다"
UNSUPPORTED_CODEC_ERROR = "브라우저에서 직접 재생할 수 없는 영상 codec입니다"
MOVIE_NOT_FOUND = "영상을 찾을 수 없습니다"


def is_direct_playback(ext: str, video_codec: str | None, audio_codec: str | None) -> bool:
    if ext in {".mp4", ".m4v"}:
        return video_codec == "h264" and audio_codec in {None, "aac", "mp3"}
    if ext == ".webm":
        return video_codec in {"vp8", "vp9"} and audio_codec in {None, "opus", "vorbis"}
    return False


def prepare_playback(movie_id: int) -> None:
    """원본 파일을 브라우저가 직접 재생할 수 있는지 판정해 playback_status에 기록한다."""
    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise NotFoundError(MOVIE_NOT_FOUND)
        if not Path(movie.path).is_file():
            raise NotFoundError("원본 영상 파일을 찾을 수 없습니다")

        if movie.ext not in SUPPORTED_EXTENSIONS:
            _mark_failed(movie, UNSUPPORTED_EXTENSION_ERROR)
        else:
            if not movie.video_codec:
                try:
                    metadata = probe_video(movie.path)
                except RuntimeError as error:
                    raise ServiceUnavailableError(
                        f"재생 정보를 확인하지 못했습니다: {error}"
                    ) from error
                movie.video_codec = metadata.get("video_codec")
                movie.audio_codec = metadata.get("audio_codec")
            if is_direct_playback(movie.ext, movie.video_codec, movie.audio_codec):
                movie.playback_status = "direct"
                movie.playback_error = None
            else:
                _mark_failed(movie, UNSUPPORTED_CODEC_ERROR)
        database.commit()


def playback_file(movie_id: int) -> tuple[Path, str]:
    with new_session() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None:
            raise NotFoundError(MOVIE_NOT_FOUND)
        if movie.playback_status != "direct" or not is_direct_playback(
            movie.ext, movie.video_codec, movie.audio_codec
        ):
            raise PlaybackUnavailableError("브라우저에서 직접 재생할 수 없는 영상입니다")
        path = Path(movie.path).resolve()
        media_type = "video/webm" if movie.ext == ".webm" else "video/mp4"
    if not path.is_file():
        raise NotFoundError("재생할 영상 파일을 찾을 수 없습니다")
    return path, media_type


def _mark_failed(movie: MovieFile, message: str) -> None:
    movie.playback_status = "failed"
    movie.playback_error = message
