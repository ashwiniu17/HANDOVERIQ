from __future__ import annotations

from fastapi import APIRouter

from ...schemas.dashboard import DashboardOut
from ...services import dashboard as dashboard_service
from ..deps import CurrentUser, DbSession

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard", response_model=DashboardOut, summary="Dashboard numbers, recent projects and activity")
def dashboard(user: CurrentUser, db: DbSession):
    return dashboard_service.build_dashboard(db, user)
