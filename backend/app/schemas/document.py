from __future__ import annotations

from datetime import datetime

from ..domain import AnalysisStatus, ProcessingStatus
from .common import OutputModel


class DocumentOut(OutputModel):
    id: int
    project_id: int
    filename: str
    file_type: str
    size_bytes: int
    processing_status: ProcessingStatus
    processing_error: str | None
    char_count: int
    page_count: int | None
    analysis_status: AnalysisStatus
    analysis_error: str | None
    last_analyzed_at: datetime | None
    uploaded_by_name: str | None = None
    knowledge_count: int = 0
    created_at: datetime


class DocumentTextOut(OutputModel):
    id: int
    filename: str
    text: str
    total_chars: int
    truncated: bool
