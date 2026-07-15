from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import health, movies, scenes
from .services.media_queue import start_media_queue, stop_media_queue


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_media_queue(app)
    yield
    stop_media_queue(app)


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
