from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import FileResponse

from ..schemas import ExplorerSceneOut, SceneCreateIn, SceneListOut, SceneOut, ScenePage, SimilarScenePage
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


router = APIRouter(prefix="/api", tags=["scenes"])


@router.get("/scenes", response_model=ScenePage)
def explore_scenes(
    query: str | None = Query(default=None, max_length=500),
    cursor: int | None = Query(default=None, ge=0),
    limit: int = Query(default=48, ge=1, le=100),
) -> ScenePage:
    return get_scene_page(query, cursor, limit)


@router.get("/scenes/{scene_id}", response_model=ExplorerSceneOut)
def scene_detail(scene_id: int) -> ExplorerSceneOut:
    return get_scene_detail(scene_id)


@router.delete("/scenes/{scene_id}", status_code=204)
def remove_scene(scene_id: int) -> Response:
    delete_scene(scene_id)
    return Response(status_code=204)


@router.get("/scenes/{scene_id}/similar", response_model=SimilarScenePage)
def similar_scenes(
    scene_id: int,
    cursor: int | None = Query(default=None, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
) -> SimilarScenePage:
    return get_similar_scene_page(scene_id, cursor or 0, limit)


@router.post("/scenes/{scene_id}/retry", response_model=SceneOut)
def retry_failed_scene(scene_id: int, request: Request) -> SceneOut:
    scene = retry_scene(scene_id)
    if scene.analysis_status in {"pending", "processing"}:
        schedule_scenes(request.app, [scene_id])
    return scene


@router.get("/scenes/{scene_id}/snapshot")
def scene_snapshot(scene_id: int) -> FileResponse:
    return FileResponse(
        scene_snapshot_file(scene_id),
        media_type="image/webp",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/movies/{movie_id}/scenes", response_model=SceneListOut)
def movie_scenes(movie_id: int) -> SceneListOut:
    return SceneListOut(items=list_scenes(movie_id))


@router.post("/movies/{movie_id}/scenes", status_code=201, response_model=SceneOut)
def add_scene(movie_id: int, payload: SceneCreateIn, request: Request) -> SceneOut:
    scene = create_scene(movie_id, payload.timestamp_ms)
    schedule_scenes(request.app, [scene.id])
    return scene
