from __future__ import annotations

from typing import Annotated

import anthropic
from fastapi import APIRouter, Depends, Query, Response

from ...core.config import settings
from ...domain import KnowledgeCategory, KnowledgeStatus
from ...schemas.knowledge import (
    AIStatusOut,
    AnalysisRunOut,
    AnalyzeResult,
    ApplyRequest,
    ApplyResult,
    KnowledgeItemOut,
    KnowledgeUpdate,
)
from ...services import documents as document_service
from ...services import knowledge as knowledge_service
from ...services.ai.client import get_ai_client
from ..deps import CurrentUser, DbSession, EditAccess, ViewAccess

router = APIRouter(tags=["AI knowledge"])


@router.get("/ai/status", response_model=AIStatusOut, summary="Is AI analysis configured?")
def ai_status(_: CurrentUser):
    return AIStatusOut(configured=settings.ai_configured, model=settings.anthropic_model)


@router.post(
    "/projects/{project_id}/documents/{document_id}/analyze",
    response_model=AnalyzeResult,
    summary="Analyze a document with the AI",
)
def analyze_document(
    document_id: int,
    access: EditAccess,
    db: DbSession,
    client: Annotated[anthropic.Anthropic, Depends(get_ai_client)],
):
    run, document = knowledge_service.analyze_document(db, access, document_id, client)
    return AnalyzeResult(run=run, document=document_service.to_out(document))


@router.get("/projects/{project_id}/knowledge", response_model=list[KnowledgeItemOut], summary="List AI-extracted items")
def list_knowledge(
    access: ViewAccess,
    db: DbSession,
    category: KnowledgeCategory | None = None,
    status: KnowledgeStatus | None = None,
    document_id: Annotated[int | None, Query(ge=1)] = None,
):
    return knowledge_service.list_items(
        db, access.project.id,
        category=category.value if category else None,
        status=status.value if status else None,
        document_id=document_id,
    )


@router.post("/projects/{project_id}/knowledge/apply", response_model=ApplyResult, summary="Add reviewed items to the handover")
def apply_knowledge(data: ApplyRequest, access: EditAccess, db: DbSession):
    return knowledge_service.apply_items(db, access, data.item_ids)


@router.patch("/projects/{project_id}/knowledge/{item_id}", response_model=KnowledgeItemOut, summary="Review or edit an item")
def update_knowledge(item_id: int, data: KnowledgeUpdate, access: EditAccess, db: DbSession):
    return knowledge_service.update_item(db, access, item_id, data)


@router.delete("/projects/{project_id}/knowledge/{item_id}", status_code=204, summary="Delete an item")
def delete_knowledge(item_id: int, access: EditAccess, db: DbSession):
    knowledge_service.delete_item(db, access, item_id)
    return Response(status_code=204)


@router.get("/projects/{project_id}/analysis-runs", response_model=list[AnalysisRunOut], summary="AI analysis history")
def analysis_runs(access: ViewAccess, db: DbSession):
    return knowledge_service.list_runs(db, access.project.id)
