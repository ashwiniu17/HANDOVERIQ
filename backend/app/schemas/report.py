from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from .common import InputModel, OutputModel


class ReportCreate(InputModel):
    title: str | None = Field(default=None, max_length=200)


class ReportOut(OutputModel):
    id: int
    project_id: int
    version: int
    title: str
    created_by_name: str | None = None
    created_at: datetime
    handover_status: str | None = None
    progress: int = 0


class ReportDetail(ReportOut):
    snapshot: dict[str, Any]
