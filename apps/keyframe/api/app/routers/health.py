from fastapi import APIRouter
from sqlalchemy import text

from ..ai.runtime import get_ai_runtime
from ..db import new_session
from ..errors import AiUnavailableError
from ..schemas import AiStatusOut, HealthOut
from ..services.ffmpeg import ffmpeg_status


router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    database_ok = True
    try:
        with new_session() as database:
            database.execute(text("SELECT 1"))
    except Exception:
        database_ok = False

    try:
        ai = AiStatusOut.build(get_ai_runtime().status())
    except AiUnavailableError:
        ai = None

    tools = ffmpeg_status()
    healthy = database_ok and all(tools.values()) and ai is not None and ai.state != "error"
    return HealthOut(
        status="ok" if healthy else "degraded",
        database_ok=database_ok,
        ai=ai,
        **tools,
    )
