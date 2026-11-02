from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from .database import Base

# The handover lifecycle. Later steps add the endpoints that move a
# project from one stage to the next.
PROJECT_STATUSES = ("draft", "in_review", "approved", "shared")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """A datetime column that is always timezone-aware UTC in Python.

    SQLite drops timezone information, so values read back from it would be
    "naive" and could not be compared with aware values. This type stores UTC
    and re-attaches UTC on the way out, so SQLite and PostgreSQL behave alike.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetime not allowed; use a timezone-aware UTC datetime.")
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in PROJECT_STATUSES) + ")",
            name="ck_projects_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    outgoing_member: Mapped[str] = mapped_column(String(100), nullable=False)
    incoming_member: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="draft"
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


# Case-insensitive uniqueness: "Atlas" and "atlas" are the same name.
Index("uq_projects_name_lower", func.lower(Project.__table__.c.name), unique=True)


class Document(Base):
    """One uploaded file. Only its extracted text (chunks) is kept, not the file."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    # ON DELETE CASCADE: deleting a project removes its documents (and their chunks).
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow
    )


class Chunk(Base):
    """A piece of a document's text. Report citations point at chunk ids."""

    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3... within the document
    location: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "lines 3-9", "page 2"
    text: Mapped[str] = mapped_column(Text, nullable=False)


class Handover(Base):
    """The generated report for a project (added now, used by the Claude group)."""

    __tablename__ = "handovers"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    report_json: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow
    )
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)