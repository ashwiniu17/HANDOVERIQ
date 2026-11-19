from __future__ import annotations

from datetime import datetime

from pydantic import Field, model_validator

from ..domain import Confidence, KnowledgeCategory, KnowledgeStatus, RunStatus, SectionType
from .common import InputModel, OutputModel
from .document import DocumentOut


class KnowledgeItemOut(OutputModel):
    id: int
    project_id: int
    document_id: int | None
    source_name: str
    category: KnowledgeCategory
    title: str
    content: str
    source_quote: str | None
    quote_verified: bool
    confidence: Confidence
    status: KnowledgeStatus
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime


class KnowledgeUpdate(InputModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=10_000)
    status: KnowledgeStatus | None = None

    @model_validator(mode="after")
    def _something_to_change(self) -> "KnowledgeUpdate":
        if self.title is None and self.content is None and self.status is None:
            raise ValueError("Send at least one field to change.")
        return self


class ApplyRequest(InputModel):
    # Omit to apply every accepted or edited item that is not applied yet.
    item_ids: list[int] | None = Field(default=None, max_length=500)


class ApplyResult(OutputModel):
    applied_count: int
    sections_updated: list[SectionType]


class AnalysisRunOut(OutputModel):
    id: int
    project_id: int
    document_id: int | None
    document_name: str
    status: RunStatus
    model: str
    error_code: str | None
    error_message: str | None
    truncated: bool
    input_tokens: int | None
    output_tokens: int | None
    items_created: int
    started_at: datetime
    finished_at: datetime | None


class AnalyzeResult(OutputModel):
    run: AnalysisRunOut
    document: DocumentOut


class AIStatusOut(OutputModel):
    configured: bool
    model: str
