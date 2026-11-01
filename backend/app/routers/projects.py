from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from ..database import get_db
from ..errors import AppError
from ..models import Project, utcnow
from ..schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])

# One database session per request, opened and closed by get_db.
DbSession = Annotated[Session, Depends(get_db)]

# Largest value a 32-bit INTEGER column (PostgreSQL) can hold. Rejecting larger
# IDs up front gives a clean 422 instead of a database error.
MAX_PROJECT_ID = 2_147_483_647
ProjectId = Annotated[int, Path(ge=1, le=MAX_PROJECT_ID)]

# The only fields an update may change. "status" is deliberately not here:
# it is controlled by the server, never copied from a request.
EDITABLE_FIELDS = ("name", "description", "outgoing_member", "incoming_member")


def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    """True if a project with this name exists (ignoring upper/lower case).

    Compares lower(name) on both sides in SQL, which is exactly what the
    unique index uq_projects_name_lower does, so the two can never disagree.
    When updating, pass exclude_id so a project is not a duplicate of itself.
    """
    stmt = select(Project.id).where(func.lower(Project.name) == func.lower(name))
    if exclude_id is not None:
        stmt = stmt.where(Project.id != exclude_id)
    return db.scalar(stmt.limit(1)) is not None


def _duplicate_name_error(name: str) -> AppError:
    return AppError(
        409,
        "duplicate_project_name",
        f'A project named "{name}" already exists. Project names are not case-sensitive.',
        details=[{"field": "name", "message": "This name is already used by another project."}],
    )


def _project_not_found(project_id: int) -> AppError:
    return AppError(404, "project_not_found", f"Project {project_id} was not found.")


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise _project_not_found(project_id)
    return project


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession) -> Project:
    if _name_taken(db, payload.name):
        raise _duplicate_name_error(payload.name)

    # The status is deliberately not set here: the model's default ("draft")
    # applies, and ProjectCreate does not even allow a client to send one.
    project = Project(
        name=payload.name,
        description=payload.description,
        outgoing_member=payload.outgoing_member,
        incoming_member=payload.incoming_member,
    )
    db.add(project)
    try:
        db.commit()
    except IntegrityError:
        # Safety net: two identical requests at the same moment can both pass
        # the check above, and the database's unique index rejects the second.
        db.rollback()
        if _name_taken(db, payload.name):
            raise _duplicate_name_error(payload.name) from None
        raise  # some other integrity problem: let the generic 500 handler deal with it
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: DbSession) -> list[Project]:
    # Newest first. Projects created at the same instant are ordered by id.
    stmt = select(Project).order_by(Project.created_at.desc(), Project.id.desc())
    return list(db.scalars(stmt).all())


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: ProjectId, db: DbSession) -> Project:
    return _get_project_or_404(db, project_id)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: ProjectId, payload: ProjectUpdate, db: DbSession) -> Project:
    project = _get_project_or_404(db, project_id)

    # A project is not a duplicate of itself, so it is excluded from the check.
    if _name_taken(db, payload.name, exclude_id=project_id):
        raise _duplicate_name_error(payload.name)

    # Full replacement: all four editable fields come from the request
    # (an omitted description therefore clears it). Only real changes are applied.
    changes = {
        field: getattr(payload, field)
        for field in EDITABLE_FIELDS
        if getattr(project, field) != getattr(payload, field)
    }
    if not changes:
        return project  # nothing differs, so nothing is written and updated_at stays as is

    for field, value in changes.items():
        setattr(project, field, value)
    project.updated_at = utcnow()  # timezone-aware UTC

    try:
        db.commit()
    except IntegrityError:
        # Safety net: another request took this name between our check and our save.
        db.rollback()
        if _name_taken(db, payload.name, exclude_id=project_id):
            raise _duplicate_name_error(payload.name) from None
        raise
    except StaleDataError:
        # Safety net: the project was deleted by another request while we were editing it.
        db.rollback()
        raise _project_not_found(project_id) from None
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: ProjectId, db: DbSession) -> Response:
    project = _get_project_or_404(db, project_id)
    db.delete(project)
    db.commit()
    # 204 means "done, and there is no body".
    return Response(status_code=status.HTTP_204_NO_CONTENT)