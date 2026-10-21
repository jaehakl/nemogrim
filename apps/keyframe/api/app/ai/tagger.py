"""SmilingWolf WD14 EVA02-Large tagger v3 (timm + torch).

전처리와 태그 선택은 SmilingWolf의 wdv3_timm 레퍼런스 구현을 따른다.
`load_labels`, `preprocess_image`, `select_tags`는 torch 없이 테스트할 수 있는 순수 함수다.
"""

from __future__ import annotations

import csv
import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .types import WD14_MODEL_REPO, TagResult


GENERAL_CATEGORY = 0
CHARACTER_CATEGORY = 4
DEFAULT_IMAGE_SIZE = 448
DEFAULT_MEAN = (0.5, 0.5, 0.5)
DEFAULT_STD = (0.5, 0.5, 0.5)

# 밑줄이 의미의 일부인 태그. 공백으로 바꾸지 않는다.
KAOMOJIS = frozenset({
    "0_0", "(o)_(o)", "+_+", "+_-", "._.", "<o>_<o>", "<|>_<|>", "=_=", ">_<",
    "3_3", "6_9", ">_o", "@_@", "^_^", "o_o", "u_u", "x_x", "|_|", "||_||",
})


@dataclass(frozen=True, slots=True)
class TagLabels:
    names: list[str]
    general: np.ndarray
    character: np.ndarray


@dataclass(frozen=True, slots=True)
class TagThresholds:
    general: float = 0.35
    character: float = 0.85
    max_tags: int = 64


def load_labels(csv_path: Path) -> TagLabels:
    names: list[str] = []
    general: list[int] = []
    character: list[int] = []
    with csv_path.open(newline="", encoding="utf-8") as file:
        for index, row in enumerate(csv.DictReader(file)):
            names.append(row["name"])
            category = int(row["category"])
            if category == GENERAL_CATEGORY:
                general.append(index)
            elif category == CHARACTER_CATEGORY:
                character.append(index)
    return TagLabels(
        names=names,
        general=np.asarray(general, dtype=np.int64),
        character=np.asarray(character, dtype=np.int64),
    )


def format_tag(name: str) -> str:
    return name if name in KAOMOJIS else name.replace("_", " ")


def preprocess_image(
    image: Image.Image,
    size: int = DEFAULT_IMAGE_SIZE,
    mean: Sequence[float] = DEFAULT_MEAN,
    std: Sequence[float] = DEFAULT_STD,
) -> np.ndarray:
    """흰 배경 합성 → 흰색 정사각형 패딩 → bicubic 리사이즈 → 정규화 → BGR NCHW (1,3,size,size)."""
    rgba = image.convert("RGBA")
    flattened = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    flattened.alpha_composite(rgba)
    rgb = flattened.convert("RGB")

    side = max(rgb.size)
    square = Image.new("RGB", (side, side), (255, 255, 255))
    square.paste(rgb, ((side - rgb.width) // 2, (side - rgb.height) // 2))
    resized = square.resize((size, size), Image.Resampling.BICUBIC)

    pixels = np.asarray(resized, dtype=np.float32) / 255.0
    pixels = (pixels - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    bgr = pixels[:, :, ::-1]
    return np.ascontiguousarray(bgr.transpose(2, 0, 1)[np.newaxis])


def select_tags(probs: np.ndarray, labels: TagLabels, thresholds: TagThresholds) -> TagResult:
    """character 태그를 먼저, general 태그를 나중에 각각 신뢰도 내림차순으로 고른다. rating은 제외한다."""
    scores = np.asarray(probs, dtype=np.float32).reshape(-1)
    if scores.shape[0] != len(labels.names):
        raise ValueError(
            f"태그 개수({len(labels.names)})와 모델 출력 크기({scores.shape[0]})가 다릅니다"
        )

    selected: list[str] = []
    for indices, threshold in (
        (labels.character, thresholds.character),
        (labels.general, thresholds.general),
    ):
        picked = [int(index) for index in indices if scores[index] >= threshold]
        picked.sort(key=lambda index: (-scores[index], labels.names[index]))
        selected.extend(format_tag(labels.names[index]) for index in picked)

    keywords = list(dict.fromkeys(selected))[: thresholds.max_tags]
    return TagResult(prompt=", ".join(keywords), keywords=keywords)


class Wd14Tagger:
    def __init__(
        self,
        model: Any,
        labels: TagLabels,
        device: str,
        thresholds: TagThresholds,
        *,
        size: int = DEFAULT_IMAGE_SIZE,
        mean: Sequence[float] = DEFAULT_MEAN,
        std: Sequence[float] = DEFAULT_STD,
    ) -> None:
        self._model = model
        self._labels = labels
        self._device = device
        self._thresholds = thresholds
        self._size = size
        self._mean = tuple(mean)
        self._std = tuple(std)

    def tag(self, image: Image.Image) -> TagResult:
        import torch

        batch = torch.from_numpy(
            preprocess_image(image, self._size, self._mean, self._std)
        ).to(self._device)
        with torch.inference_mode():
            logits = self._model(batch)
        probs = torch.sigmoid(logits)[0].float().cpu().numpy()
        return select_tags(probs, self._labels, self._thresholds)


def load_wd14_tagger(device: str, cache_dir: Path, thresholds: TagThresholds) -> Wd14Tagger:
    import timm
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file

    def fetch(filename: str) -> Path:
        return Path(hf_hub_download(WD14_MODEL_REPO, filename, cache_dir=str(cache_dir)))

    config = json.loads(fetch("config.json").read_text(encoding="utf-8"))
    labels = load_labels(fetch("selected_tags.csv"))
    if config["num_classes"] != len(labels.names):
        raise RuntimeError("WD14 태그 목록과 모델 출력 크기가 일치하지 않습니다")

    model_args = dict(config.get("model_args", {}))
    if "global_pool" in config:
        model_args.setdefault("global_pool", config["global_pool"])
    model = timm.create_model(
        config["architecture"],
        pretrained=False,
        num_classes=config["num_classes"],
        **model_args,
    )
    model.load_state_dict(load_file(str(fetch("model.safetensors"))), strict=True)
    model.eval().to(device)

    pretrained_cfg = config.get("pretrained_cfg", {})
    return Wd14Tagger(
        model,
        labels,
        device,
        thresholds,
        size=int(pretrained_cfg.get("input_size", (3, DEFAULT_IMAGE_SIZE))[-1]),
        mean=pretrained_cfg.get("mean", DEFAULT_MEAN),
        std=pretrained_cfg.get("std", DEFAULT_STD),
    )
