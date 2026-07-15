import pytest
from pydantic import ValidationError

from app.settings import KeyframeSettings


def test_gpstation_settings_are_required(monkeypatch):
    monkeypatch.delenv("GPSTATION_API_BASE_URL", raising=False)
    monkeypatch.delenv("GPSTATION_CLIENT_TOKEN", raising=False)
    with pytest.raises(ValidationError) as error:
        KeyframeSettings(_env_file=None)
    missing = {item["loc"][0] for item in error.value.errors()}
    assert missing == {"gpstation_api_base_url", "gpstation_client_token"}


def test_gpstation_settings_load_and_validate_timeout(monkeypatch):
    monkeypatch.setenv("GPSTATION_API_BASE_URL", "http://127.0.0.1:8000")
    monkeypatch.setenv("GPSTATION_CLIENT_TOKEN", " client-token ")
    monkeypatch.setenv("GPSTATION_JOB_TIMEOUT_SECONDS", "600")
    settings = KeyframeSettings(_env_file=None)
    assert str(settings.gpstation_api_base_url) == "http://127.0.0.1:8000/"
    assert settings.gpstation_client_token.get_secret_value() == "client-token"
    assert settings.gpstation_job_timeout_seconds == 600


@pytest.mark.parametrize("value", ["", "0", "-1"])
def test_gpstation_timeout_or_token_cannot_be_empty_or_nonpositive(value):
    arguments = {
        "gpstation_api_base_url": "http://127.0.0.1:8000",
        "gpstation_client_token": "token",
        "gpstation_job_timeout_seconds": value,
        "_env_file": None,
    }
    if value == "":
        arguments["gpstation_client_token"] = value
        arguments["gpstation_job_timeout_seconds"] = 600
    with pytest.raises(ValidationError):
        KeyframeSettings(**arguments)
