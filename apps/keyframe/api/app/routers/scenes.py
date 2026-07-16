from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from ..services.media_queue import schedule_scenes
from ..services.scene_query import (
    create_scene,
    delete_scene,
    get_scene_detail,
    get_scene_page,
    get_similar_scene_page,
    list_scenes,
    retry_scene,
    scene_snapshot_file,
)


router = APIRouter(prefix="/api")


class SceneCreateRequest(BaseModel):
    timestamp_ms: int = Field(ge=0)


@router.get("/scenes")
def explore_scenes(
    query: str | None = Query(default=None, max_length=500),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=48, ge=1, le=100),
) -> dict:
    try:
        return get_scene_page(query, offset, limit)
    except Exception as error:
        if query and query.strip():
            message = str(error) or error.__class__.__name__
            raise HTTPException(
                status_code=503,
                detail=f"Scene 검색을 실행하지 못했습니다: {message}",
            ) from error
        raise


@router.get("/scenes/{scene_id}")
def scene_detail(scene_id: int) -> dict:
    scene = get_scene_detail(scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene을 찾을 수 없습니다")
    return scene


@router.delete("/scenes/{scene_id}")
def remove_scene(scene_id: int) -> dict:
    if not delete_scene(scene_id):
        raise HTTPException(status_code=404, detail="Scene을 찾을 수 없습니다")
    return {"deleted_id": scene_id}


@router.get("/scenes/{scene_id}/similar")
def similar_scenes(
    scene_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
) -> dict:
    page = get_similar_scene_page(scene_id, offset, limit)
    if page is None:
        raise HTTPException(status_code=404, detail="Scene을 찾을 수 없습니다")
    return page


@router.get("/movies/{movie_id}/scenes")
def movie_scenes(movie_id: int) -> dict:
    items = list_scenes(movie_id)
    if items is None:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    return {"items": items}


@router.post("/movies/{movie_id}/scenes", status_code=201)
def add_scene(movie_id: int, payload: SceneCreateRequest, request: Request) -> dict:
    try:
        scene = create_scene(movie_id, payload.timestamp_ms)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="같은 timestamp의 Scene이 이미 있습니다") from error
    schedule_scenes(request.app, [scene["id"]])
    return scene


@router.post("/scenes/{scene_id}/retry")
def retry_failed_scene(scene_id: int, request: Request) -> dict:
    scene = retry_scene(scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene을 찾을 수 없습니다")
    if scene["analysis_status"] in {"pending", "processing"}:
        schedule_scenes(request.app, [scene_id])
    return scene


@router.get("/scenes/{scene_id}/snapshot")
def scene_snapshot(scene_id: int) -> FileResponse:
    try:
        path = scene_snapshot_file(scene_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return FileResponse(
        path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
