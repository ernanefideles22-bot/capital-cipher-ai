from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings

SystemMode = Literal["OFFLINE", "PAPER", "LIVE_LOCKED", "LIVE", "ERROR", "MAINTENANCE"]


class Settings(BaseSettings):
    """Application settings for the backend MVP."""

    app_name: str = "Capital Cipher AI Backend"
    app_env: str = "dev"
    app_version: str = "0.1.0"
    system_mode: SystemMode = "PAPER"
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
