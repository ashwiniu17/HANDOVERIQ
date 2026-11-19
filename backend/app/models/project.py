from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, TimestampMixin, UTCDateTime
from ..domain import MemberRole, ProjectStatus, values


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(f"status IN ({values(ProjectStatus)})", name="ck_projects_status"),
        Index("ix_projects_owner_deleted", "owner_id", "deleted_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=ProjectStatus.active.value, server_default="active")
    # Soft delete: the row stays (for recovery and audit) but is hidden everywhere.
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    owner = relationship("User")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(TimestampMixin, Base):
    __tablename__ = "project_members"
    __table_args__ = (
        CheckConstraint(f"role IN ({values(MemberRole)})", name="ck_project_members_role"),
        UniqueConstraint("project_id", "email", name="uq_project_members_project_email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    # Set once the person has a HANDOVERIQ account with this e-mail address.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(254))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20))

    project = relationship("Project", back_populates="members")
    user = relationship("User")
