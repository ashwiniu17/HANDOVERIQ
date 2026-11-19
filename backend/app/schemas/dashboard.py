from __future__ import annotations

from .common import OutputModel
from .project import ActivityOut, ProjectOut


class DashboardStats(OutputModel):
    total_projects: int
    active_projects: int
    completed_handovers: int
    pending_handovers: int


class DashboardOut(OutputModel):
    stats: DashboardStats
    recent_projects: list[ProjectOut]
    recent_activity: list[ActivityOut]
