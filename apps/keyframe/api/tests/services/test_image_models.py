import asyncio
import math
import struct
from types import SimpleNamespace

import pytest

from app.services import scene_models


class GenerationSession:
    def __init__(self, client):
        self.client = client
        self.finished = False
        self.closed = False

    async def call(self, handler_type, input=None, **kwargs):
        self.client.calls.append(("call", handler_type, input, kwargs))
        if handler_type == "ai.sdxl.i2i":
            files = [
                SimpleNamespace(
                    id="image-1", data=b"png-one", size=7,
                    name="sdxl-10.png", mime_type="image/png",
                ),
                SimpleNamespace(
                    id="image-2", data=b"png-two", size=7,
                    name="sdxl-11.png", mime_type="image/png",
                ),
            ]
            return SimpleNamespace(
                payload={
                    "model": "main-sdxl",
                    "images": [
                        {
                            "attachment_id": "image-1", "name": "sdxl-10.png",
                            "format": "png", "mimeType": "image/png", "size": 7, "seed": 10,
                        },
                        {
                            "attachment_id": "image-2", "name": "sdxl-11.png",
                            "format": "png", "mimeType": "image/png", "size": 7, "seed": 11,
                        },
                    ],
                    "count": 2,
                },
                files=files,
            )
        if handler_type == "ai.clip.image":
            return SimpleNamespace(
                payload={
                    "model": scene_models.CLIP_MODEL_NAME,
                    "embedding": [1 / math.sqrt(768)] * 768,
                    "dimensions": 768,
                },
                files=[],
            )
        raise AssertionError(f"unexpected handler: {handler_type}")

    async def finish(self, **kwargs):
        self.client.calls.append(("finish", kwargs))
        self.finished = True

    async def close(self):
        self.client.calls.append(("session-close",))
        self.closed = True


class GenerationClient:
    instances = []

    def __init__(self, *_args, **_kwargs):
        self.calls = []
        self.session = GenerationSession(self)
        type(self).instances.append(self)

    async def list_launchers(self):
        self.calls.append(("list-launchers", asyncio.get_running_loop()))
        return []

    async def run_job(self, handler_type, input=None, **kwargs):
        self.calls.append(("run", handler_type, input, kwargs))
        if handler_type != "ai.wd14.tags":
            raise AssertionError(f"unexpected handler: {handler_type}")
        return SimpleNamespace(
            payload={
                "model": scene_models.WD14_MODEL_REPO,
                "prompt": " blue sky, 1girl ",
                "keywords": ["blue sky", "1girl"],
            },
            files=[],
            session=self.session,
        )

    async def close(self):
        self.calls.append(("client-close",))


def test_image_generation_reuses_one_session_for_wd14_sdxl_and_clip(tmp_path):
    GenerationClient.instances = []
    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"snapshot")
    settings = scene_models.SdxlGenerationSettings(
        model="main-sdxl",
        count=2,
        negative_prompt="low quality",
        seeds=[10, 11],
        step=24,
        cfg=6.5,
        strength=0.75,
        width=1024,
        height=768,
        format="png",
    )
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test",
        "token",
        37,
        client_factory=GenerationClient,
    )
    runtime.start()
    try:
        result = runtime.generate_images(snapshot, settings)
    finally:
        runtime.stop()

    client = GenerationClient.instances[0]
    handlers = [call[1] for call in client.calls if call[0] in {"run", "call"}]
    assert handlers == [
        "ai.wd14.tags",
        "ai.sdxl.i2i",
        "ai.clip.image",
        "ai.clip.image",
    ]
    run = next(call for call in client.calls if call[0] == "run")
    calls = [call for call in client.calls if call[0] == "call"]
    assert run[3]["auto_finish"] is False
    assert run[3]["attachments"][0] is calls[0][3]["attachments"][0]
    assert calls[0][2] == {
        "model": "main-sdxl",
        "prompts": ["blue sky, 1girl", "blue sky, 1girl"],
        "step": 24,
        "cfg": 6.5,
        "strength": 0.75,
        "width": 1024,
        "height": 768,
        "format": "png",
        "negative_prompts": ["low quality", "low quality"],
        "seeds": [10, 11],
    }
    assert [call[3]["attachments"][0].data for call in calls[1:]] == [
        b"png-one", b"png-two",
    ]
    assert client.session.finished is True
    assert client.session.closed is False
    assert result.prompt == "blue sky, 1girl"
    assert [image.seed for image in result.images] == [10, 11]
    assert all(len(image.embedding) == 768 * 4 for image in result.images)


def test_image_generation_closes_the_shared_session_on_invalid_sdxl_result(tmp_path):
    class InvalidSession(GenerationSession):
        async def call(self, handler_type, input=None, **kwargs):
            if handler_type == "ai.sdxl.i2i":
                self.client.calls.append(("call", handler_type, input, kwargs))
                return SimpleNamespace(payload={"model": "main-sdxl", "images": [], "count": 0}, files=[])
            return await super().call(handler_type, input, **kwargs)

    class InvalidClient(GenerationClient):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.session = InvalidSession(self)

    snapshot = tmp_path / "snapshot.webp"
    snapshot.write_bytes(b"snapshot")
    runtime = scene_models.GpStationAiRuntime(
        "http://gpstation.test", "token", client_factory=InvalidClient
    )
    runtime.start()
    with pytest.raises(RuntimeError, match=r"ai\.sdxl\.i2i 응답 payload"):
        runtime.generate_images(
            snapshot,
            scene_models.SdxlGenerationSettings(
                model="main-sdxl", count=1, negative_prompt="", seeds=None,
                step=30, cfg=7.0, strength=0.8, width=1024, height=1024, format="png",
            ),
        )
    runtime.stop()
    assert InvalidClient.instances[-1].session.closed is True
