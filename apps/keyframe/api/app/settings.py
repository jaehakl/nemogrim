from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from .paths import DATA_DIR


API_ROOT = Path(__file__).resolve().parents[1]

AiDevice = Literal["auto", "cuda", "cpu"]


class KeyframeSettings(BaseSettings):
    """환경 변수(`KEYFRAME_*`) 또는 api/.env에서 읽는 실행 설정. 필수 값은 없다."""

    model_config = SettingsConfigDict(
        env_prefix="KEYFRAME_",
        env_file=API_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ai_device: AiDevice = "auto"
    ai_model_cache_dir: Path = DATA_DIR / "models"
    ai_warmup: bool = False
    ai_offline: bool = False
    ai_request_timeout_seconds: float = Field(default=180.0, gt=0)
    wd14_general_threshold: float = Field(default=0.35, ge=0, le=1)
    wd14_character_threshold: float = Field(default=0.85, ge=0, le=1)
    wd14_max_tags: int = Field(default=64, ge=1, le=256)
    cors_origins: list[str] = ["http://127.0.0.1:5175", "http://localhost:5175"]
