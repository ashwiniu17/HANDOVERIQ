"""Who may do what in which project.

A project is visible only to its owner and the people added as members.
Everyone else gets "not found", so the existence of other people's projects
is never revealed.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..core.errors import AppError
from ..domain import ROLE_PERMISSIONS, AccessRole, Permission
from ..models import Project, ProjectMember, User


@dataclass
class ProjectAccess:
    project: Project
    user: User
    role: AccessRole

    def can(self, permission: Permission) -> bool:
        return permission in ROLE_PERMISSIONS[self.role]

    def require(self, permission: Permission) -> None:
        if not self.can(permission):
            raise AppError(403, "forbidden", "You do not have permission to do that in this project.")


def project_not_found() -> AppError:
    return AppError(404, "project_not_found", "That project does not exist or you do not have access to it.")


def accessible_project_ids(user: User):
    """A SELECT of the ids of every live project the user can see."""
    member_of = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
    return select(Project.id).where(
        Project.deleted_at.is_(None),
        or_(Project.owner_id == user.id, Project.id.in_(member_of)),
    )


def find_access(db: Session, user: User, project_id: int) -> ProjectAccess | None:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        return None
    if project.owner_id == user.id:
        return ProjectAccess(project, user, AccessRole.owner)
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
        )
    )
    if member is None:
        return None
    return ProjectAccess(project, user, AccessRole(member.role))


def get_access(db: Session, user: User, project_id: int, permission: Permission = Permission.view) -> ProjectAccess:
    access = find_access(db, user, project_id)
    if access is None:
        raise project_not_found()
    access.require(permission)
    return access
