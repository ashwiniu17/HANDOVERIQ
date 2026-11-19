from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..domain import HandoverStatus, ProjectStatus
from ..models import Handover, Project, User
from ..schemas.dashboard import DashboardOut, DashboardStats
from ..schemas.project import ActivityOut
from . import activity, projects
from .access import accessible_project_ids


def build_dashboard(db: Session, user: User) -> DashboardOut:
    visible = accessible_project_ids(user)

    total = db.scalar(select(func.count()).select_from(Project).where(Project.id.in_(visible))) or 0
    active = db.scalar(
        select(func.count()).select_from(Project).where(Project.id.in_(visible), Project.status == ProjectStatus.active.value)
    ) or 0
    handover_counts = dict(
        db.execute(select(Handover.status, func.count()).where(Handover.project_id.in_(visible)).group_by(Handover.status)).all()
    )
    completed = handover_counts.get(HandoverStatus.completed.value, 0)
    pending = handover_counts.get(HandoverStatus.draft.value, 0) + handover_counts.get(HandoverStatus.in_review.value, 0)

    return DashboardOut(
        stats=DashboardStats(
            total_projects=total, active_projects=active, completed_handovers=completed, pending_handovers=pending
        ),
        recent_projects=projects.list_projects(db, user, limit=5),
        recent_activity=[
            ActivityOut(
                id=a.id, project_id=a.project_id, project_name=name, actor_name=a.actor_name, action=a.action,
                message=a.message, entity_type=a.entity_type, entity_id=a.entity_id, created_at=a.created_at,
            )
            for a, name in activity.list_for_user(db, user)
        ],
    )
