import asyncio

import pytest

from app import main
from app.ai import runtime as ai_runtime


class RecordingRuntime:
    def __init__(self, events, settings):
        self.events = events
        events.append(("ai-create", settings))

    def start(self):
        self.events.append("ai-start")

    def shutdown(self):
        self.events.append("ai-shutdown")


def run_lifespan(body=lambda: None):
    async def exercise():
        async with main.lifespan(main.app):
            body()

    asyncio.run(exercise())


def test_lifespan_starts_ai_before_queue_and_stops_queue_first(monkeypatch):
    events = []
    monkeypatch.setattr(main, "init_db", lambda: events.append("db"))
    monkeypatch.setattr(main, "AiRuntime", lambda settings: RecordingRuntime(events, settings))
    monkeypatch.setattr(main, "start_media_queue", lambda _app: events.append("queue-start"))
    monkeypatch.setattr(main, "stop_media_queue", lambda _app: events.append("queue-stop"))

    def body():
        events.append("running")
        assert isinstance(ai_runtime.get_ai_runtime(), RecordingRuntime)

    run_lifespan(body)

    assert events == [
        "db",
        ("ai-create", main.app.state.settings),
        "ai-start",
        "queue-start",
        "running",
        "queue-stop",
        "ai-shutdown",
    ]
    with pytest.raises(Exception, match="시작되지 않았습니다"):
        ai_runtime.get_ai_runtime()


def test_lifespan_shuts_down_ai_when_queue_fails_to_start(monkeypatch):
    events = []
    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main, "AiRuntime", lambda settings: RecordingRuntime(events, settings))

    def fail_queue(_app):
        raise RuntimeError("queue failure")

    monkeypatch.setattr(main, "start_media_queue", fail_queue)
    monkeypatch.setattr(main, "stop_media_queue", lambda _app: events.append("queue-stop"))

    with pytest.raises(RuntimeError, match="queue failure"):
        run_lifespan()
    assert events[-1] == "ai-shutdown"
    assert "queue-stop" not in events
