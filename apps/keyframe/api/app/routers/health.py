from fastapi import APIRouter
from sqlalchemy import text

from ..db import SessionLocal
from ..services.media_processing import ffmpeg_status


router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    database_ok = True
    try:
        with SessionLocal() as database:
            database.execute(text("SELECT 1"))
    except Exception:
        database_ok = False
    tools = ffmpeg_status()
    return {
        "status": "ok" if database_ok and all(tools.values()) else "degraded",
        "database_ok": database_ok,
        **tools,
    }
