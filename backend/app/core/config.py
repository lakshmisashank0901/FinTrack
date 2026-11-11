from functools import lru_cache
from typing import Annotated, Literal

from pydantic import ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"

    database_url: str
    db_pool_min_size: int = 1
    db_pool_max_size: int = 10

    supabase_url: str
    supabase_jwt_secret: str | None = None
    jwt_audience: str = "authenticated"

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    # None = on in development/test, off in production (explicit ENABLE_DOCS always wins).
    enable_docs: bool | None = None

    @model_validator(mode="after")
    def _default_docs(self) -> "Settings":
        if self.enable_docs is None:
            self.enable_docs = self.environment != "production"
        return self

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("supabase_url")
    @classmethod
    def _strip_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator("supabase_jwt_secret", mode="before")
    @classmethod
    def _empty_secret(cls, value: object) -> object:
        return value or None

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        problems = "\n".join(
            f"  - {str(e['loc'][0]).upper()}: {'missing' if e['type'] == 'missing' else e['msg']}" for e in exc.errors()
        )
        raise SystemExit(
            "FinTrack API configuration error:\n"
            f"{problems}\n\n"
            "Create backend/.env from backend/.env.example (cp .env.example .env) and fill in the values,\n"
            "or run `python scripts/local_api.py` to start in local mode without Supabase."
        ) from None
