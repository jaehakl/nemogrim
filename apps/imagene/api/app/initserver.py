from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import Base, engine
from settings import settings
import os
from fastapi.staticfiles import StaticFiles

def server():
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # When service starts.
        await start()
    
        yield
        
        # When service is stopped.
        shutdown()

    app = FastAPI(lifespan=lifespan)

    origins = [
        "http://localhost",
        "http://localhost:5173",
        settings.app_base_url
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    FIGURE_DIR = "figures"
    os.makedirs(FIGURE_DIR, exist_ok=True)
    app.mount("/figures", StaticFiles(directory=FIGURE_DIR), name="figures")

    async def start():
        app.state.progress = 0
        with engine.begin() as conn:
            try:
                conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS citext;")
                conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
                conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector;")
            except Exception:
                pass
        Base.metadata.create_all(bind=engine)        

        print("service is started.")

    def shutdown():
        print("service is stopped.")

    return app