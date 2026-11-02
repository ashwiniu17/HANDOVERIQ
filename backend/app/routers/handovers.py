
from datetime import datetime, timezone

from fastapi import APIRouter, Response
from sqlalchemy import select

from ..errors import AppError
from ..models import Handover, Project
from ..handover_service import read_report, save_report
from .projects import DbSession, ProjectId, _get_project_or_404

router = APIRouter(prefix="/api/projects", tags=["handovers"])


def _get_handover(db: DbSession, project_id: int) -> Handover:
    handover = db.scalar(
        select(Handover).where(Handover.project_id == project_id)
    )

    if handover is None:
        raise AppError(
            404,
            "handover_not_found",
            "No handover has been generated for this project yet.",
        )

    return handover


def _report_markdown(handover: Handover) -> str:
    report = read_report(handover)

    lines = [
        f"# {report.get('title', 'Project Handover')}",
        "",
        f"**Generation mode:** {report.get('mode', 'UNKNOWN')}",
        f"**Generated:** {handover.generated_at.isoformat()}",
        "",
        "## Summary",
        "",
        report.get("summary", "No summary available."),
        "",
    ]

    notice = report.get("notice")

    if notice:
        lines.extend([
            "## Important notice",
            "",
            notice,
            "",
        ])

    for section in report.get("sections", []):
        lines.extend([
            f"## {section.get('name', 'Information')}",
            "",
        ])

        for claim in section.get("claims", []):
            lines.append(
                f"- **[{claim.get('status', 'UNSUPPORTED')}]** "
                f"{claim.get('text', '')}"
            )

            for source in claim.get("sources", []):
                document_name = source.get(
                    "document_name", "Unknown document"
                )
                location = source.get("location", "Unknown location")
                chunk_id = source.get("chunk_id", "Unknown")

                lines.append(
                    f"  - Source: {document_name} "
                    f"({location}, chunk {chunk_id})"
                )

        lines.append("")

    lines.extend([
        "## Missing information",
        "",
    ])

    missing_information = report.get("missing_information", [])

    if missing_information:
        for item in missing_information:
            lines.append(f"- {item}")
    else:
        lines.append("- No missing information recorded.")

    lines.extend([
        "",
        "## Contradictions",
        "",
    ])

    contradictions = report.get("contradictions", [])

    if contradictions:
        for item in contradictions:
            lines.append(f"- {item}")
    else:
        lines.append("- No contradictions have been identified.")

    lines.extend([
        "",
        "## Approval",
        "",
        (
            f"Approved at: {handover.approved_at.isoformat()}"
            if handover.approved_at
            else "Not approved."
        ),
        "",
    ])

    return "\n".join(lines)


@router.post("/{project_id}/handover/generate")
def generate_handover(project_id: ProjectId, db: DbSession):
    project = _get_project_or_404(db, project_id)

    handover = save_report(db, project_id)

    # A newly generated report must be reviewed and approved again.
    project.status = "draft"

    db.commit()
    db.refresh(handover)
    db.refresh(project)

    return {
        "message": "Handover generated successfully.",
        "handover_id": handover.id,
        "project_id": project_id,
        "model": handover.model,
        "generated_at": handover.generated_at,
        "approved": False,
        "report": read_report(handover),
    }


@router.get("/{project_id}/handover")
def get_handover(project_id: ProjectId, db: DbSession):
    _get_project_or_404(db, project_id)

    handover = _get_handover(db, project_id)

    return {
        "handover_id": handover.id,
        "project_id": project_id,
        "model": handover.model,
        "generated_at": handover.generated_at,
        "approved": handover.approved_at is not None,
        "approved_at": handover.approved_at,
        "report": read_report(handover),
    }


@router.post("/{project_id}/handover/approve")
def approve_handover(project_id: ProjectId, db: DbSession):
    project = _get_project_or_404(db, project_id)

    handover = _get_handover(db, project_id)

    if handover.approved_at is None:
        handover.approved_at = datetime.now(timezone.utc)

    # Update the project lifecycle status.
    project.status = "approved"

    db.commit()
    db.refresh(handover)
    db.refresh(project)

    return {
        "message": "Handover approved successfully.",
        "handover_id": handover.id,
        "project_id": project_id,
        "project_status": project.status,
        "approved": True,
        "approved_at": handover.approved_at,
    }


@router.get("/{project_id}/handover/export")
def export_handover(project_id: ProjectId, db: DbSession):
    _get_project_or_404(db, project_id)

    handover = _get_handover(db, project_id)

    if handover.approved_at is None:
        raise AppError(
            409,
            "approval_required",
            "Approve the handover before exporting it.",
        )

    markdown = _report_markdown(handover)

    return Response(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": (
                f'attachment; filename="handover-{project_id}.md"'
            )
        },
    )
