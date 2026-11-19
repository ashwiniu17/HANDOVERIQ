from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Query, Response

from ...schemas.report import ReportCreate, ReportDetail, ReportOut
from ...services import reports as report_service
from ..deps import DbSession, EditAccess, ViewAccess
from .documents import content_disposition

router = APIRouter(prefix="/projects/{project_id}/reports", tags=["Reports"])


@router.get("", response_model=list[ReportOut], summary="Report history")
def list_reports(access: ViewAccess, db: DbSession):
    return report_service.list_reports(db, access.project.id)


@router.post("", response_model=ReportOut, status_code=201, summary="Generate a report from the current handover")
def create_report(data: ReportCreate, access: EditAccess, db: DbSession):
    return report_service.create_report(db, access, data)


@router.get("/{report_id}", response_model=ReportDetail, summary="Get a report")
def get_report(report_id: int, access: ViewAccess, db: DbSession):
    return report_service.report_detail(db, report_service.get_report(db, access, report_id))


@router.get("/{report_id}/export", summary="Download a report as PDF or Markdown")
def export_report(
    report_id: int,
    access: ViewAccess,
    db: DbSession,
    format: Literal["pdf", "md"] = Query("pdf"),
):
    report = report_service.get_report(db, access, report_id)
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", f"{access.project.name}-report-v{report.version}").strip("-") or "report"
    if format == "pdf":
        content, media_type = report_service.render_pdf(report), "application/pdf"
    else:
        content, media_type = report_service.render_markdown(report).encode("utf-8"), "text/markdown; charset=utf-8"
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": content_disposition(f"{base}.{format}"),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
