from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse

from ..errors import ServiceUnavailableError
from ..schemas import ImportResultOut, MovieDetailOut, MoviePage
from ..services.dialogs import choose_video_files, choose_video_folder
from ..services.media_queue import schedule_movies
from ..services.movie_import import register_movie_paths, scan_video_folder
from ..services.movie_query import get_movie_detail, get_movie_page, movie_thumbnail_file
from ..services.playback import playback_file, prepare_playback


router = APIRouter(prefix="/api/movies", tags=["movies"])


@router.get("", response_model=MoviePage)
def list_movies(
    limit: int = Query(default=24, ge=1, le=100),
    cursor: int | None = Query(default=None, ge=1),
) -> MoviePage:
    return get_movie_page(limit, cursor)


@router.get("/{movie_id}", response_model=MovieDetailOut)
def movie_detail(movie_id: int) -> MovieDetailOut:
    return get_movie_detail(movie_id)


@router.post("/{movie_id}/playback/prepare", response_model=MovieDetailOut)
def prepare_movie_playback(movie_id: int) -> MovieDetailOut:
    prepare_playback(movie_id)
    return get_movie_detail(movie_id)


@router.get("/{movie_id}/stream")
def movie_stream(movie_id: int) -> FileResponse:
    path, media_type = playback_file(movie_id)
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "no-store", "Accept-Ranges": "bytes"},
    )


@router.get("/{movie_id}/thumbnail")
def movie_thumbnail(movie_id: int) -> FileResponse:
    return FileResponse(
        movie_thumbnail_file(movie_id),
        media_type="image/webp",
        headers={"Cache-Control": "no-cache"},
    )


@router.post("/import/files", response_model=ImportResultOut)
def import_files(request: Request) -> ImportResultOut:
    try:
        selected = choose_video_files()
    except Exception as error:
        raise ServiceUnavailableError(f"파일 탐색기를 열 수 없습니다: {error}") from error
    if not selected:
        return ImportResultOut.empty()
    result = register_movie_paths(selected)
    schedule_movies(request.app, result.added_ids)
    return result


@router.post("/import/folder", response_model=ImportResultOut)
def import_folder(request: Request) -> ImportResultOut:
    try:
        selected_folder = choose_video_folder()
    except Exception as error:
        raise ServiceUnavailableError(f"폴더 탐색기를 열 수 없습니다: {error}") from error
    if not selected_folder:
        return ImportResultOut.empty()
    paths, scan_failures = scan_video_folder(selected_folder)
    result = register_movie_paths(paths, scan_failures)
    schedule_movies(request.app, result.added_ids)
    return result
