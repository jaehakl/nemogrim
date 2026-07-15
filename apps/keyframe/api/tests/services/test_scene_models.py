import math
import struct

import pytest
import torch
from PIL import Image

from app.services import scene_models


def test_clip_embedding_is_768_float32_values_and_l2_normalized(tmp_path, monkeypatch):
    image_path = tmp_path / "snapshot.webp"
    Image.new("RGB", (8, 8), "white").save(image_path)

    class Model:
        def encode_image(self, _image):
            return torch.arange(1, 769, dtype=torch.float32).unsqueeze(0)

    monkeypatch.setattr(
        scene_models,
        "_load_clip",
        lambda: (Model(), lambda _image: torch.zeros(3, 8, 8), "cpu", torch, Image),
    )
    embedding = scene_models.extract_clip_embedding(image_path)
    values = struct.unpack("<768f", embedding)
    assert len(embedding) == 768 * 4
    assert math.sqrt(sum(value * value for value in values)) == pytest.approx(1.0, abs=1e-5)


def test_wd14_thresholds_sort_confidence_and_exclude_rating(tmp_path, monkeypatch):
    image_path = tmp_path / "snapshot.webp"
    Image.new("RGB", (8, 8), "white").save(image_path)
    labels = [
        ("safe", 9),
        ("blue_sky", 0),
        ("character_name", 4),
        ("low_score", 0),
    ]
    probabilities = torch.tensor([0.99, 0.36, 0.86, 0.20])

    class Model:
        def __call__(self, _image):
            return torch.logit(probabilities).unsqueeze(0)

    monkeypatch.setattr(
        scene_models,
        "_load_wd14",
        lambda: (
            Model(), lambda _image: torch.zeros(3, 8, 8), labels, "cpu", torch, Image
        ),
    )
    prompt, keywords = scene_models.extract_wd14_tags(image_path)
    assert keywords == ["character_name", "blue_sky"]
    assert prompt == "character_name, blue_sky"
