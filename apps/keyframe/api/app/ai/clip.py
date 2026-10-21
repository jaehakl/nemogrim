"""OpenAI CLIP ViT-L/14 이미지/텍스트 임베딩 (open_clip)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .types import normalize_vector


OPEN_CLIP_ARCHITECTURE = "ViT-L-14"
OPEN_CLIP_PRETRAINED = "openai"


class ClipEncoder:
    def __init__(self, model: Any, preprocess: Any, tokenizer: Any, device: str) -> None:
        self._model = model
        self._preprocess = preprocess
        self._tokenizer = tokenizer
        self._device = device

    def embed_image(self, image: Image.Image) -> np.ndarray:
        import torch

        batch = self._preprocess(image.convert("RGB")).unsqueeze(0).to(self._device)
        with torch.inference_mode():
            features = self._model.encode_image(batch)
        return normalize_vector(features[0].float().cpu().numpy())

    def embed_text(self, text: str) -> np.ndarray:
        import torch

        tokens = self._tokenizer([text]).to(self._device)
        with torch.inference_mode():
            features = self._model.encode_text(tokens)
        return normalize_vector(features[0].float().cpu().numpy())


def load_clip_encoder(device: str, cache_dir: Path) -> ClipEncoder:
    import open_clip

    # OpenAI 원본 가중치는 QuickGELU로 학습되었다. open_clip 3.x는 이를 자동으로 켜지 않는다.
    model, _, preprocess = open_clip.create_model_and_transforms(
        OPEN_CLIP_ARCHITECTURE,
        pretrained=OPEN_CLIP_PRETRAINED,
        force_quick_gelu=True,
        device=device,
        cache_dir=str(cache_dir),
    )
    model.eval()
    tokenizer = open_clip.get_tokenizer(OPEN_CLIP_ARCHITECTURE)
    return ClipEncoder(model, preprocess, tokenizer, device)
