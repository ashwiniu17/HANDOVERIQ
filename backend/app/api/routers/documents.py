from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, File, Response, UploadFile

from ...schemas.document import DocumentOut, DocumentTextOut
from ...services import documents as document_service
from ...services.documents import CONTENT_TYPES
from ..deps import DbSession, EditAccess, ViewAccess

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["Documents"])


def content_disposition(filename: str) -> str:
    """An attachment header that survives non-ASCII file names."""
    ascii_name = filename.encode("ascii", "ignore").decode().replace('"', "") or "document"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


@router.get("", response_model=list[DocumentOut], summary="List a project's documents")
def list_documents(access: ViewAccess, db: DbSession):
    return document_service.list_documents(db, access.project.id)


@router.post("", response_model=DocumentOut, status_code=201, summary="Upload a document")
def upload_document(access: EditAccess, db: DbSession, file: UploadFile = File(...)):
    return document_service.upload_document(db, access, file)


@router.get("/{document_id}/text", response_model=DocumentTextOut, summary="Preview the extracted text")
def document_text(document_id: int, access: ViewAccess, db: DbSession):
    return document_service.read_text(db, access, document_id)


@router.get("/{document_id}/download", summary="Download the original file")
def download_document(document_id: int, access: ViewAccess, db: DbSession):
    document, content = document_service.read_file(db, access, document_id)
    return Response(
        content=content,
        media_type=CONTENT_TYPES[document.file_type],
        headers={
            "Content-Disposition": content_disposition(document.filename),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{document_id}", status_code=204, summary="Delete a document")
def delete_document(document_id: int, access: EditAccess, db: DbSession):
    document_service.delete_document(db, access, document_id)
    return Response(status_code=204)
