from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from ..db.base import Base, TimestampMixin, UTCDateTime
from ..domain import AnalysisStatus, ProcessingStatus, values


class Document(TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(f"processing_status IN ({values(ProcessingStatus)})", name="ck_documents_processing"),
        CheckConstraint(f"analysis_status IN ({values(AnalysisStatus)})", name="ck_documents_analysis"),
        UniqueConstraint("project_id", "sha256", name="uq_documents_project_sha256"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(10))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))

    processing_status: Mapped[str] = mapped_column(String(20), default=ProcessingStatus.processing.value)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Only loaded when asked for: it can be large and most queries do not need it.
    extracted_text: Mapped[str | None] = deferred(mapped_column(Text, nullable=True))

    analysis_status: Mapped[str] = mapped_column(String(20), default=AnalysisStatus.not_analyzed.value)
    analysis_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_analyzed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    uploaded_by = relationship("User")
    file = relationship("DocumentFile", uselist=False, cascade="all, delete-orphan", back_populates="document")


class DocumentFile(Base):
    """The original uploaded bytes.

    Kept in the database (not on disk) so that files survive redeploys on hosts
    with temporary disks, and so access always goes through permission checks.
    """

    __tablename__ = "document_files"

    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    content: Mapped[bytes] = deferred(mapped_column(LargeBinary, nullable=False))

    document = relationship("Document", back_populates="file")
