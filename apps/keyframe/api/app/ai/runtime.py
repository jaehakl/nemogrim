"""프로세스 내장 로컬 AI 런타임.

모든 torch 작업은 `keyframe-ai` 단일 워커 스레드에서 실행된다. 그래서 GPU 사용이 직렬화되고
모델은 처음 필요할 때 한 번만 로드된다. torch/open_clip/timm은 워커 스레드에서만 import하므로
앱 기동과 테스트는 무거운 라이브러리를 불러오지 않는다.
"""

from __future__ import annotations

import concurrent.futures
import io
import sys
import threading
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Any, TypeVar

import numpy as np
from PIL import Image, UnidentifiedImageError

from ..errors import AiInferenceError, AiUnavailableError, InvalidRequestError, KeyframeError
from ..settings import KeyframeSettings
from .clip import load_clip_encoder
from .device import DeviceInfo, configure_hub_environment, resolve_device
from .tagger import TagThresholds, load_wd14_tagger
from .types import (
    CLIP_MODEL_NAME,
    MAX_SNAPSHOT_BYTES,
    WD14_MODEL_REPO,
    AiStatus,
    ClipBackend,
    ModelState,
    ModelStatus,
    SceneAnalysis,
    TaggerBackend,
    pack_embedding,
)


T = TypeVar("T")
ClipLoader = Callable[[str, Path], ClipBackend]
TaggerLoader = Callable[[str, Path], TaggerBackend]
DeviceResolver = Callable[[str], DeviceInfo]

MODEL_NAMES = {"clip": CLIP_MODEL_NAME, "tagger": WD14_MODEL_REPO}


class AiRuntime:
    def __init__(
        self,
        settings: KeyframeSettings,
        *,
        clip_loader: ClipLoader | None = None,
        tagger_loader: TaggerLoader | None = None,
        device_resolver: DeviceResolver = resolve_device,
    ) -> None:
        thresholds = TagThresholds(
            general=settings.wd14_general_threshold,
            character=settings.wd14_character_threshold,
            max_tags=settings.wd14_max_tags,
        )
        self._settings = settings
        self._loaders: dict[str, Callable[[str, Path], Any]] = {
            "clip": clip_loader or load_clip_encoder,
            "tagger": tagger_loader
            or (lambda device, cache_dir: load_wd14_tagger(device, cache_dir, thresholds)),
        }
        self._device_resolver = device_resolver
        self._lock = threading.Lock()
        self._executor: ThreadPoolExecutor | None = None
        self._device: DeviceInfo | None = None
        self._device_error: str | None = None
        self._models: dict[str, Any] = {}
        self._states = {
            key: ModelStatus(name, ModelState.NOT_LOADED) for key, name in MODEL_NAMES.items()
        }

    @property
    def request_timeout(self) -> float:
        return self._settings.ai_request_timeout_seconds

    # 수명 주기 ---------------------------------------------------------------

    def start(self) -> None:
        """워커를 띄우고 장치만 확인한다. 모델은 로드하지 않으며 예외를 던지지 않는다."""
        with self._lock:
            if self._executor is not None:
                raise RuntimeError("AI 런타임이 이미 시작되었습니다")
            self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="keyframe-ai")
        configure_hub_environment(self._settings.ai_offline)
        self._submit_background(self._ensure_device)
        if self._settings.ai_warmup:
            self.warmup()

    def shutdown(self) -> None:
        with self._lock:
            executor, self._executor = self._executor, None
        if executor is None:
            return
        executor.shutdown(wait=True, cancel_futures=True)
        self._models.clear()
        torch = sys.modules.get("torch")
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()

    def warmup(self) -> None:
        """두 모델을 백그라운드에서 미리 로드한다. 기다리지 않는다."""
        for key in MODEL_NAMES:
            self._submit_background(lambda key=key: self._ensure_model(key))

    # 상태 ------------------------------------------------------------------

    def status(self) -> AiStatus:
        with self._lock:
            models = dict(self._states)
            device = self._device
            device_error = self._device_error
        states = [model.state for model in models.values()]
        if device_error or ModelState.ERROR in states:
            overall = ModelState.ERROR
        elif ModelState.LOADING in states:
            overall = ModelState.LOADING
        elif all(state == ModelState.READY for state in states):
            overall = ModelState.READY
        else:
            overall = ModelState.NOT_LOADED
        return AiStatus(
            state=overall,
            requested_device=self._settings.ai_device,
            device=device.device if device else None,
            device_name=device.name if device else None,
            note=device_error or (device.note if device else None),
            models=models,
        )

    # 추론 ------------------------------------------------------------------

    def analyze_image(self, image_path: Path, timeout: float | None = None) -> SceneAnalysis:
        image_data = image_path.read_bytes()
        if not image_data:
            raise InvalidRequestError("Scene snapshot이 비어 있습니다")
        if len(image_data) > MAX_SNAPSHOT_BYTES:
            raise InvalidRequestError("Scene snapshot은 20 MiB를 초과할 수 없습니다")
        return self._run(lambda: self._analyze(image_data), timeout)

    def embed_text(self, text: str, timeout: float | None = None) -> np.ndarray:
        """정규화된 CLIP 텍스트 임베딩. 기본 대기 시간은 요청 경로용 `request_timeout`이다."""
        if not text.strip():
            raise InvalidRequestError("검색어가 비어 있습니다")
        wait = self.request_timeout if timeout is None else timeout
        return self._run(lambda: self._ensure_model("clip").embed_text(text), wait)

    # 워커 스레드 전용 ------------------------------------------------------

    def _analyze(self, image_data: bytes) -> SceneAnalysis:
        clip: ClipBackend = self._ensure_model("clip")
        tagger: TaggerBackend = self._ensure_model("tagger")
        try:
            with Image.open(io.BytesIO(image_data)) as image:
                image.load()
                embedding = clip.embed_image(image)
                tags = tagger.tag(image)
        except UnidentifiedImageError as error:
            raise InvalidRequestError("Scene snapshot 이미지를 읽을 수 없습니다") from error
        return SceneAnalysis(
            embedding=pack_embedding(embedding),
            prompt=tags.prompt,
            keywords=list(tags.keywords),
        )

    def _ensure_device(self) -> DeviceInfo:
        if self._device is not None:
            return self._device
        try:
            device = self._device_resolver(self._settings.ai_device)
        except Exception as error:
            message = f"AI 실행 장치를 확인하지 못했습니다: {error}"
            with self._lock:
                self._device_error = message
            raise AiUnavailableError(message) from error
        with self._lock:
            self._device = device
            self._device_error = None
        return device

    def _ensure_model(self, key: str) -> Any:
        model = self._models.get(key)
        if model is not None:
            return model
        device = self._ensure_device()
        self._set_state(key, ModelState.LOADING)
        try:
            model = self._loaders[key](device.device, self._settings.ai_model_cache_dir)
        except Exception as error:
            message = f"{MODEL_NAMES[key]} 모델을 불러오지 못했습니다: {error}"
            self._set_state(key, ModelState.ERROR, message)
            raise AiUnavailableError(message) from error
        self._models[key] = model
        self._set_state(key, ModelState.READY)
        return model

    def _set_state(self, key: str, state: ModelState, error: str | None = None) -> None:
        with self._lock:
            self._states[key] = ModelStatus(MODEL_NAMES[key], state, error)

    # 제출 ------------------------------------------------------------------

    def _submit(self, function: Callable[[], T]) -> Future[T]:
        with self._lock:
            executor = self._executor
        if executor is None:
            raise AiUnavailableError("AI 런타임이 시작되지 않았습니다")
        try:
            return executor.submit(function)
        except RuntimeError as error:
            raise AiUnavailableError("AI 런타임이 종료되었습니다") from error

    def _submit_background(self, function: Callable[[], object]) -> None:
        def run_quietly() -> None:
            try:
                function()
            except Exception:
                pass  # 실패는 상태(status)에 기록되어 있다.

        self._submit(run_quietly)

    def _run(self, function: Callable[[], T], timeout: float | None) -> T:
        future = self._submit(function)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError as error:
            future.cancel()
            raise AiUnavailableError(
                "AI 모델을 준비하는 중이거나 다른 분석을 처리하고 있습니다. 잠시 후 다시 시도하세요"
            ) from error
        except KeyframeError:
            raise
        except Exception as error:
            raise AiInferenceError(f"AI 추론에 실패했습니다: {error}") from error


_runtime_lock = threading.Lock()
_runtime: AiRuntime | None = None


def set_ai_runtime(runtime: AiRuntime | None) -> None:
    global _runtime
    with _runtime_lock:
        _runtime = runtime


def get_ai_runtime() -> AiRuntime:
    with _runtime_lock:
        runtime = _runtime
    if runtime is None:
        raise AiUnavailableError("AI 런타임이 시작되지 않았습니다")
    return runtime
