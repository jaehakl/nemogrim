from app.ai.types import ModelState
from app.routers import health


def test_ai_status_reports_device_and_models(api_client, fake_ai):
    status = api_client.get("/api/ai/status").json()
    assert status["state"] == "not_loaded"
    assert status["device"] == "cuda:0"
    assert status["models"]["clip"]["name"] == "OpenAI CLIP ViT-L/14"
    assert status["models"]["tagger"]["name"] == "SmilingWolf/wd-eva02-large-tagger-v3"


def test_ai_warmup_is_accepted_without_waiting(api_client, fake_ai):
    response = api_client.post("/api/ai/warmup")
    assert response.status_code == 202
    assert ("warmup",) in fake_ai.calls


def test_health_includes_ai_and_degrades_only_on_ai_error(api_client, fake_ai, monkeypatch):
    monkeypatch.setattr(
        health, "ffmpeg_status", lambda: {"ffmpeg_available": True, "ffprobe_available": True}
    )
    body = api_client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database_ok"] is True
    assert body["ai"]["state"] == "not_loaded"

    fake_ai.state = ModelState.ERROR
    assert api_client.get("/api/health").json()["status"] == "degraded"
