from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[1]


class KeyframeSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gpstation_api_base_url: AnyHttpUrl
    gpstation_client_token: SecretStr
    gpstation_job_timeout_seconds: float = Field(default=600.0, gt=0)

    @field_validator("gpstation_client_token", mode="before")
    @classmethod
    def validate_client_token(cls, value: object) -> object:
        token = value.get_secret_value() if isinstance(value, SecretStr) else value
        if not isinstance(token, str) or not token.strip():
            raise ValueError("GPSTATION_CLIENT_TOKEN must not be empty")
        return token.strip()
