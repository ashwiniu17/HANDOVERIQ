from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Activity, Project, User
from .access import accessible_project_ids


def record(
    db: Session,
    project_id: int,
    user: User | None,
    action: str,
    message: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> None:
    """Add an entry to the project's activity feed (committed with the caller's work)."""
    db.add(
        Activity(
            project_id=project_id,
            user_id=user.id if user else None,
            actor_name=user.full_name if user else "System",
            action=action,
            message=message[:300],
            entity_type=entity_type,
            entity_id=entity_id,
        )
    )


def list_for_project(db: Session, project_id: int, limit: int = 50) -> list[Activity]:
    return list(
        db.scalars(
            select(Activity)
            .where(Activity.project_id == project_id)
            .order_by(Activity.created_at.desc(), Activity.id.desc())
            .limit(limit)
        )
    )


def list_for_user(db: Session, user: User, limit: int = 15) -> list[tuple[Activity, str]]:
    rows = db.execute(
        select(Activity, Project.name)
        .join(Project, Project.id == Activity.project_id)
        .where(Activity.project_id.in_(accessible_project_ids(user)))
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(limit)
    ).all()
    return [(activity, name) for activity, name in rows]
