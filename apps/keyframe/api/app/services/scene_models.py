from __future__ import annotations

import asyncio
import concurrent.futures
import math
import struct
import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Protocol

from gpstation_master import GpStationClient, RequestAttachment
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from ..settings import KeyframeSettings


CLIP_MODEL_NAME = "OpenAI CLIP ViT-L/14"
WD14_MODEL_REPO = "SmilingWolf/wd-eva02-large-tagger-v3"
CLIP_DIMENSIONS = 768
MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024


class ClipHandlerPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    model: Literal["OpenAI CLIP ViT-L/14"]
    embedding: list[float]
    dimensions: Literal[768]

    @field_validator("embedding", mode="before")
    @classmethod
    def validate_embedding(cls, value: object) -> list[float]:
        if not isinstance(value, list) or len(value) != CLIP_DIMENSIONS:
            raise ValueError("embedding must contain exactly 768 values")
        if any(type(item) not in {int, float} for item in value):
            raise ValueError("embedding values must be numbers")
        converted = [float(item) for item in value]
        if not all(math.isfinite(item) for item in converted):
            raise ValueError("embedding values must be finite")
        return converted


class Wd14HandlerPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    model: Literal["SmilingWolf/wd-eva02-large-tagger-v3"]
    prompt: str
    keywords: list[str]


@dataclass(frozen=True, slots=True)
class SceneAnalysis:
    embedding: bytes
    prompt: str
    keywords: list[str]


class _JobSession(Protocol):
    async def call(
        self,
        handler_type: str,
        input: Any = None,
        *,
        timeout_seconds: float | None = None,
        attachments: tuple[RequestAttachment, ...] = (),
    ) -> Any: ...

    async def finish(self, *, timeout_seconds: float | None = None) -> None: ...

    async def close(self) -> None: ...


class GpStationAiRuntime:
    def __init__(
        self,
        api_base_url: str,
        client_token: str,
        job_timeout_seconds: float = 600.0,
        *,
        client_factory: Callable[..., GpStationClient] | None = None,
        bridge_timeout_seconds: float | None = None,
    ) -> None:
        if job_timeout_seconds <= 0:
            raise ValueError("job_timeout_seconds must be greater than zero")
        if bridge_timeout_seconds is not None and bridge_timeout_seconds <= 0:
            raise ValueError("bridge_timeout_seconds must be greater than zero")
        self._api_base_url = api_base_url
        self._client_token = client_token
        self._job_timeout_seconds = job_timeout_seconds
        self._client_factory = client_factory or GpStationClient
        self._bridge_timeout_seconds = (
            bridge_timeout_seconds
            if bridge_timeout_seconds is not None
            else job_timeout_seconds * 8 + 30
        )
        self._ready = threading.Event()
        self._state_lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stop_event: asyncio.Event | None = None
        self._client: GpStationClient | None = None
        self._request_lock: asyncio.Lock | None = None
        self._startup_error: BaseException | None = None
        self._runtime_error: BaseException | None = None

    def start(self) -> None:
        with self._state_lock:
            if self._thread is not None:
                raise RuntimeError("GP Station AI runtime이 이미 시작되었습니다")
            self._thread = threading.Thread(
                target=self._thread_main,
                name="keyframe-gpstation",
                daemon=False,
            )
            thread = self._thread
            thread.start()

        self._ready.wait()
        if self._startup_error is not None:
            thread.join()
            raise RuntimeError(
                f"GP Station 연결 검증에 실패했습니다: {self._startup_error}"
            ) from self._startup_error

    def stop(self) -> None:
        with self._state_lock:
            thread = self._thread
            loop = self._loop
            stop_event = self._stop_event
        if thread is None:
            return
        if loop is not None and stop_event is not None and thread.is_alive():
            loop.call_soon_threadsafe(stop_event.set)
        thread.join()
        with self._state_lock:
            self._thread = None
            self._loop = None
            self._stop_event = None
            self._client = None
            self._request_lock = None

    def analyze_image(self, image_path: Path) -> SceneAnalysis:
        image_data = image_path.read_bytes()
        if not image_data:
            raise ValueError("Scene snapshot이 비어 있습니다")
        if len(image_data) > MAX_SNAPSHOT_BYTES:
            raise ValueError("Scene snapshot은 20 MiB를 초과할 수 없습니다")
        return self._submit(self._analyze_image(image_data), "Scene AI 분석")

    def embed_text(self, text: str) -> bytes:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("CLIP 검색어가 비어 있습니다")
        return self._submit(self._embed_text(text), "CLIP 텍스트 분석")

    def _thread_main(self) -> None:
        try:
            asyncio.run(self._serve())
        except BaseException as error:
            with self._state_lock:
                if not self._ready.is_set():
                    self._startup_error = error
                else:
                    self._runtime_error = error
            self._ready.set()

    async def _serve(self) -> None:
        client = self._client_factory(
            self._api_base_url,
            self._client_token,
            auth_mode="bearer",
            job_api_prefix="/v1/jobs",
        )
        try:
            loop = asyncio.get_running_loop()
            stop_event = asyncio.Event()
            request_lock = asyncio.Lock()
            await client.list_launchers()
            with self._state_lock:
                self._loop = loop
                self._stop_event = stop_event
                self._client = client
                self._request_lock = request_lock
            self._ready.set()
            await stop_event.wait()
        finally:
            await client.close()

    def _submit(self, coroutine, operation: str):
        with self._state_lock:
            loop = self._loop
            thread = self._thread
            runtime_error = self._runtime_error
        if runtime_error is not None:
            coroutine.close()
            raise RuntimeError(
                f"GP Station AI runtime이 중단되었습니다: {runtime_error}"
            ) from runtime_error
        if loop is None or thread is None or not thread.is_alive():
            coroutine.close()
            raise RuntimeError("GP Station AI runtime이 시작되지 않았습니다")

        future = asyncio.run_coroutine_threadsafe(coroutine, loop)
        try:
            return future.result(timeout=self._bridge_timeout_seconds)
        except concurrent.futures.TimeoutError as error:
            future.cancel()
            raise TimeoutError(f"{operation} 시간이 초과되었습니다") from error

    async def _analyze_image(self, image_data: bytes) -> SceneAnalysis:
        client = self._client
        request_lock = self._request_lock
        if client is None or request_lock is None:
            raise RuntimeError("GP Station AI runtime이 준비되지 않았습니다")

        attachment = RequestAttachment(
            id="image",
            data=image_data,
            name="scene.webp",
            mime_type="image/webp",
        )
        async with request_lock:
            session: _JobSession | None = None
            try:
                clip_result = await client.run_job(
                    "ai.clip.image",
                    {},
                    slave_app_id="ai",
                    timeout_seconds=self._job_timeout_seconds,
                    auto_finish=False,
                    attachments=(attachment,),
                )
                session = clip_result.session
                if not isinstance(clip_result.files, list) or clip_result.files:
                    raise RuntimeError(
                        "ai.clip.image 응답에는 attachment가 없어야 합니다"
                    )
                try:
                    clip_payload = ClipHandlerPayload.model_validate(clip_result.payload)
                except ValidationError as error:
                    details = error.errors(include_url=False, include_input=False)
                    raise RuntimeError(
                        f"ai.clip.image 응답 payload가 올바르지 않습니다: {details}"
                    ) from error

                wd14_result = await session.call(
                    "ai.wd14.tags",
                    {},
                    timeout_seconds=self._job_timeout_seconds,
                    attachments=(attachment,),
                )
                if not isinstance(wd14_result.files, list) or wd14_result.files:
                    raise RuntimeError(
                        "ai.wd14.tags 응답에는 attachment가 없어야 합니다"
                    )
                try:
                    wd14_payload = Wd14HandlerPayload.model_validate(wd14_result.payload)
                except ValidationError as error:
                    details = error.errors(include_url=False, include_input=False)
                    raise RuntimeError(
                        f"ai.wd14.tags 응답 payload가 올바르지 않습니다: {details}"
                    ) from error

                await session.finish(timeout_seconds=self._job_timeout_seconds)
                session = None
                return SceneAnalysis(
                    embedding=struct.pack(
                        f"<{CLIP_DIMENSIONS}f", *clip_payload.embedding
                    ),
                    prompt=wd14_payload.prompt,
                    keywords=list(wd14_payload.keywords),
                )
            except BaseException:
                if session is not None:
                    try:
                        await session.close()
                    except Exception:
                        pass
                raise

    async def _embed_text(self, text: str) -> bytes:
        client = self._client
        request_lock = self._request_lock
        if client is None or request_lock is None:
            raise RuntimeError("GP Station AI runtime이 준비되지 않았습니다")

        async with request_lock:
            result = await client.run_job(
                "ai.clip.text",
                {"text": text},
                slave_app_id="ai",
                timeout_seconds=self._job_timeout_seconds,
                auto_finish=True,
                attachments=(),
            )
            if not isinstance(result.files, list) or result.files:
                raise RuntimeError("ai.clip.text 응답에는 attachment가 없어야 합니다")
            try:
                payload = ClipHandlerPayload.model_validate(result.payload)
            except ValidationError as error:
                details = error.errors(include_url=False, include_input=False)
                raise RuntimeError(
                    f"ai.clip.text 응답 payload가 올바르지 않습니다: {details}"
                ) from error
            return struct.pack(f"<{CLIP_DIMENSIONS}f", *payload.embedding)


_runtime_lock = threading.Lock()
_runtime: GpStationAiRuntime | None = None


def start_scene_model_runtime(settings: KeyframeSettings) -> None:
    global _runtime
    runtime = GpStationAiRuntime(
        str(settings.gpstation_api_base_url),
        settings.gpstation_client_token.get_secret_value(),
        settings.gpstation_job_timeout_seconds,
    )
    runtime.start()
    with _runtime_lock:
        if _runtime is not None:
            runtime.stop()
            raise RuntimeError("GP Station AI runtime이 이미 등록되었습니다")
        _runtime = runtime


def stop_scene_model_runtime() -> None:
    global _runtime
    with _runtime_lock:
        runtime = _runtime
        _runtime = None
    if runtime is not None:
        runtime.stop()


def analyze_scene(image_path: Path) -> SceneAnalysis:
    with _runtime_lock:
        runtime = _runtime
    if runtime is None:
        raise RuntimeError("GP Station AI runtime이 시작되지 않았습니다")
    return runtime.analyze_image(image_path)


def extract_clip_text_embedding(text: str) -> bytes:
    with _runtime_lock:
        runtime = _runtime
    if runtime is None:
        raise RuntimeError("GP Station AI runtime이 시작되지 않았습니다")
    return runtime.embed_text(text)
