from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from ..services.image_generation import generate_movie_images
from ..services.image_query import get_image_page, image_file
from ..services.scene_models import (
    IMAGE_PROMPT_MAX_BYTES,
    SdxlGenerationSettings,
    get_sdxl_models,
)


MAX_SEED = 2_147_483_647
router = APIRouter(prefix="/api")


class ImageGenerationRequest(BaseModel):
    timestamp_ms: int = Field(ge=0)
    model: str = Field(min_length=1, max_length=255)
    count: int = Field(default=1, ge=1, le=8)
    negative_prompt: str = ""
    seed: int | None = Field(default=None, ge=0, le=MAX_SEED)
    step: int = Field(default=30, ge=1, le=150)
    cfg: float = Field(default=7.0, ge=0.0, le=30.0)
    strength: float = Field(default=1.0, ge=0.0, le=1.0)
    width: int = Field(default=1024, ge=64, le=2048)
    height: int = Field(default=1024, ge=64, le=2048)
    format: Literal["png", "jpg"] = "png"

    @field_validator("model")
    @classmethod
    def normalize_model(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("model must not be blank")
        return normalized

    @field_validator("negative_prompt")
    @classmethod
    def validate_negative_prompt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > IMAGE_PROMPT_MAX_BYTES:
            raise ValueError(
                f"negative_prompt must not exceed {IMAGE_PROMPT_MAX_BYTES} bytes"
            )
        return value

    @field_validator("width", "height")
    @classmethod
    def validate_dimension(cls, value: int) -> int:
        if value % 8:
            raise ValueError("width and height must be multiples of 8")
        return value

    @model_validator(mode="after")
    def validate_seed_range(self) -> "ImageGenerationRequest":
        if self.seed is not None and self.seed + self.count - 1 > MAX_SEED:
            raise ValueError("seed range exceeds the maximum supported value")
        return self


@router.get("/images")
def list_images(
    limit: int = Query(default=24, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
) -> dict:
    return get_image_page(limit, before_id)


@router.get("/images/models")
def list_sdxl_models() -> dict:
    try:
        payload = get_sdxl_models()
    except Exception as error:
        message = str(error) or error.__class__.__name__
        raise HTTPException(
            status_code=503,
            detail=f"SDXL 모델 목록을 불러오지 못했습니다: {message}",
        ) from error
    return {
        "default_model": payload.default_model,
        "models": [
            {
                **model.model_dump(exclude={"format"}),
                "format": "jpg" if model.format == "jpeg" else model.format,
            }
            for model in payload.models
        ],
    }


@router.get("/images/{image_id}/file")
def get_image_file(image_id: int) -> FileResponse:
    try:
        path = image_file(image_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    media_type = "image/jpeg" if path.suffix.lower() == ".jpg" else "image/png"
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "no-cache"},
    )


@router.post("/movies/{movie_id}/images", status_code=201)
def create_images(movie_id: int, payload: ImageGenerationRequest) -> dict:
    seeds = (
        [payload.seed + index for index in range(payload.count)]
        if payload.seed is not None
        else None
    )
    settings = SdxlGenerationSettings(
        model=payload.model,
        count=payload.count,
        negative_prompt=payload.negative_prompt,
        seeds=seeds,
        step=payload.step,
        cfg=payload.cfg,
        strength=payload.strength,
        width=payload.width,
        height=payload.height,
        format=payload.format,
    )
    try:
        return {
            "items": generate_movie_images(movie_id, payload.timestamp_ms, settings)
        }
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RuntimeError, TimeoutError) as error:
        message = str(error) or error.__class__.__name__
        raise HTTPException(
            status_code=503,
            detail=f"이미지 생성에 실패했습니다: {message}",
        ) from error
