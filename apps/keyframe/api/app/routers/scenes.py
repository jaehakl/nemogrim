from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from ..services.media_queue import schedule_scenes
from ..services.scene_query import (
    create_scene,
    list_scenes,
    retry_scene,
    scene_snapshot_file,
)


router = APIRouter(prefix="/api")


class SceneCreateRequest(BaseModel):
    timestamp_ms: int = Field(ge=0)


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
