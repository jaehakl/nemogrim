from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ai.runtime import AiRuntime, set_ai_runtime
from .db import init_db
from .errors import register_exception_handlers
from .routers import ai, health, movies, scenes
from .services.media_queue import start_media_queue, stop_media_queue
from .settings import KeyframeSettings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    runtime = AiRuntime(app.state.settings)
    runtime.start()
    set_ai_runtime(runtime)
    try:
        start_media_queue(app)
        try:
            yield
        finally:
            # 진행 중인 Scene 분석이 AI 워커를 쓰므로 큐를 먼저 멈춘다.
            stop_media_queue(app)
    finally:
        set_ai_runtime(None)
        runtime.shutdown()


settings = KeyframeSettings()

app = FastAPI(title="Nemogrim Keyframe API", version="0.2.0", lifespan=lifespan)
app.state.settings = settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)
register_exception_handlers(app)
for router_module in (health, ai, movies, scenes):
    app.include_router(router_module.router)
