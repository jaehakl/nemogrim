from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..db import DATA_DIR, MovieFile, SessionLocal
from ..services.dialogs import choose_video_files, choose_video_folder
from ..services.media_queue import schedule_movies
from ..services.movie_import import empty_import_result, register_movie_paths, scan_video_folder
from ..services.movie_query import get_movie_detail, get_movie_page, get_movie_statuses
from ..services.playback import playback_file, prepare_playback


router = APIRouter(prefix="/api/movies")


class StatusRequest(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=5000)


@router.get("")
def list_movies(
    limit: int = Query(default=24, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
) -> dict:
    return get_movie_page(limit, before_id)


@router.post("/statuses")
def movie_statuses(payload: StatusRequest) -> dict:
    return get_movie_statuses(payload.ids)


@router.get("/{movie_id}")
def movie_detail(movie_id: int) -> dict:
    detail = get_movie_detail(movie_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    return detail


@router.post("/{movie_id}/playback/prepare")
def prepare_movie_playback(movie_id: int) -> dict:
    try:
        prepare_playback(movie_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=f"재생 정보를 확인하지 못했습니다: {error}") from error
    detail = get_movie_detail(movie_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    return detail


@router.get("/{movie_id}/stream")
def movie_stream(movie_id: int) -> FileResponse:
    try:
        path, media_type = playback_file(movie_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "no-store", "Accept-Ranges": "bytes"},
    )


@router.post("/import/files")
def import_files(request: Request) -> dict:
    try:
        selected = choose_video_files()
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"파일 탐색기를 열 수 없습니다: {error}") from error
    if not selected:
        return empty_import_result()
    result = register_movie_paths(selected)
    schedule_movies(request.app, result["added_ids"])
    return result


@router.post("/import/folder")
def import_folder(request: Request) -> dict:
    try:
        selected_folder = choose_video_folder()
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"폴더 탐색기를 열 수 없습니다: {error}") from error
    if not selected_folder:
        return empty_import_result()
    paths, scan_failures = scan_video_folder(selected_folder)
    result = register_movie_paths(paths, scan_failures)
    schedule_movies(request.app, result["added_ids"])
    return result


@router.get("/{movie_id}/thumbnail")
def movie_thumbnail(movie_id: int) -> FileResponse:
    with SessionLocal() as database:
        movie = database.get(MovieFile, movie_id)
        if movie is None or not movie.thumbnail_path:
            raise HTTPException(status_code=404, detail="썸네일을 찾을 수 없습니다")
        thumbnail = (DATA_DIR / movie.thumbnail_path).resolve()

    data_root = DATA_DIR.resolve()
    if not thumbnail.is_relative_to(data_root) or not thumbnail.is_file():
        raise HTTPException(status_code=404, detail="썸네일을 찾을 수 없습니다")
    return FileResponse(
        Path(thumbnail),
        media_type="image/webp",
        headers={"Cache-Control": "no-cache"},
    )
