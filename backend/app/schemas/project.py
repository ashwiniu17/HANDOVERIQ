from __future__ import annotations

from datetime import datetime

from pydantic import Field

from ..domain import AccessRole, HandoverStatus, MemberRole, ProjectStatus
from .common import InputModel, OutputModel


class ProjectCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    status: ProjectStatus = ProjectStatus.active


class ProjectUpdate(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    status: ProjectStatus | None = None


class OwnerOut(OutputModel):
    id: int
    full_name: str


class ProjectOut(OutputModel):
    id: int
    name: str
    description: str | None
    status: ProjectStatus
    my_role: AccessRole
    owner: OwnerOut
    document_count: int = 0
    member_count: int = 0
    handover_status: HandoverStatus | None = None
    handover_progress: int = 0
    created_at: datetime
    updated_at: datetime


class MemberCreate(InputModel):
    email: str = Field(min_length=3, max_length=254)
    name: str | None = Field(default=None, max_length=100)
    role: MemberRole


class MemberUpdate(InputModel):
    role: MemberRole


class MemberOut(OutputModel):
    # None for the project owner, who is not stored as a member row.
    id: int | None
    name: str
    email: str
    role: AccessRole
    is_owner: bool = False
    # False while the person has not created a HANDOVERIQ account yet.
    has_account: bool = True
    created_at: datetime


class ActivityOut(OutputModel):
    id: int
    project_id: int
    project_name: str | None = None
    actor_name: str
    action: str
    message: str
    entity_type: str | None
    entity_id: int | None
    created_at: datetime
