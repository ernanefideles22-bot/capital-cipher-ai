from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

SystemMode = Literal["OFFLINE", "PAPER", "LIVE_LOCKED", "LIVE", "ERROR", "MAINTENANCE"]
HealthState = Literal["OK", "DEGRADED", "ERROR", "OFFLINE"]


class HealthResponse(BaseModel):
    status: HealthState = "OK"
    service: str = "capital-cipher-backend"
    version: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusResponse(BaseModel):
    service: str = "capital-cipher-backend"
    status: HealthState = "OK"
    mode: SystemMode
    version: str
    components: dict[str, str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
