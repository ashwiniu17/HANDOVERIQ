from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import anthropic
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.errors import AppError
from ..db.base import utcnow
from ..domain import (
    CATEGORY_TO_SECTION,
    SECTION_TITLES,
    AnalysisStatus,
    KnowledgeCategory,
    KnowledgeStatus,
    Permission,
    ProcessingStatus,
    RunStatus,
    SectionType,
)
from ..models import AnalysisRun, Document, KnowledgeItem
from ..schemas.knowledge import ApplyResult, KnowledgeUpdate
from . import activity, documents as document_service, handovers
from .access import ProjectAccess
from .ai.analysis import ExtractionResult, extract_knowledge, normalize_for_match

logger = logging.getLogger("handoveriq.knowledge")


# ---- analysing a document --------------------------------------------------

def analyze_document(db: Session, access: ProjectAccess, document_id: int, client: anthropic.Anthropic) -> tuple[AnalysisRun, Document]:
    access.require(Permission.edit)
    document = document_service.get_document(db, access, document_id)

    if document.processing_status != ProcessingStatus.processed.value or not document.extracted_text:
        raise AppError(409, "document_not_ready", "This document's text could not be read, so it cannot be analyzed.")

    stale_after = timedelta(seconds=settings.ai_timeout_seconds * 3)
    if document.analysis_status == AnalysisStatus.analyzing.value and utcnow() - document.updated_at < stale_after:
        raise AppError(409, "analysis_running", "This document is already being analyzed. Wait for it to finish.")

    run = AnalysisRun(
        project_id=access.project.id,
        document_id=document.id,
        document_name=document.filename,
        requested_by_id=access.user.id,
        status=RunStatus.running.value,
        model=settings.anthropic_model,
    )
    db.add(run)
    document.analysis_status = AnalysisStatus.analyzing.value
    document.analysis_error = None
    db.commit()  # visible to other requests while the AI works

    try:
        result = extract_knowledge(
            client,
            project_name=access.project.name,
            document_name=document.filename,
            text=document.extracted_text,
        )
    except AppError as exc:
        _record_failure(db, access, document, run, exc.code, exc.message)
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure while analyzing document %s", document.id)
        _record_failure(db, access, document, run, "internal_error", "Something went wrong while analyzing this document.")
        raise AppError(500, "internal_error", "Something went wrong while analyzing this document.") from exc

    _save_result(db, access, document, run, result)
    return run, document


def _record_failure(db: Session, access: ProjectAccess, document: Document, run: AnalysisRun, code: str, message: str) -> None:
    db.rollback()
    run = db.merge(run)
    document = db.merge(document)
    run.status = RunStatus.failed.value
    run.error_code = code
    run.error_message = message
    run.finished_at = utcnow()
    document.analysis_status = AnalysisStatus.failed.value
    document.analysis_error = message
    activity.record(
        db, access.project.id, access.user, "analysis.failed",
        f"AI analysis of “{document.filename}” failed.", "document", document.id,
    )
    db.commit()


def _save_result(db: Session, access: ProjectAccess, document: Document, run: AnalysisRun, result: ExtractionResult) -> None:
    # Fresh suggestions replace old untouched ones from the same document.
    # Anything a person accepted, edited or rejected is kept.
    db.execute(
        delete(KnowledgeItem).where(
            KnowledgeItem.document_id == document.id,
            KnowledgeItem.status == KnowledgeStatus.suggested.value,
        )
    )
    kept = {
        normalize_for_match(content).lower()
        for content in db.scalars(select(KnowledgeItem.content).where(KnowledgeItem.project_id == access.project.id))
    }

    created = 0
    for entry in result.items:
        if normalize_for_match(entry.item.content).lower() in kept:
            continue  # already reviewed in an earlier run
        db.add(
            KnowledgeItem(
                project_id=access.project.id,
                document_id=document.id,
                run_id=run.id,
                source_name=document.filename,
                category=entry.item.category.value,
                title=entry.item.title,
                content=entry.item.content,
                source_quote=entry.item.source_quote or None,
                quote_verified=entry.quote_verified,
                confidence=entry.item.confidence.value,
                status=KnowledgeStatus.suggested.value,
            )
        )
        created += 1

    run.status = RunStatus.succeeded.value
    run.finished_at = utcnow()
    run.truncated = result.truncated
    run.input_tokens = result.input_tokens
    run.output_tokens = result.output_tokens
    run.items_created = created
    run.model = result.model
    document.analysis_status = AnalysisStatus.analyzed.value
    document.analysis_error = None
    document.last_analyzed_at = utcnow()
    activity.record(
        db, access.project.id, access.user, "analysis.completed",
        f"AI analyzed “{document.filename}” and found {created} item{'s' if created != 1 else ''} to review.",
        "document", document.id,
    )
    db.commit()


# ---- reviewing -------------------------------------------------------------

def list_items(
    db: Session,
    project_id: int,
    category: str | None = None,
    status: str | None = None,
    document_id: int | None = None,
) -> list[KnowledgeItem]:
    query = select(KnowledgeItem).where(KnowledgeItem.project_id == project_id)
    if category:
        query = query.where(KnowledgeItem.category == category)
    if status:
        query = query.where(KnowledgeItem.status == status)
    if document_id:
        query = query.where(KnowledgeItem.document_id == document_id)
    # In the order the AI found them, which follows the document.
    return list(db.scalars(query.order_by(KnowledgeItem.id)))


def get_item(db: Session, access: ProjectAccess, item_id: int) -> KnowledgeItem:
    item = db.get(KnowledgeItem, item_id)
    if item is None or item.project_id != access.project.id:
        raise AppError(404, "knowledge_not_found", "That item does not exist in this project.")
    return item


def update_item(db: Session, access: ProjectAccess, item_id: int, data: KnowledgeUpdate) -> KnowledgeItem:
    access.require(Permission.edit)
    item = get_item(db, access, item_id)
    if item.applied_at is not None:
        raise AppError(409, "item_applied", "This item is already in the handover. Edit the handover section instead.")

    content_changed = False
    if data.title is not None and data.title != item.title:
        item.title = data.title
        content_changed = True
    if data.content is not None and data.content != item.content:
        item.content = data.content
        content_changed = True

    if data.status is not None:
        item.status = data.status.value
    elif content_changed:
        item.status = KnowledgeStatus.edited.value
    db.commit()
    return item


def delete_item(db: Session, access: ProjectAccess, item_id: int) -> None:
    access.require(Permission.edit)
    db.delete(get_item(db, access, item_id))
    db.commit()


# ---- applying to the handover ----------------------------------------------

def _format_line(item: KnowledgeItem) -> str:
    source = f" (Source: {item.source_name})"
    if item.category == KnowledgeCategory.summary.value:
        return f"{item.content}{source}"
    return f"- **{item.title}**: {item.content}{source}"


def apply_items(db: Session, access: ProjectAccess, item_ids: list[int] | None) -> ApplyResult:
    access.require(Permission.edit)
    query = select(KnowledgeItem).where(
        KnowledgeItem.project_id == access.project.id,
        KnowledgeItem.applied_at.is_(None),
        KnowledgeItem.status.in_([KnowledgeStatus.accepted.value, KnowledgeStatus.edited.value]),
    )
    if item_ids is not None:
        query = query.where(KnowledgeItem.id.in_(item_ids))
    items = list(db.scalars(query.order_by(KnowledgeItem.id)))
    if not items:
        raise AppError(409, "nothing_to_apply", "There are no accepted items waiting to be added. Accept some items first.")

    handover = handovers.ensure_handover(db, access)
    if handover.status == "completed":
        raise AppError(409, "handover_locked", "This handover is completed. Reopen it to add more.")

    grouped: dict[SectionType, list[KnowledgeItem]] = {}
    for item in items:
        grouped.setdefault(CATEGORY_TO_SECTION[KnowledgeCategory(item.category)], []).append(item)

    now = datetime.now(timezone.utc)
    for section_type, section_items in grouped.items():
        section = handovers.get_section(handover, section_type)
        addition = "\n".join(_format_line(i) for i in section_items)
        section.content = f"{section.content.rstrip()}\n\n{addition}".strip()
        section.is_complete = False  # new text needs a human look
        section.updated_by_id = access.user.id
        for item in section_items:
            item.applied_at = now

    activity.record(
        db, access.project.id, access.user, "knowledge.applied",
        f"Added {len(items)} reviewed item{'s' if len(items) != 1 else ''} to the handover.", "handover", handover.id,
    )
    db.commit()
    return ApplyResult(applied_count=len(items), sections_updated=list(grouped.keys()))


def list_runs(db: Session, project_id: int, limit: int = 30) -> list[AnalysisRun]:
    return list(
        db.scalars(
            select(AnalysisRun)
            .where(AnalysisRun.project_id == project_id)
            .order_by(AnalysisRun.started_at.desc(), AnalysisRun.id.desc())
            .limit(limit)
        )
    )
