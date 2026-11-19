from __future__ import annotations

from datetime import datetime

from pydantic import Field, model_validator

from ..domain import HandoverStatus, SectionType
from .common import InputModel, OutputModel

MAX_SECTION_CHARS = 50_000


class SectionOut(OutputModel):
    section_type: SectionType
    title: str
    content: str
    is_complete: bool
    updated_at: datetime


class HandoverOut(OutputModel):
    id: int
    project_id: int
    status: HandoverStatus
    progress: int
    completed_sections: int
    total_sections: int
    sections: list[SectionOut]
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    completed_by_name: str | None
    acknowledged_at: datetime | None
    acknowledged_by_name: str | None


class SectionUpdate(InputModel):
    content: str | None = Field(default=None, max_length=MAX_SECTION_CHARS)
    is_complete: bool | None = None

    @model_validator(mode="after")
    def _something_to_change(self) -> "SectionUpdate":
        if self.content is None and self.is_complete is None:
            raise ValueError("Send content, is_complete, or both.")
        return self
