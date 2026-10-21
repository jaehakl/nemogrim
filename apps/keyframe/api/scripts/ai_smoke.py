"""실제 로컬 AI 모델을 로드해 동작을 확인한다. 처음 실행하면 모델(약 3GB)을 미리 내려받는다.

    poetry run python scripts/ai_smoke.py [--image PATH] [--device auto|cuda|cpu]
"""

from __future__ import annotations

import argparse
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.ai.runtime import AiRuntime  # noqa: E402
from app.ai.types import unpack_embedding  # noqa: E402
from app.settings import KeyframeSettings  # noqa: E402


def make_sample_image(directory: Path) -> Path:
    """위는 하늘색, 아래는 빨간색인 단순한 테스트 이미지."""
    image = Image.new("RGB", (640, 360), (110, 170, 235))
    image.paste((210, 30, 30), (0, 180, 640, 360))
    path = directory / "sample.webp"
    image.save(path, "WEBP")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--image", type=Path, help="분석할 이미지 (기본: 합성 테스트 이미지)")
    parser.add_argument("--device", choices=["auto", "cuda", "cpu"], help="KEYFRAME_AI_DEVICE 대신 사용할 장치")
    arguments = parser.parse_args()

    overrides = {"ai_device": arguments.device} if arguments.device else {}
    settings = KeyframeSettings(**overrides)
    runtime = AiRuntime(settings)
    runtime.start()
    try:
        with tempfile.TemporaryDirectory() as temporary:
            image_path = arguments.image or make_sample_image(Path(temporary))
            print(f"모델 캐시: {settings.ai_model_cache_dir}")

            started = time.perf_counter()
            analysis = runtime.analyze_image(image_path)
            elapsed = time.perf_counter() - started
            status = runtime.status()
            print(f"장치: {status.device} ({status.device_name}) {status.note or ''}".rstrip())
            print(f"모델 로드 + 첫 분석: {elapsed:.1f}s")

            started = time.perf_counter()
            runtime.analyze_image(image_path)
            print(f"두 번째 분석: {time.perf_counter() - started:.2f}s")

            image_vector = unpack_embedding(analysis.embedding)
            assert image_vector is not None
            print(f"임베딩: {image_vector.shape[0]}차원, norm={np.linalg.norm(image_vector):.4f}")
            print(f"태그 {len(analysis.keywords)}개: {', '.join(analysis.keywords[:15])}")

            for text in ("a red and blue picture", "a photo of a cat", "a city street at night"):
                score = float(runtime.embed_text(text) @ image_vector)
                print(f"  cos(이미지, {text!r}) = {score:.4f}")
    finally:
        runtime.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
