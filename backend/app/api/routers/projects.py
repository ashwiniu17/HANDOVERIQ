from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response

from ...domain import ProjectStatus
from ...schemas.project import (
    ActivityOut,
    MemberCreate,
    MemberOut,
    MemberUpdate,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
)
from ...services import activity, members, projects
from ...services.access import get_access
from ..deps import CurrentUser, DbSession, EditAccess, ManageAccess, ProjectId, ViewAccess

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectOut], summary="List your projects")
def list_projects(
    user: CurrentUser,
    db: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: ProjectStatus | None = None,
):
    return projects.list_projects(db, user, search=search, status=status.value if status else None)


@router.post("", response_model=ProjectOut, status_code=201, summary="Create a project")
def create_project(data: ProjectCreate, user: CurrentUser, db: DbSession):
    project = projects.create_project(db, user, data)
    return projects.serialize(db, get_access(db, user, project.id))


@router.get("/{project_id}", response_model=ProjectOut, summary="Get a project")
def get_project(access: ViewAccess, db: DbSession):
    return projects.serialize(db, access)


@router.patch("/{project_id}", response_model=ProjectOut, summary="Update a project")
def update_project(data: ProjectUpdate, access: EditAccess, db: DbSession):
    projects.update_project(db, access, data)
    return projects.serialize(db, access)


@router.delete("/{project_id}", status_code=204, summary="Delete a project (owner only)")
def delete_project(access: ManageAccess, db: DbSession):
    projects.delete_project(db, access)
    return Response(status_code=204)


# ---- members ---------------------------------------------------------------

@router.get("/{project_id}/members", response_model=list[MemberOut], summary="List project members")
def list_members(access: ViewAccess, db: DbSession):
    return members.list_members(db, access)


@router.post("/{project_id}/members", response_model=MemberOut, status_code=201, summary="Add a member (owner only)")
def add_member(data: MemberCreate, access: ManageAccess, db: DbSession):
    return members.add_member(db, access, data)


@router.patch("/{project_id}/members/{member_id}", response_model=MemberOut, summary="Change a member's role (owner only)")
def change_member_role(member_id: int, data: MemberUpdate, access: ManageAccess, db: DbSession):
    return members.change_role(db, access, member_id, data.role)


@router.delete("/{project_id}/members/{member_id}", status_code=204, summary="Remove a member (owner only)")
def remove_member(member_id: int, access: ManageAccess, db: DbSession):
    members.remove_member(db, access, member_id)
    return Response(status_code=204)


# ---- activity --------------------------------------------------------------

@router.get("/{project_id}/activity", response_model=list[ActivityOut], summary="Recent activity in a project")
def project_activity(access: ViewAccess, db: DbSession):
    return [
        ActivityOut(
            id=a.id, project_id=a.project_id, project_name=access.project.name, actor_name=a.actor_name,
            action=a.action, message=a.message, entity_type=a.entity_type, entity_id=a.entity_id, created_at=a.created_at,
        )
        for a in activity.list_for_project(db, access.project.id)
    ]
