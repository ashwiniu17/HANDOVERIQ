from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, TimestampMixin, UTCDateTime, utcnow
from ..domain import Confidence, KnowledgeCategory, KnowledgeStatus, RunStatus, values


class AnalysisRun(Base):
    """One attempt to analyse a document with the AI. Kept so failures are visible."""

    __tablename__ = "analysis_runs"
    __table_args__ = (CheckConstraint(f"status IN ({values(RunStatus)})", name="ck_analysis_runs_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    document_name: Mapped[str] = mapped_column(String(255))
    requested_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default=RunStatus.running.value)
    model: Mapped[str] = mapped_column(String(100))
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    truncated: Mapped[bool] = mapped_column(Boolean, default=False)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items_created: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class KnowledgeItem(TimestampMixin, Base):
    """One piece of information the AI found in a document, awaiting human review."""

    __tablename__ = "knowledge_items"
    __table_args__ = (
        CheckConstraint(f"category IN ({values(KnowledgeCategory)})", name="ck_knowledge_category"),
        CheckConstraint(f"status IN ({values(KnowledgeStatus)})", name="ck_knowledge_status"),
        CheckConstraint(f"confidence IN ({values(Confidence)})", name="ck_knowledge_confidence"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_runs.id", ondelete="SET NULL"), nullable=True)
    source_name: Mapped[str] = mapped_column(String(255))

    category: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    # A passage copied from the document that supports this item...
    source_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    # ...and whether that passage was actually found in the document's text.
    quote_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[str] = mapped_column(String(10), default=Confidence.medium.value)

    status: Mapped[str] = mapped_column(String(20), default=KnowledgeStatus.suggested.value)
    applied_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    document = relationship("Document")
