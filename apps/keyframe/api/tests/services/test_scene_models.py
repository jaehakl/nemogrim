import asyncio
import math
import struct
import threading
import time
from types import SimpleNamespace

import pytest

from app.services import scene_models


def _clip_payload(**overrides):
    payload = {
        "model": scene_models.CLIP_MODEL_NAME,
        "embedding": [1 / math.sqrt(768)] * 768,
        "dimensions": 768,
    }
    payload.update(overrides)
    return payload


class FakeSession:
    def __init__(self, client):
        self.client = client
        self.finished = False
        self.closed = False

    async def call(self, handler_type, input=None, **kwargs):
        self.client.calls.append(("call", handler_type, input, kwargs))
        return SimpleNamespace(
            payload=self.client.wd14_payload,
            files=self.client.wd14_files,
        )

    async def finish(self, **kwargs):
        self.client.calls.append(("finish", kwargs))
        self.finished = True

    async def close(self):
        self.client.calls.append(("session-close",))
        self.closed = True


class FakeGpStationClient:
    instances = []
    startup_error = None
    clip_payload = _clip_payload()
    text_payload = _clip_payload()
    wd14_payload = {
        "model": scene_models.WD14_MODEL_REPO,
        "prompt": "blue sky, 1girl",
        "keywords": ["blue sky", "1girl"],
    }
    clip_files = []
    text_files = []
    wd14_files = []
    text_delay = 0.0
    block_text = False
    cancelled = threading.Event()

    def __init__(self, api_base_url, token, **kwargs):
        self.api_base_url = api_base_url
        self.token = token
        self.kwargs = kwargs
        self.calls = []
        self.closed = False
        self.session = FakeSession(self)
        self.active = 0
        self.max_active = 0
        self.loops = []
        type(self).instances.append(self)

    async def list_launchers(self):
        self.calls.append(("list-launchers",))
        self.loops.append(asyncio.get_running_loop())
        if type(self).startup_error is not None:
            raise type(self).startup_error
        return []

    async def run_job(self, handler_type, input=None, **kwargs):
        self.calls.append(("run", handler_type, input, kwargs))
        self.loops.append(asyncio.get_running_loop())
        if handler_type == "ai.clip.image":
            return SimpleNamespace(
                payload=type(self).clip_payload,
                files=type(self).clip_files,
                session=self.session,
            )
        if handler_type != "ai.clip.text":
            raise AssertionError(f"unexpected handler: {handler_type}")
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            if type(self).block_text:
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    type(self).cancelled.set()
                    raise
            if type(self).text_delay:
                await asyncio.sleep(type(self).text_delay)
            return SimpleNamespace(
                payload=type(self).text_payload,
                files=type(self).text_files,
            )
        finally:
            self.active -= 1

    async def close(self):
        self.calls.append(("client-close",))
        self.closed = True


@pytest.fixture(autouse=True)
def reset_fake_client():
    FakeGpStationClient.instances = []
    FakeGpStationClient.startup_error = None
    FakeGpStationClient.clip_payload = _clip_payload()
    FakeGpStationClient.text_payload = _clip_payload()
    FakeGpStationClient.wd14_payload = {
        "model": scene_models.WD14_MODEL_REPO,
        "prompt": "blue sky, 1girl",
        "keywords": ["blue sky", "1girl"],
    }
    FakeGpStationClient.clip_files = []
    FakeGpStationClient.text_files = []
    FakeGpStationClient.wd14_files = []
    FakeGpStationClient.text_delay = 0.0
    FakeGpStationClient.block_text = False
    FakeGpStationClient.cancelled = threading.Event()


def test_scene_uses_one_session_same_attachment_and_600_second_timeout(tmp_path):
    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"webp")
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test",
        "secret-token",
        client_factory=FakeGpStationClient,
    )
    runtime.start()
    try:
        analysis = runtime.analyze_image(snapshot)
    finally:
        runtime.stop()

    client = FakeGpStationClient.instances[0]
    assert client.api_base_url == "http://gpstation.test"
    assert client.token == "secret-token"
    assert client.kwargs == {"auth_mode": "bearer", "job_api_prefix": "/v1/jobs"}
    assert client.calls[0] == ("list-launchers",)
    run = next(call for call in client.calls if call[0] == "run")
    followup = next(call for call in client.calls if call[0] == "call")
    assert [run[1], followup[1]] == ["ai.clip.image", "ai.wd14.tags"]
    assert run[2] == followup[2] == {}
    assert run[3]["slave_app_id"] == "ai"
    assert run[3]["auto_finish"] is False
    assert run[3]["timeout_seconds"] == 600
    assert followup[3]["timeout_seconds"] == 600
    assert run[3]["attachments"][0] is followup[3]["attachments"][0]
    attachment = run[3]["attachments"][0]
    assert (attachment.id, attachment.data, attachment.mime_type) == (
        "image",
        b"webp",
        "image/webp",
    )
    assert client.session.finished is True
    assert client.session.closed is False
    assert client.closed is True
    assert len(set(client.loops)) == 1
    values = struct.unpack("<768f", analysis.embedding)
    assert math.sqrt(sum(value * value for value in values)) == pytest.approx(
        1.0, abs=1e-5
    )
    assert analysis.prompt == "blue sky, 1girl"
    assert analysis.keywords == ["blue sky", "1girl"]


def test_text_handler_payload_and_binary_format_use_configured_timeout():
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test",
        "token",
        37,
        client_factory=FakeGpStationClient,
    )
    runtime.start()
    try:
        embedding = runtime.embed_text("blue sky")
    finally:
        runtime.stop()

    client = FakeGpStationClient.instances[0]
    run = next(call for call in client.calls if call[0] == "run")
    assert run[1:3] == ("ai.clip.text", {"text": "blue sky"})
    assert run[3]["slave_app_id"] == "ai"
    assert run[3]["timeout_seconds"] == 37
    assert run[3]["auto_finish"] is True
    assert run[3]["attachments"] == ()
    assert len(embedding) == 768 * 4


@pytest.mark.parametrize(
    "payload",
    [
        None,
        _clip_payload(model="wrong-model"),
        _clip_payload(dimensions=512),
        _clip_payload(embedding=[0.0] * 767),
        _clip_payload(embedding=[0.0] * 767 + [float("nan")]),
        _clip_payload(embedding=[0.0] * 767 + [float("inf")]),
        _clip_payload(embedding=[0.0] * 767 + [True]),
    ],
)
def test_invalid_clip_image_payload_closes_session(payload, tmp_path):
    FakeGpStationClient.clip_payload = payload
    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"webp")
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        with pytest.raises(RuntimeError, match=r"ai\.clip\.image 응답 payload"):
            runtime.analyze_image(snapshot)
    finally:
        runtime.stop()
    assert FakeGpStationClient.instances[0].session.closed is True


def test_clip_text_rejects_result_attachment():
    FakeGpStationClient.text_files = [SimpleNamespace(id="unexpected")]
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        with pytest.raises(RuntimeError, match="attachment가 없어야"):
            runtime.embed_text("blue sky")
    finally:
        runtime.stop()


@pytest.mark.parametrize(
    "payload",
    [
        None,
        _clip_payload(model="wrong-model"),
        _clip_payload(dimensions=512),
        _clip_payload(embedding=[0.0] * 767),
        _clip_payload(embedding=[0.0] * 767 + [float("nan")]),
    ],
)
def test_clip_text_rejects_invalid_payload(payload):
    FakeGpStationClient.text_payload = payload
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        with pytest.raises(RuntimeError, match=r"ai\.clip\.text 응답 payload"):
            runtime.embed_text("blue sky")
    finally:
        runtime.stop()


@pytest.mark.parametrize(
    "payload",
    [
        None,
        {"model": "wrong", "prompt": "sky", "keywords": ["sky"]},
        {
            "model": scene_models.WD14_MODEL_REPO,
            "prompt": 123,
            "keywords": ["sky"],
        },
        {
            "model": scene_models.WD14_MODEL_REPO,
            "prompt": "sky",
            "keywords": ["sky", 3],
        },
    ],
)
def test_invalid_wd14_payload_closes_session(payload, tmp_path):
    FakeGpStationClient.wd14_payload = payload
    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"webp")
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        with pytest.raises(RuntimeError, match=r"ai\.wd14\.tags 응답 payload"):
            runtime.analyze_image(snapshot)
    finally:
        runtime.stop()
    assert FakeGpStationClient.instances[0].session.closed is True


def test_wd14_rejects_result_attachment_and_closes_session(tmp_path):
    FakeGpStationClient.wd14_files = [SimpleNamespace(id="unexpected")]
    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"webp")
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        with pytest.raises(RuntimeError, match="attachment가 없어야"):
            runtime.analyze_image(snapshot)
    finally:
        runtime.stop()
    assert FakeGpStationClient.instances[0].session.closed is True


def test_snapshot_size_limit_is_checked_before_remote_call(tmp_path):
    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"x" * (scene_models.MAX_SNAPSHOT_BYTES + 1))
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        with pytest.raises(ValueError, match="20 MiB"):
            runtime.analyze_image(snapshot)
    finally:
        runtime.stop()
    assert not any(call[0] == "run" for call in FakeGpStationClient.instances[0].calls)


def test_startup_auth_failure_closes_client_and_aborts_runtime():
    FakeGpStationClient.startup_error = RuntimeError("unauthorized")
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "bad-token", client_factory=FakeGpStationClient
    )
    with pytest.raises(RuntimeError, match="연결 검증에 실패.*unauthorized"):
        runtime.start()
    runtime.stop()
    client = FakeGpStationClient.instances[0]
    assert client.calls[:2] == [("list-launchers",), ("client-close",)]
    assert client.closed is True


def test_remote_ai_requests_are_serialized_across_sync_threads():
    FakeGpStationClient.text_delay = 0.03
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    errors = []

    def invoke(index):
        try:
            runtime.embed_text(f"query {index}")
        except Exception as error:
            errors.append(error)

    threads = [threading.Thread(target=invoke, args=(index,)) for index in range(3)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    runtime.stop()

    assert errors == []
    assert FakeGpStationClient.instances[0].max_active == 1


def test_bridge_timeout_cancels_inflight_coroutine():
    FakeGpStationClient.block_text = True
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test",
        "token",
        client_factory=FakeGpStationClient,
        bridge_timeout_seconds=0.02,
    )
    runtime.start()
    try:
        with pytest.raises(TimeoutError, match="시간이 초과"):
            runtime.embed_text("blue sky")
        assert FakeGpStationClient.cancelled.wait(1)
    finally:
        runtime.stop()


def test_runtime_rejects_empty_and_oversized_snapshot(tmp_path):
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=FakeGpStationClient
    )
    runtime.start()
    try:
        empty = tmp_path / "empty.webp"
        empty.write_bytes(b"")
        with pytest.raises(ValueError, match="비어"):
            runtime.analyze_image(empty)
        with pytest.raises(ValueError, match="검색어가 비어"):
            runtime.embed_text("   ")
    finally:
        runtime.stop()
