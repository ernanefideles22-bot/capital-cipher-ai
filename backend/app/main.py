from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.log_config import configure_log_output

settings = get_settings()
configure_log_output(settings.log_level)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Capital Cipher AI backend MVP. PAPER mode only.",
)

app.include_router(health_router)
