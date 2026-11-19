from __future__ import annotations

import io
import re
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.errors import AppError
from ..domain import SECTION_TITLES, MemberRole, Permission, SectionType
from ..models import Document, Handover, ProjectMember, Report, User
from ..schemas.report import ReportCreate, ReportDetail, ReportOut
from . import activity, handovers
from .access import ProjectAccess


# ---- creating --------------------------------------------------------------

def _person(member: ProjectMember | None) -> dict | None:
    return {"name": member.name, "email": member.email} if member else None


def build_snapshot(db: Session, access: ProjectAccess, handover: Handover) -> dict:
    out = handovers.serialize(db, handover)
    members = list(db.scalars(select(ProjectMember).where(ProjectMember.project_id == access.project.id).order_by(ProjectMember.id)))
    by_role = {role: next((m for m in members if m.role == role.value), None) for role in MemberRole}
    documents = list(db.scalars(select(Document).where(Document.project_id == access.project.id).order_by(Document.created_at)))
    owner = access.project.owner
    return {
        "project": {
            "id": access.project.id,
            "name": access.project.name,
            "description": access.project.description,
            "status": access.project.status,
            "owner": owner.full_name,
        },
        "handover": {
            "status": out.status.value,
            "progress": out.progress,
            "completed_at": out.completed_at.isoformat() if out.completed_at else None,
            "completed_by": out.completed_by_name,
            "acknowledged_at": out.acknowledged_at.isoformat() if out.acknowledged_at else None,
            "acknowledged_by": out.acknowledged_by_name,
        },
        "outgoing_member": _person(by_role[MemberRole.outgoing]),
        "incoming_member": _person(by_role[MemberRole.incoming]),
        "members": [{"name": m.name, "email": m.email, "role": m.role} for m in members],
        "sections": [
            {
                "section_type": s.section_type.value,
                "title": s.title,
                "content": s.content,
                "is_complete": s.is_complete,
            }
            for s in out.sections
        ],
        "documents": [{"filename": d.filename, "file_type": d.file_type} for d in documents],
    }


def _to_out(db: Session, report: Report) -> ReportOut:
    creator = db.get(User, report.created_by_id) if report.created_by_id else None
    handover_info = report.snapshot.get("handover", {})
    return ReportOut(
        id=report.id,
        project_id=report.project_id,
        version=report.version,
        title=report.title,
        created_by_name=creator.full_name if creator else None,
        created_at=report.created_at,
        handover_status=handover_info.get("status"),
        progress=handover_info.get("progress", 0),
    )


def create_report(db: Session, access: ProjectAccess, data: ReportCreate) -> ReportOut:
    access.require(Permission.edit)
    handover = handovers.find_handover(db, access.project.id)
    if handover is None:
        raise AppError(409, "handover_required", "Start the handover before generating a report.")

    version = (db.scalar(select(func.max(Report.version)).where(Report.project_id == access.project.id)) or 0) + 1
    report = Report(
        project_id=access.project.id,
        handover_id=handover.id,
        version=version,
        title=data.title or f"{access.project.name} handover report",
        snapshot=build_snapshot(db, access, handover),
        created_by_id=access.user.id,
    )
    db.add(report)
    db.flush()
    activity.record(db, access.project.id, access.user, "report.created", f"Generated report v{version}.", "report", report.id)
    db.commit()
    return _to_out(db, report)


def list_reports(db: Session, project_id: int) -> list[ReportOut]:
    rows = db.scalars(select(Report).where(Report.project_id == project_id).order_by(Report.version.desc()))
    return [_to_out(db, report) for report in rows]


def get_report(db: Session, access: ProjectAccess, report_id: int) -> Report:
    report = db.get(Report, report_id)
    if report is None or report.project_id != access.project.id:
        raise AppError(404, "report_not_found", "That report does not exist in this project.")
    return report


def report_detail(db: Session, report: Report) -> ReportDetail:
    return ReportDetail(**_to_out(db, report).model_dump(), snapshot=report.snapshot)


# ---- Markdown export -------------------------------------------------------

def _fmt_date(value: str | datetime | None) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value.strftime("%d %b %Y, %H:%M UTC")


def render_markdown(report: Report) -> str:
    snap = report.snapshot
    project, handover = snap["project"], snap["handover"]
    lines = [f"# {report.title}", ""]
    lines += [
        f"- **Project:** {project['name']}",
        f"- **Report version:** {report.version}",
        f"- **Generated:** {_fmt_date(report.created_at)}",
        f"- **Handover status:** {handover['status'].replace('_', ' ')} ({handover['progress']}% of sections complete)",
    ]
    for label, key in (("Outgoing member", "outgoing_member"), ("Incoming member", "incoming_member")):
        person = snap.get(key)
        lines.append(f"- **{label}:** {person['name'] + ' <' + person['email'] + '>' if person else 'Not assigned'}")
    if handover.get("completed_at"):
        lines.append(f"- **Completed:** {_fmt_date(handover['completed_at'])}")
    if handover.get("acknowledged_at"):
        lines.append(f"- **Acknowledged by incoming member:** {_fmt_date(handover['acknowledged_at'])}")
    if project.get("description"):
        lines += ["", project["description"]]

    for section in snap["sections"]:
        lines += ["", f"## {section['title']}", "", section["content"].strip() or "_Nothing recorded._"]

    if snap.get("documents"):
        lines += ["", "## Source documents", ""]
        lines += [f"- {d['filename']}" for d in snap["documents"]]
    return "\n".join(lines).strip() + "\n"


# ---- PDF export ------------------------------------------------------------

# The built-in PDF fonts cover Western European text. Replace a few common
# characters outside that range so they do not print as empty boxes.
_PDF_REPLACEMENTS = {"\u2192": "->", "\u2190": "<-", "\u2713": "v", "\u2717": "x", "\u2022": "-", "\u00a0": " "}


def _pdf_text(text: str) -> str:
    for old, new in _PDF_REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


def _inline(text: str) -> str:
    """Escape XML, then turn **bold** and `code` into the tags ReportLab understands."""
    escaped = escape(_pdf_text(text))
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.+?)`", r'<font face="Courier">\1</font>', escaped)
    return escaped


def _section_flowables(content: str, body: ParagraphStyle) -> list:
    flowables: list = []
    bullets: list[str] = []

    def flush_bullets() -> None:
        if bullets:
            flowables.append(
                ListFlowable(
                    [ListItem(Paragraph(_inline(b), body), leftIndent=12) for b in bullets],
                    bulletType="bullet",
                    start="-",
                    leftIndent=12,
                )
            )
            bullets.clear()

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            flush_bullets()
            continue
        match = re.match(r"^[-*]\s+(.*)$", line)
        if match:
            bullets.append(match.group(1))
        else:
            flush_bullets()
            flowables.append(Paragraph(_inline(line), body))
    flush_bullets()
    return flowables or [Paragraph("<i>Nothing recorded.</i>", body)]


def render_pdf(report: Report) -> bytes:
    snap = report.snapshot
    project, handover = snap["project"], snap["handover"]

    styles = getSampleStyleSheet()
    ink = colors.HexColor("#1A1633")
    primary = colors.HexColor("#4F2FD0")
    muted = colors.HexColor("#6B6785")
    title = ParagraphStyle("T", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=ink, alignment=TA_LEFT, spaceAfter=4)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=primary, spaceBefore=14, spaceAfter=4)
    body = ParagraphStyle("B", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=14, textColor=ink, spaceAfter=4)
    small = ParagraphStyle("S", parent=body, fontSize=9, textColor=muted)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=_pdf_text(report.title), author="HANDOVERIQ",
    )

    def person(key: str) -> str:
        p = snap.get(key)
        return f"{p['name']} ({p['email']})" if p else "Not assigned"

    meta = [
        ["Project", _pdf_text(project["name"])],
        ["Report version", str(report.version)],
        ["Generated", _fmt_date(report.created_at)],
        ["Status", f"{handover['status'].replace('_', ' ')} - {handover['progress']}% of sections complete"],
        ["Outgoing member", _pdf_text(person("outgoing_member"))],
        ["Incoming member", _pdf_text(person("incoming_member"))],
    ]
    if handover.get("completed_at"):
        meta.append(["Completed", _fmt_date(handover["completed_at"])])
    if handover.get("acknowledged_at"):
        meta.append(["Acknowledged", _fmt_date(handover["acknowledged_at"])])
    table = Table([[Paragraph(escape(k), small), Paragraph(escape(v), body)] for k, v in meta], colWidths=[38 * mm, 132 * mm])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("TOPPADDING", (0, 0), (-1, -1), 2)]))

    story: list = [Paragraph(escape(_pdf_text(report.title)), title), table, Spacer(1, 4), HRFlowable(width="100%", color=colors.HexColor("#E4E1F0"))]
    if project.get("description"):
        story += [Spacer(1, 6), Paragraph(_inline(project["description"]), body)]
    for section in snap["sections"]:
        story.append(Paragraph(escape(section["title"]), h2))
        story += _section_flowables(section["content"], body)
    if snap.get("documents"):
        story.append(Paragraph("Source documents", h2))
        story += _section_flowables("\n".join(f"- {d['filename']}" for d in snap["documents"]), body)

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(muted)
        canvas.drawString(20 * mm, 10 * mm, "HANDOVERIQ")
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
