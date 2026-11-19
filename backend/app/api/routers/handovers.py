from __future__ import annotations

from fastapi import APIRouter

from ...domain import SectionType
from ...schemas.handover import HandoverOut, SectionUpdate
from ...services import handovers as handover_service
from ..deps import DbSession, EditAccess, ManageAccess, ViewAccess

router = APIRouter(prefix="/projects/{project_id}/handover", tags=["Handover"])


@router.get("", response_model=HandoverOut, summary="Get the project's handover")
def get_handover(access: ViewAccess, db: DbSession):
    return handover_service.serialize(db, handover_service.get_handover(db, access.project.id))


@router.post("", response_model=HandoverOut, status_code=201, summary="Start the handover")
def create_handover(access: EditAccess, db: DbSession):
    return handover_service.serialize(db, handover_service.create_handover(db, access))


@router.put("/sections/{section_type}", response_model=HandoverOut, summary="Edit a handover section")
def update_section(section_type: SectionType, data: SectionUpdate, access: EditAccess, db: DbSession):
    handover = handover_service.get_handover(db, access.project.id)
    return handover_service.serialize(db, handover_service.update_section(db, access, handover, section_type, data))


@router.post("/submit-review", response_model=HandoverOut, summary="Send the handover for review")
def submit_review(access: EditAccess, db: DbSession):
    handover = handover_service.get_handover(db, access.project.id)
    return handover_service.serialize(db, handover_service.submit_for_review(db, access, handover))


@router.post("/complete", response_model=HandoverOut, summary="Mark the handover completed")
def complete(access: EditAccess, db: DbSession):
    handover = handover_service.get_handover(db, access.project.id)
    return handover_service.serialize(db, handover_service.complete(db, access, handover))


@router.post("/reopen", response_model=HandoverOut, summary="Reopen a completed handover (owner only)")
def reopen(access: ManageAccess, db: DbSession):
    handover = handover_service.get_handover(db, access.project.id)
    return handover_service.serialize(db, handover_service.reopen(db, access, handover))


@router.post("/acknowledge", response_model=HandoverOut, summary="Incoming member confirms receipt")
def acknowledge(access: ViewAccess, db: DbSession):
    handover = handover_service.get_handover(db, access.project.id)
    return handover_service.serialize(db, handover_service.acknowledge(db, access, handover))
