from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from pathlib import PurePosixPath, PureWindowsPath

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.errors import AppError
from ..domain import AnalysisStatus, Permission, ProcessingStatus
from ..models import Document, DocumentFile, KnowledgeItem
from ..schemas.document import DocumentOut, DocumentTextOut
from . import activity
from .access import ProjectAccess
from .extraction import ExtractionError, extract_text

logger = logging.getLogger("handoveriq.documents")

ALLOWED_TYPES = {"pdf", "docx", "txt", "md"}
CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
}
PREVIEW_CHARS = 30_000


def clean_filename(raw: str | None) -> str:
    """Keep only the file's own name: no folders, no control characters."""
    name = PureWindowsPath(PurePosixPath(raw or "").name).name
    name = unicodedata.normalize("NFC", name)
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip().strip(".")
    return name[:255]


def _validate_signature(file_type: str, data: bytes) -> None:
    """Check the bytes really are what the extension claims."""
    problem = AppError(422, "invalid_file", f"This file does not look like a real .{file_type} file.")
    if file_type == "pdf" and not data.lstrip()[:5] == b"%PDF-":
        raise problem
    if file_type == "docx" and not data.startswith(b"PK"):
        raise problem
    if file_type in {"txt", "md"}:
        is_utf16 = data.startswith((b"\xff\xfe", b"\xfe\xff"))
        if b"\x00" in data and not is_utf16:
            raise problem  # a binary file renamed to .txt


def read_upload(upload: UploadFile) -> tuple[str, str, bytes]:
    """Validate an upload and return (filename, file_type, bytes)."""
    filename = clean_filename(upload.filename)
    if not filename:
        raise AppError(422, "invalid_file", "The file needs a name.")
    file_type = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if file_type not in ALLOWED_TYPES:
        raise AppError(422, "unsupported_file_type", "Upload a PDF, Word (.docx), text (.txt) or Markdown (.md) file.")

    limit = settings.max_upload_mb * 1024 * 1024
    data = upload.file.read(limit + 1)  # one byte more than allowed, to detect oversize
    if len(data) > limit:
        raise AppError(413, "file_too_large", f"Files can be at most {settings.max_upload_mb} MB.")
    if not data.strip():
        raise AppError(422, "empty_file", "This file is empty.")
    _validate_signature(file_type, data)
    return filename, file_type, data


def _knowledge_counts(db: Session, document_ids: list[int]) -> dict[int, int]:
    if not document_ids:
        return {}
    return dict(
        db.execute(
            select(KnowledgeItem.document_id, func.count())
            .where(KnowledgeItem.document_id.in_(document_ids))
            .group_by(KnowledgeItem.document_id)
        ).all()
    )


def to_out(document: Document, knowledge_count: int = 0) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        project_id=document.project_id,
        filename=document.filename,
        file_type=document.file_type,
        size_bytes=document.size_bytes,
        processing_status=document.processing_status,
        processing_error=document.processing_error,
        char_count=document.char_count,
        page_count=document.page_count,
        analysis_status=document.analysis_status,
        analysis_error=document.analysis_error,
        last_analyzed_at=document.last_analyzed_at,
        uploaded_by_name=document.uploaded_by.full_name if document.uploaded_by else None,
        knowledge_count=knowledge_count,
        created_at=document.created_at,
    )


def list_documents(db: Session, project_id: int) -> list[DocumentOut]:
    documents = list(
        db.scalars(select(Document).where(Document.project_id == project_id).order_by(Document.created_at.desc(), Document.id.desc()))
    )
    counts = _knowledge_counts(db, [d.id for d in documents])
    return [to_out(d, counts.get(d.id, 0)) for d in documents]


def upload_document(db: Session, access: ProjectAccess, upload: UploadFile) -> DocumentOut:
    access.require(Permission.edit)
    project_id = access.project.id

    current = db.scalar(select(func.count()).select_from(Document).where(Document.project_id == project_id)) or 0
    if current >= settings.max_documents_per_project:
        raise AppError(409, "document_limit", f"A project can hold at most {settings.max_documents_per_project} documents.")

    filename, file_type, data = read_upload(upload)
    digest = hashlib.sha256(data).hexdigest()
    duplicate = db.scalar(select(Document.filename).where(Document.project_id == project_id, Document.sha256 == digest))
    if duplicate:
        raise AppError(409, "duplicate_document", f"This exact file is already in the project as “{duplicate}”.")

    document = Document(
        project_id=project_id,
        uploaded_by_id=access.user.id,
        filename=filename,
        file_type=file_type,
        size_bytes=len(data),
        sha256=digest,
        processing_status=ProcessingStatus.processing.value,
    )
    document.file = DocumentFile(content=data)
    db.add(document)
    db.flush()

    try:
        extracted = extract_text(file_type, data)
    except ExtractionError as exc:
        document.processing_status = ProcessingStatus.failed.value
        document.processing_error = str(exc)
    except Exception:  # noqa: BLE001 - never let a parser bug take the upload down
        logger.exception("Unexpected extraction failure for document %s", document.id)
        document.processing_status = ProcessingStatus.failed.value
        document.processing_error = "The text of this file could not be read."
    else:
        document.processing_status = ProcessingStatus.processed.value
        document.extracted_text = extracted.text
        document.char_count = len(extracted.text)
        document.page_count = extracted.page_count

    activity.record(
        db, project_id, access.user,
        "document.uploaded" if document.processing_status == "processed" else "document.failed",
        f"Uploaded “{filename}”." if document.processing_status == "processed"
        else f"Uploaded “{filename}”, but its text could not be read.",
        "document", document.id,
    )
    try:
        db.commit()
    except IntegrityError:  # the same file uploaded twice at the same moment
        db.rollback()
        raise AppError(409, "duplicate_document", "This exact file is already in the project.")
    return to_out(document)


def get_document(db: Session, access: ProjectAccess, document_id: int) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.project_id != access.project.id:
        raise AppError(404, "document_not_found", "That document does not exist in this project.")
    return document


def delete_document(db: Session, access: ProjectAccess, document_id: int) -> None:
    access.require(Permission.edit)
    document = get_document(db, access, document_id)
    name = document.filename
    # Knowledge items already extracted keep their text; they just lose the link.
    for item in db.scalars(select(KnowledgeItem).where(KnowledgeItem.document_id == document.id)):
        item.document_id = None
    db.delete(document)
    activity.record(db, access.project.id, access.user, "document.deleted", f"Deleted “{name}”.", "document", document_id)
    db.commit()


def read_text(db: Session, access: ProjectAccess, document_id: int) -> DocumentTextOut:
    document = get_document(db, access, document_id)
    text = document.extracted_text or ""
    return DocumentTextOut(
        id=document.id,
        filename=document.filename,
        text=text[:PREVIEW_CHARS],
        total_chars=len(text),
        truncated=len(text) > PREVIEW_CHARS,
    )


def read_file(db: Session, access: ProjectAccess, document_id: int) -> tuple[Document, bytes]:
    document = get_document(db, access, document_id)
    if document.file is None:
        raise AppError(404, "file_missing", "The stored file could not be found.")
    return document, document.file.content


def reset_analysis(document: Document) -> None:
    document.analysis_status = AnalysisStatus.not_analyzed.value
    document.analysis_error = None
