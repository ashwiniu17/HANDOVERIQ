from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.errors import AppError
from ..domain import AccessRole, MemberRole, Permission
from ..models import ProjectMember, User
from ..schemas.project import MemberCreate, MemberOut
from . import activity
from .access import ProjectAccess
from .auth import normalize_email

ROLE_LABEL = {
    MemberRole.outgoing: "outgoing member",
    MemberRole.incoming: "incoming member",
    MemberRole.collaborator: "collaborator",
}


def _ensure_role_free(db: Session, project_id: int, role: MemberRole, ignore_member_id: int | None = None) -> None:
    """A project has at most one outgoing and one incoming member."""
    if role == MemberRole.collaborator:
        return
    query = select(ProjectMember.id).where(ProjectMember.project_id == project_id, ProjectMember.role == role.value)
    existing = db.scalar(query)
    if existing is not None and existing != ignore_member_id:
        raise AppError(
            409,
            "role_taken",
            f"This project already has an {ROLE_LABEL[role]}. Remove them or change their role first.",
        )


def list_members(db: Session, access: ProjectAccess) -> list[MemberOut]:
    owner = access.project.owner
    result = [
        MemberOut(
            id=None,
            name=owner.full_name,
            email=owner.email,
            role=AccessRole.owner,
            is_owner=True,
            has_account=True,
            created_at=access.project.created_at,
        )
    ]
    rows = db.scalars(
        select(ProjectMember).where(ProjectMember.project_id == access.project.id).order_by(ProjectMember.id)
    )
    for member in rows:
        result.append(
            MemberOut(
                id=member.id,
                name=member.name,
                email=member.email,
                role=AccessRole(member.role),
                has_account=member.user_id is not None,
                created_at=member.created_at,
            )
        )
    return result


def _out(member: ProjectMember) -> MemberOut:
    return MemberOut(
        id=member.id,
        name=member.name,
        email=member.email,
        role=AccessRole(member.role),
        has_account=member.user_id is not None,
        created_at=member.created_at,
    )


def add_member(db: Session, access: ProjectAccess, data: MemberCreate) -> MemberOut:
    access.require(Permission.manage)
    email = normalize_email(data.email)
    if "@" not in email or email.startswith("@") or email.endswith("@") or " " in email:
        raise AppError(422, "validation_error", "Enter a valid e-mail address.", [
            {"field": "email", "message": "Enter a valid e-mail address."}
        ])

    if db.scalar(
        select(ProjectMember.id).where(ProjectMember.project_id == access.project.id, ProjectMember.email == email)
    ):
        raise AppError(409, "member_exists", "That person is already a member of this project.")
    _ensure_role_free(db, access.project.id, data.role)

    account = db.scalar(select(User).where(User.email == email))
    name = data.name or (account.full_name if account else email.split("@")[0])
    member = ProjectMember(
        project_id=access.project.id,
        user_id=account.id if account else None,
        email=email,
        name=name,
        role=data.role.value,
    )
    db.add(member)
    db.flush()
    activity.record(
        db, access.project.id, access.user, "member.added",
        f"Added {name} as {ROLE_LABEL[data.role]}.", "member", member.id,
    )
    db.commit()
    return _out(member)


def _get_member(db: Session, access: ProjectAccess, member_id: int) -> ProjectMember:
    member = db.get(ProjectMember, member_id)
    if member is None or member.project_id != access.project.id:
        raise AppError(404, "member_not_found", "That member does not exist in this project.")
    return member


def change_role(db: Session, access: ProjectAccess, member_id: int, role: MemberRole) -> MemberOut:
    access.require(Permission.manage)
    member = _get_member(db, access, member_id)
    _ensure_role_free(db, access.project.id, role, ignore_member_id=member.id)
    member.role = role.value
    activity.record(
        db, access.project.id, access.user, "member.role_changed",
        f"Changed {member.name} to {ROLE_LABEL[role]}.", "member", member.id,
    )
    db.commit()
    return _out(member)


def remove_member(db: Session, access: ProjectAccess, member_id: int) -> None:
    access.require(Permission.manage)
    member = _get_member(db, access, member_id)
    activity.record(
        db, access.project.id, access.user, "member.removed",
        f"Removed {member.name} from the project.", "member", member.id,
    )
    db.delete(member)
    db.commit()
