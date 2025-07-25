from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from db import Base, engine
from fastapi.staticfiles import StaticFiles
import os
import logging
import time

VIDEO_DIR = "../../video_files"

# 로그 설정 - 정적 파일 요청 로그 숨김
logging.basicConfig(level=logging.INFO)
# uvicorn.access 로거를 WARNING 레벨로 설정하여 정적 파일 요청 로그 숨김
access_logger = logging.getLogger("uvicorn.access")
access_logger.setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

def server():
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # When service starts.
        start()
    
        yield
        
        # When service is stopped.
        shutdown()

    app = FastAPI(lifespan=lifespan)

    origins = [
        "http://localhost",
        "http://localhost:5173",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    os.makedirs(VIDEO_DIR, exist_ok=True)
    app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")

    def start():
        app.state.progress = 0
        Base.metadata.create_all(bind=engine)
        print("service is started.")


    def shutdown():
        print("service is stopped.")    

    return app
