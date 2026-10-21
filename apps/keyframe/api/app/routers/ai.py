from fastapi import APIRouter

from ..ai.runtime import get_ai_runtime
from ..schemas import AiStatusOut


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status", response_model=AiStatusOut)
def ai_status() -> AiStatusOut:
    return AiStatusOut.build(get_ai_runtime().status())


@router.post("/warmup", status_code=202, response_model=AiStatusOut)
def ai_warmup() -> AiStatusOut:
    runtime = get_ai_runtime()
    runtime.warmup()
    return AiStatusOut.build(runtime.status())
