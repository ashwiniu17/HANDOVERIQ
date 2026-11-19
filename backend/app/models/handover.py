from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, TimestampMixin, UTCDateTime
from ..domain import HandoverStatus, SectionType, values


class Handover(TimestampMixin, Base):
    __tablename__ = "handovers"
    __table_args__ = (CheckConstraint(f"status IN ({values(HandoverStatus)})", name="ck_handovers_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(String(20), default=HandoverStatus.draft.value, server_default="draft")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    acknowledged_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    sections = relationship("HandoverSection", back_populates="handover", cascade="all, delete-orphan")


class HandoverSection(TimestampMixin, Base):
    __tablename__ = "handover_sections"
    __table_args__ = (
        CheckConstraint(f"section_type IN ({values(SectionType)})", name="ck_handover_sections_type"),
        UniqueConstraint("handover_id", "section_type", name="uq_handover_sections_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    handover_id: Mapped[int] = mapped_column(ForeignKey("handovers.id", ondelete="CASCADE"), index=True)
    section_type: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    handover = relationship("Handover", back_populates="sections")
