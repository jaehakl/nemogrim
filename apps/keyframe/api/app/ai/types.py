from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Protocol

import numpy as np


if TYPE_CHECKING:
    from PIL import Image


CLIP_MODEL_NAME = "OpenAI CLIP ViT-L/14"
CLIP_DIMENSIONS = 768
EMBEDDING_BYTES = CLIP_DIMENSIONS * 4
WD14_MODEL_REPO = "SmilingWolf/wd-eva02-large-tagger-v3"
MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class TagResult:
    prompt: str
    keywords: list[str]


@dataclass(frozen=True, slots=True)
class SceneAnalysis:
    embedding: bytes
    prompt: str
    keywords: list[str]


class ModelState(StrEnum):
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    READY = "ready"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class ModelStatus:
    name: str
    state: ModelState
    error: str | None = None


@dataclass(frozen=True, slots=True)
class AiStatus:
    state: ModelState
    requested_device: str
    device: str | None
    device_name: str | None
    note: str | None
    models: dict[str, ModelStatus]


class ClipBackend(Protocol):
    def embed_image(self, image: Image.Image) -> np.ndarray: ...

    def embed_text(self, text: str) -> np.ndarray: ...


class TaggerBackend(Protocol):
    def tag(self, image: Image.Image) -> TagResult: ...


def normalize_vector(vector: np.ndarray) -> np.ndarray:
    values = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(values))
    if not np.isfinite(norm) or norm == 0.0:
        raise ValueError("임베딩 벡터를 정규화할 수 없습니다")
    return values / norm


def pack_embedding(vector: np.ndarray) -> bytes:
    values = np.asarray(vector, dtype="<f4")
    if values.shape != (CLIP_DIMENSIONS,):
        raise ValueError(f"임베딩은 {CLIP_DIMENSIONS}차원이어야 합니다: {values.shape}")
    if not np.all(np.isfinite(values)):
        raise ValueError("임베딩 값은 유한한 숫자여야 합니다")
    return values.tobytes()


def unpack_embedding(blob: bytes | None) -> np.ndarray | None:
    if blob is None or len(blob) != EMBEDDING_BYTES:
        return None
    return np.frombuffer(blob, dtype="<f4").astype(np.float32)
