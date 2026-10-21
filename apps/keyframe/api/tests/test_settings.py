import pytest
from pydantic import ValidationError

from app.settings import KeyframeSettings


def test_settings_have_usable_defaults_without_environment(monkeypatch):
    for name in ("KEYFRAME_AI_DEVICE", "KEYFRAME_AI_WARMUP", "KEYFRAME_AI_OFFLINE"):
        monkeypatch.delenv(name, raising=False)
    settings = KeyframeSettings(_env_file=None)
    assert settings.ai_device == "auto"
    assert settings.ai_warmup is False
    assert settings.ai_offline is False
    assert settings.ai_model_cache_dir.name == "models"
    assert settings.wd14_general_threshold == 0.35


def test_settings_read_keyframe_prefixed_environment(monkeypatch):
    monkeypatch.setenv("KEYFRAME_AI_DEVICE", "cpu")
    monkeypatch.setenv("KEYFRAME_WD14_MAX_TAGS", "12")
    monkeypatch.setenv("KEYFRAME_CORS_ORIGINS", '["http://example.test"]')
    monkeypatch.setenv("GPSTATION_CLIENT_TOKEN", "legacy-value-is-ignored")
    settings = KeyframeSettings(_env_file=None)
    assert settings.ai_device == "cpu"
    assert settings.wd14_max_tags == 12
    assert settings.cors_origins == ["http://example.test"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"ai_device": "tpu"},
        {"ai_request_timeout_seconds": 0},
        {"wd14_general_threshold": 1.5},
        {"wd14_max_tags": 0},
    ],
)
def test_settings_reject_invalid_values(overrides):
    with pytest.raises(ValidationError):
        KeyframeSettings(_env_file=None, **overrides)
