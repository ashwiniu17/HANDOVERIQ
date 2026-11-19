from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.errors import AppError
from ..domain import SECTION_TITLES, HandoverStatus, MemberRole, Permission, SectionType
from ..models import Handover, HandoverSection, ProjectMember, User
from ..schemas.handover import HandoverOut, SectionOut, SectionUpdate
from . import activity
from .access import ProjectAccess

SECTION_ORDER = list(SectionType)


def find_handover(db: Session, project_id: int) -> Handover | None:
    return db.scalar(select(Handover).where(Handover.project_id == project_id))


def get_handover(db: Session, project_id: int) -> Handover:
    handover = find_handover(db, project_id)
    if handover is None:
        raise AppError(404, "handover_not_found", "This project has no handover yet.")
    return handover


def _user_name(db: Session, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = db.get(User, user_id)
    return user.full_name if user else None


def serialize(db: Session, handover: Handover) -> HandoverOut:
    by_type = {section.section_type: section for section in handover.sections}
    sections = [
        SectionOut(
            section_type=section_type,
            title=SECTION_TITLES[section_type],
            content=by_type[section_type.value].content,
            is_complete=by_type[section_type.value].is_complete,
            updated_at=by_type[section_type.value].updated_at,
        )
        for section_type in SECTION_ORDER
        if section_type.value in by_type
    ]
    done = sum(1 for section in sections if section.is_complete)
    return HandoverOut(
        id=handover.id,
        project_id=handover.project_id,
        status=handover.status,
        progress=round(100 * done / len(SECTION_ORDER)),
        completed_sections=done,
        total_sections=len(SECTION_ORDER),
        sections=sections,
        created_at=handover.created_at,
        updated_at=handover.updated_at,
        completed_at=handover.completed_at,
        completed_by_name=_user_name(db, handover.completed_by_id),
        acknowledged_at=handover.acknowledged_at,
        acknowledged_by_name=_user_name(db, handover.acknowledged_by_id),
    )


def create_handover(db: Session, access: ProjectAccess) -> Handover:
    access.require(Permission.edit)
    if find_handover(db, access.project.id) is not None:
        raise AppError(409, "handover_exists", "This project already has a handover.")
    return _create(db, access)


def ensure_handover(db: Session, access: ProjectAccess) -> Handover:
    """Return the project's handover, creating an empty one if there is none."""
    existing = find_handover(db, access.project.id)
    if existing is not None:
        return existing
    access.require(Permission.edit)
    return _create(db, access)


def _create(db: Session, access: ProjectAccess) -> Handover:
    handover = Handover(project_id=access.project.id, created_by_id=access.user.id)
    handover.sections = [HandoverSection(section_type=t.value, content="") for t in SECTION_ORDER]
    db.add(handover)
    activity.record(db, access.project.id, access.user, "handover.created", "Started the handover.", "handover")
    try:
        db.commit()
    except IntegrityError:  # created at the same moment by someone else
        db.rollback()
        existing = find_handover(db, access.project.id)
        if existing is None:
            raise
        return existing
    return handover


def _require_unlocked(handover: Handover) -> None:
    if handover.status == HandoverStatus.completed.value:
        raise AppError(409, "handover_locked", "This handover is completed. Reopen it to make changes.")


def get_section(handover: Handover, section_type: SectionType) -> HandoverSection:
    for section in handover.sections:
        if section.section_type == section_type.value:
            return section
    raise AppError(404, "section_not_found", "That section does not exist.")


def update_section(
    db: Session, access: ProjectAccess, handover: Handover, section_type: SectionType, data: SectionUpdate
) -> Handover:
    access.require(Permission.edit)
    _require_unlocked(handover)
    section = get_section(handover, section_type)

    content_changed = data.content is not None and data.content.strip() != section.content.strip()
    if data.content is not None:
        section.content = data.content.strip()
    if data.is_complete is not None:
        section.is_complete = data.is_complete
    elif content_changed:
        # Edited after being marked complete: it needs another look.
        section.is_complete = False

    if section.is_complete and not section.content:
        raise AppError(
            422,
            "section_empty",
            "Write something before marking this section complete. If there is nothing to add, say so (for example “No known issues.”).",
            [{"field": "content", "message": "This section is empty."}],
        )

    section.updated_by_id = access.user.id
    handover.updated_at = datetime.now(timezone.utc)
    title = SECTION_TITLES[section_type]
    activity.record(
        db, access.project.id, access.user, "handover.section_updated",
        f"Marked “{title}” complete." if data.is_complete else f"Updated “{title}”.",
        "handover", handover.id,
    )
    db.commit()
    return handover


def _incomplete_titles(handover: Handover) -> list[str]:
    return [SECTION_TITLES[t] for t in SECTION_ORDER if not get_section(handover, t).is_complete]


def submit_for_review(db: Session, access: ProjectAccess, handover: Handover) -> Handover:
    access.require(Permission.edit)
    if handover.status != HandoverStatus.draft.value:
        raise AppError(409, "invalid_transition", "Only a draft handover can be sent for review.")
    handover.status = HandoverStatus.in_review.value
    activity.record(db, access.project.id, access.user, "handover.in_review", "Sent the handover for review.", "handover", handover.id)
    db.commit()
    return handover


def complete(db: Session, access: ProjectAccess, handover: Handover) -> Handover:
    access.require(Permission.edit)
    if handover.status == HandoverStatus.completed.value:
        raise AppError(409, "invalid_transition", "This handover is already completed.")
    missing = _incomplete_titles(handover)
    if missing:
        raise AppError(
            409,
            "handover_incomplete",
            "Mark every section complete before completing the handover.",
            {"incomplete_sections": missing},
        )
    handover.status = HandoverStatus.completed.value
    handover.completed_at = datetime.now(timezone.utc)
    handover.completed_by_id = access.user.id
    handover.acknowledged_at = None
    handover.acknowledged_by_id = None
    activity.record(db, access.project.id, access.user, "handover.completed", "Completed the handover.", "handover", handover.id)
    db.commit()
    return handover


def reopen(db: Session, access: ProjectAccess, handover: Handover) -> Handover:
    access.require(Permission.manage)
    if handover.status != HandoverStatus.completed.value:
        raise AppError(409, "invalid_transition", "Only a completed handover can be reopened.")
    handover.status = HandoverStatus.draft.value
    handover.completed_at = None
    handover.completed_by_id = None
    handover.acknowledged_at = None
    handover.acknowledged_by_id = None
    activity.record(db, access.project.id, access.user, "handover.reopened", "Reopened the handover.", "handover", handover.id)
    db.commit()
    return handover


def acknowledge(db: Session, access: ProjectAccess, handover: Handover) -> Handover:
    """The incoming member confirms they have received and read the handover."""
    is_incoming = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == access.project.id,
            ProjectMember.user_id == access.user.id,
            ProjectMember.role == MemberRole.incoming.value,
        )
    )
    if is_incoming is None:
        raise AppError(403, "forbidden", "Only the incoming member can acknowledge the handover.")
    if handover.status != HandoverStatus.completed.value:
        raise AppError(409, "invalid_transition", "The handover can be acknowledged once it is completed.")
    if handover.acknowledged_at is not None:
        raise AppError(409, "already_acknowledged", "You have already acknowledged this handover.")
    handover.acknowledged_at = datetime.now(timezone.utc)
    handover.acknowledged_by_id = access.user.id
    activity.record(db, access.project.id, access.user, "handover.acknowledged", "Acknowledged the handover.", "handover", handover.id)
    db.commit()
    return handover
