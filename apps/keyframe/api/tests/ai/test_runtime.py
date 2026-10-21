import struct
import threading

import numpy as np
import pytest
from PIL import Image

from app.ai import runtime as ai_runtime
from app.ai.device import DeviceInfo
from app.ai.runtime import AiRuntime
from app.ai.types import ModelState, TagResult, pack_embedding, unpack_embedding
from app.errors import AiInferenceError, AiUnavailableError, InvalidRequestError
from app.settings import KeyframeSettings
from tests.conftest import axis


class FakeClip:
    def __init__(self, events):
        self.events = events

    def embed_image(self, image):
        self.events.append(("embed_image", threading.current_thread().name, image.size))
        return axis(0)

    def embed_text(self, text):
        self.events.append(("embed_text", threading.current_thread().name, text))
        return axis(1)


class FakeTagger:
    def tag(self, image):
        return TagResult(prompt="blue sky, cloud", keywords=["blue sky", "cloud"])


def make_runtime(events, *, clip_loader=None, tagger_loader=None, device=DeviceInfo("cuda:0", "Fake GPU"), **settings):
    def load_clip(device_name, cache_dir):
        events.append(("load_clip", device_name, threading.current_thread().name))
        return FakeClip(events)

    def load_tagger(device_name, cache_dir):
        events.append(("load_tagger", device_name))
        return FakeTagger()

    return AiRuntime(
        KeyframeSettings(_env_file=None, **settings),
        clip_loader=clip_loader or load_clip,
        tagger_loader=tagger_loader or load_tagger,
        device_resolver=lambda _requested: device,
    )


@pytest.fixture
def snapshot(tmp_path):
    path = tmp_path / "scene.webp"
    Image.new("RGB", (64, 32), (10, 20, 30)).save(path, "WEBP")
    return path


def test_start_resolves_device_without_loading_models():
    events = []
    runtime = make_runtime(events)
    runtime.start()
    try:
        assert runtime.status().state == ModelState.NOT_LOADED
        runtime._run(lambda: None, timeout=5)  # 워커 큐를 비워 장치 확인을 기다린다.
        status = runtime.status()
        assert (status.device, status.device_name) == ("cuda:0", "Fake GPU")
        assert not any(event[0].startswith("load") for event in events)
    finally:
        runtime.shutdown()


def test_embed_text_loads_only_clip_on_worker_thread():
    events = []
    runtime = make_runtime(events)
    runtime.start()
    try:
        vector = runtime.embed_text("blue sky")
        assert np.array_equal(vector, axis(1))
        assert events[0] == ("load_clip", "cuda:0", events[0][2])
        assert events[0][2].startswith("keyframe-ai")
        assert events[1][1].startswith("keyframe-ai")
        status = runtime.status()
        assert status.models["clip"].state == ModelState.READY
        assert status.models["tagger"].state == ModelState.NOT_LOADED
        assert status.state == ModelState.NOT_LOADED

        runtime.embed_text("again")
        assert [event[0] for event in events].count("load_clip") == 1
    finally:
        runtime.shutdown()


def test_analyze_image_returns_packed_embedding_and_tags(snapshot):
    events = []
    runtime = make_runtime(events)
    runtime.start()
    try:
        analysis = runtime.analyze_image(snapshot)
    finally:
        runtime.shutdown()
    assert analysis.embedding == struct.pack("<768f", 1.0, *([0.0] * 767))
    assert analysis.prompt == "blue sky, cloud"
    assert analysis.keywords == ["blue sky", "cloud"]
    assert ("embed_image", events[-1][1], (64, 32)) in events


def test_model_load_failure_is_reported_and_retried(snapshot):
    events = []
    attempts = []

    def flaky_loader(device, cache_dir):
        attempts.append(device)
        if len(attempts) == 1:
            raise OSError("download interrupted")
        return FakeClip(events)

    runtime = make_runtime(events, clip_loader=flaky_loader)
    runtime.start()
    try:
        with pytest.raises(AiUnavailableError, match="download interrupted"):
            runtime.embed_text("blue sky")
        status = runtime.status()
        assert status.state == ModelState.ERROR
        assert "download interrupted" in status.models["clip"].error

        runtime.embed_text("blue sky")
        assert runtime.status().models["clip"].state == ModelState.READY
        assert len(attempts) == 2
    finally:
        runtime.shutdown()


def test_device_failure_is_reported_in_status():
    def broken_resolver(_requested):
        raise ImportError("torch DLL load failed")

    runtime = AiRuntime(
        KeyframeSettings(_env_file=None),
        clip_loader=lambda *_: FakeClip([]),
        tagger_loader=lambda *_: FakeTagger(),
        device_resolver=broken_resolver,
    )
    runtime.start()
    try:
        with pytest.raises(AiUnavailableError, match="torch DLL load failed"):
            runtime.embed_text("x")
        status = runtime.status()
        assert status.state == ModelState.ERROR
        assert "실행 장치" in status.note
    finally:
        runtime.shutdown()


def test_inference_errors_are_wrapped():
    class BrokenClip(FakeClip):
        def embed_text(self, text):
            raise RuntimeError("CUDA out of memory")

    runtime = make_runtime([], clip_loader=lambda *_: BrokenClip([]))
    runtime.start()
    try:
        with pytest.raises(AiInferenceError, match="CUDA out of memory"):
            runtime.embed_text("x")
    finally:
        runtime.shutdown()


def test_requests_are_serialized_and_time_out_while_worker_is_busy():
    release = threading.Event()
    started = threading.Event()
    runtime = make_runtime([])
    runtime.start()
    try:
        def busy():
            started.set()
            release.wait(5)

        blocker = threading.Thread(target=lambda: runtime._run(busy, timeout=5))
        blocker.start()
        started.wait(5)
        with pytest.raises(AiUnavailableError, match="잠시 후 다시 시도"):
            runtime.embed_text("blue sky", timeout=0.05)
        release.set()
        blocker.join(5)
        assert np.array_equal(runtime.embed_text("blue sky"), axis(1))
    finally:
        release.set()
        runtime.shutdown()


def test_input_validation_happens_before_worker(tmp_path):
    runtime = make_runtime([])
    empty = tmp_path / "empty.webp"
    empty.write_bytes(b"")
    with pytest.raises(InvalidRequestError, match="비어 있습니다"):
        runtime.analyze_image(empty)
    with pytest.raises(InvalidRequestError, match="검색어"):
        runtime.embed_text("   ")
    with pytest.raises(AiUnavailableError, match="시작되지 않았습니다"):
        runtime.embed_text("not started")


def test_unreadable_snapshot_is_rejected(tmp_path):
    runtime = make_runtime([])
    broken = tmp_path / "broken.webp"
    broken.write_bytes(b"not an image")
    runtime.start()
    try:
        with pytest.raises(InvalidRequestError, match="이미지를 읽을 수 없습니다"):
            runtime.analyze_image(broken)
    finally:
        runtime.shutdown()


def test_warmup_loads_both_models_in_background():
    events = []
    runtime = make_runtime(events, ai_warmup=True)
    runtime.start()
    try:
        runtime._run(lambda: None, timeout=5)
        assert runtime.status().state == ModelState.READY
    finally:
        runtime.shutdown()
        runtime.shutdown()  # 두 번 호출해도 안전하다.
    with pytest.raises(AiUnavailableError):
        runtime.embed_text("after shutdown")


def test_global_runtime_registry():
    runtime = make_runtime([])
    ai_runtime.set_ai_runtime(runtime)
    try:
        assert ai_runtime.get_ai_runtime() is runtime
    finally:
        ai_runtime.set_ai_runtime(None)
    with pytest.raises(AiUnavailableError):
        ai_runtime.get_ai_runtime()


def test_embedding_packing_round_trip_and_validation():
    vector = np.linspace(-1, 1, 768, dtype=np.float32)
    packed = pack_embedding(vector)
    assert packed == struct.pack("<768f", *vector.tolist())
    assert np.array_equal(unpack_embedding(packed), vector)
    assert unpack_embedding(b"\x00" * 8) is None
    with pytest.raises(ValueError):
        pack_embedding(np.zeros(10))
    with pytest.raises(ValueError):
        pack_embedding(np.full(768, np.nan))
