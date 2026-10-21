"""실제 모델을 로드하는 느린 테스트. 기본 실행에서는 제외된다.

    $env:KEYFRAME_RUN_MODEL_TESTS="1"; poetry run pytest -m models
"""

import os

import numpy as np
import pytest
from PIL import Image

from app.ai.runtime import AiRuntime
from app.ai.types import unpack_embedding
from app.settings import KeyframeSettings


pytestmark = [
    pytest.mark.models,
    pytest.mark.skipif(
        os.environ.get("KEYFRAME_RUN_MODEL_TESTS") != "1",
        reason="KEYFRAME_RUN_MODEL_TESTS=1 일 때만 실행",
    ),
]


@pytest.fixture(scope="module")
def runtime():
    instance = AiRuntime(KeyframeSettings())
    instance.start()
    yield instance
    instance.shutdown()


def test_real_models_embed_and_tag(runtime, tmp_path):
    path = tmp_path / "red.webp"
    Image.new("RGB", (448, 448), (220, 20, 20)).save(path, "WEBP")

    analysis = runtime.analyze_image(path)
    image_vector = unpack_embedding(analysis.embedding)

    assert image_vector is not None
    assert np.linalg.norm(image_vector) == pytest.approx(1.0, abs=1e-3)
    assert isinstance(analysis.keywords, list)
    red = float(runtime.embed_text("a plain red square") @ image_vector)
    sky = float(runtime.embed_text("a photo of a blue sky with clouds") @ image_vector)
    assert red > sky
    assert runtime.status().state == "ready"
