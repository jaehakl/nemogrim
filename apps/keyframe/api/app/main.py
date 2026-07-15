from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import health, movies, scenes
from .settings import KeyframeSettings
from .services.media_queue import start_media_queue, stop_media_queue
from .services.scene_models import start_scene_model_runtime, stop_scene_model_runtime


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings = KeyframeSettings()
    app.state.settings = settings
    runtime_started = False
    queue_started = False
    try:
        start_scene_model_runtime(settings)
        runtime_started = True
        start_media_queue(app)
        queue_started = True
        yield
    finally:
        if queue_started:
            stop_media_queue(app)
        if runtime_started:
            stop_scene_model_runtime()


app = FastAPI(title="Nemogrim Keyframe API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5175", "http://localhost:5175"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(health.router)
app.include_router(movies.router)
app.include_router(scenes.router)
