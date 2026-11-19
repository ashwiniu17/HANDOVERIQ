from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..domain import SectionType
from ..models import Document, Handover, HandoverSection, Project, ProjectMember, User
from ..schemas.project import OwnerOut, ProjectCreate, ProjectOut, ProjectUpdate
from ..domain import AccessRole, Permission
from ..db.base import utcnow
from . import activity
from .access import ProjectAccess, accessible_project_ids, find_access

TOTAL_SECTIONS = len(SectionType)


@dataclass
class ProjectStats:
    document_count: int = 0
    member_count: int = 1  # the owner
    handover_status: str | None = None
    completed_sections: int = 0

    @property
    def progress(self) -> int:
        if self.handover_status is None:
            return 0
        return round(100 * self.completed_sections / TOTAL_SECTIONS)


def load_stats(db: Session, project_ids: list[int]) -> dict[int, ProjectStats]:
    stats = {pid: ProjectStats() for pid in project_ids}
    if not project_ids:
        return stats

    for pid, count in db.execute(
        select(Document.project_id, func.count()).where(Document.project_id.in_(project_ids)).group_by(Document.project_id)
    ):
        stats[pid].document_count = count
    for pid, count in db.execute(
        select(ProjectMember.project_id, func.count())
        .where(ProjectMember.project_id.in_(project_ids))
        .group_by(ProjectMember.project_id)
    ):
        stats[pid].member_count += count
    for pid, handover_id, status in db.execute(
        select(Handover.project_id, Handover.id, Handover.status).where(Handover.project_id.in_(project_ids))
    ):
        stats[pid].handover_status = status
    done = db.execute(
        select(Handover.project_id, func.count())
        .join(HandoverSection, HandoverSection.handover_id == Handover.id)
        .where(Handover.project_id.in_(project_ids), HandoverSection.is_complete.is_(True))
        .group_by(Handover.project_id)
    )
    for pid, count in done:
        stats[pid].completed_sections = count
    return stats


def to_out(project: Project, role: AccessRole, stats: ProjectStats, owner: User) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        my_role=role,
        owner=OwnerOut(id=owner.id, full_name=owner.full_name),
        document_count=stats.document_count,
        member_count=stats.member_count,
        handover_status=stats.handover_status,
        handover_progress=stats.progress,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def serialize(db: Session, access: ProjectAccess) -> ProjectOut:
    stats = load_stats(db, [access.project.id])[access.project.id]
    return to_out(access.project, access.role, stats, access.project.owner)


def list_projects(
    db: Session, user: User, search: str | None = None, status: str | None = None, limit: int | None = None
) -> list[ProjectOut]:
    query = select(Project).where(Project.id.in_(accessible_project_ids(user)))
    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.where(func.lower(Project.name).like(pattern) | func.lower(func.coalesce(Project.description, "")).like(pattern))
    if status:
        query = query.where(Project.status == status)
    query = query.order_by(Project.updated_at.desc(), Project.id.desc())
    if limit:
        query = query.limit(limit)
    projects = list(db.scalars(query))

    stats = load_stats(db, [p.id for p in projects])
    member_roles = dict(
        db.execute(
            select(ProjectMember.project_id, ProjectMember.role).where(
                ProjectMember.user_id == user.id, ProjectMember.project_id.in_([p.id for p in projects])
            )
        ).all()
    )
    result = []
    for project in projects:
        role = AccessRole.owner if project.owner_id == user.id else AccessRole(member_roles[project.id])
        result.append(to_out(project, role, stats[project.id], project.owner))
    return result


def create_project(db: Session, user: User, data: ProjectCreate) -> Project:
    project = Project(
        owner_id=user.id,
        name=data.name,
        description=data.description or None,
        status=data.status.value,
    )
    db.add(project)
    db.flush()
    activity.record(db, project.id, user, "project.created", f"Created the project “{project.name}”.", "project", project.id)
    db.commit()
    return project


def update_project(db: Session, access: ProjectAccess, data: ProjectUpdate) -> Project:
    access.require(Permission.edit)
    project = access.project
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        project.name = changes["name"]
    if "description" in changes:
        project.description = changes["description"] or None
    if "status" in changes and changes["status"] is not None:
        project.status = changes["status"].value if hasattr(changes["status"], "value") else changes["status"]
    activity.record(db, project.id, access.user, "project.updated", f"Updated the project details.", "project", project.id)
    db.commit()
    return project


def delete_project(db: Session, access: ProjectAccess) -> None:
    """Soft delete: hidden everywhere, but kept in the database."""
    access.require(Permission.manage)
    access.project.deleted_at = utcnow()
    db.commit()
