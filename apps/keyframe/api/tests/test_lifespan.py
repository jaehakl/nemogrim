import asyncio

import pytest

from app import main


def test_lifespan_validates_ai_before_queue_and_stops_queue_first(monkeypatch):
    events = []
    settings = object()
    monkeypatch.setattr(main, "init_db", lambda: events.append("db"))
    monkeypatch.setattr(main, "KeyframeSettings", lambda: settings)
    monkeypatch.setattr(
        main,
        "start_scene_model_runtime",
        lambda actual: events.append(("ai-start", actual)),
    )
    monkeypatch.setattr(main, "start_media_queue", lambda _app: events.append("queue-start"))
    monkeypatch.setattr(main, "stop_media_queue", lambda _app: events.append("queue-stop"))
    monkeypatch.setattr(main, "stop_scene_model_runtime", lambda: events.append("ai-stop"))

    async def exercise():
        async with main.lifespan(main.app):
            events.append("running")

    asyncio.run(exercise())
    assert events == [
        "db",
        ("ai-start", settings),
        "queue-start",
        "running",
        "queue-stop",
        "ai-stop",
    ]


def test_lifespan_aborts_before_media_queue_when_ai_validation_fails(monkeypatch):
    events = []
    monkeypatch.setattr(main, "init_db", lambda: events.append("db"))
    monkeypatch.setattr(main, "KeyframeSettings", lambda: object())

    def fail_start(_settings):
        events.append("ai-start")
        raise RuntimeError("unauthorized")

    monkeypatch.setattr(main, "start_scene_model_runtime", fail_start)
    monkeypatch.setattr(main, "start_media_queue", lambda _app: events.append("queue-start"))
    monkeypatch.setattr(main, "stop_media_queue", lambda _app: events.append("queue-stop"))
    monkeypatch.setattr(main, "stop_scene_model_runtime", lambda: events.append("ai-stop"))

    async def exercise():
        async with main.lifespan(main.app):
            pass

    with pytest.raises(RuntimeError, match="unauthorized"):
        asyncio.run(exercise())
    assert events == ["db", "ai-start"]
