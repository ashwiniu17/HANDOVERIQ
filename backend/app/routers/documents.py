from typing import Annotated

from fastapi import APIRouter, File, Path, Response, UploadFile, status
from sqlalchemy import func, select

from ..config import settings
from ..errors import AppError
from ..extraction import ExtractionError, clean_filename, extract
from ..models import Chunk, Document
from ..schemas import ChunkRead, DocumentRead
from .projects import MAX_PROJECT_ID, DbSession, ProjectId, _get_project_or_404

router = APIRouter(prefix="/api/projects", tags=["documents"])

MAX_DOCUMENTS_PER_PROJECT = 20
DocumentId = Annotated[int, Path(ge=1, le=MAX_PROJECT_ID)]


@router.post(
    "/{project_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    project_id: ProjectId,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> Document:
    _get_project_or_404(db, project_id)

    count = db.scalar(
        select(func.count()).select_from(Document).where(Document.project_id == project_id)
    )
    if (count or 0) >= MAX_DOCUMENTS_PER_PROJECT:
        raise AppError(
            409,
            "document_limit_reached",
            f"A project can hold at most {MAX_DOCUMENTS_PER_PROJECT} documents.",
        )

    filename = clean_filename(file.filename or "")
    if not filename:
        raise AppError(422, "invalid_filename", "The uploaded file has no name.")

    already = db.scalar(
        select(Document.id)
        .where(Document.project_id == project_id)
        .where(func.lower(Document.filename) == filename[:255].lower())
        .limit(1)
    )
    if already is not None:
        raise AppError(
            409,
            "duplicate_document",
            f'A document named "{filename}" was already uploaded to this project.',
        )

    # Read at most one byte past the limit, which is enough to know it is too big.
    limit = settings.max_upload_mb * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise AppError(
            413,
            "file_too_large",
            f"This file is larger than the {settings.max_upload_mb} MB upload limit.",
        )

    try:
        result = extract(filename, data)
    except ExtractionError as exc:
        raise AppError(422, exc.code, exc.message) from None

    document = Document(
        project_id=project_id,
        filename=filename[:255],
        file_type=result.file_type,
        size_bytes=len(data),
        char_count=result.char_count,
        chunk_count=len(result.chunks),
    )
    db.add(document)
    db.flush()  # assigns document.id, needed for the chunks below
    db.add_all(
        Chunk(
            document_id=document.id,
            position=position,
            location=chunk.location[:100],
            text=chunk.text,
        )
        for position, chunk in enumerate(result.chunks, start=1)
    )
    db.commit()
    return document


@router.get("/{project_id}/documents", response_model=list[DocumentRead])
def list_documents(project_id: ProjectId, db: DbSession) -> list[Document]:
    _get_project_or_404(db, project_id)
    stmt = select(Document).where(Document.project_id == project_id).order_by(Document.id)
    return list(db.scalars(stmt).all())


@router.delete("/{project_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(project_id: ProjectId, document_id: DocumentId, db: DbSession) -> Response:
    _get_project_or_404(db, project_id)
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.project_id == project_id)
    )
    if document is None:
        raise AppError(404, "document_not_found", f"Document {document_id} was not found.")
    db.delete(document)  # its chunks are removed by the database (ON DELETE CASCADE)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/chunks", response_model=list[ChunkRead])
def list_chunks(project_id: ProjectId, db: DbSession) -> list[ChunkRead]:
    """All text chunks of a project. The report's citations point at these ids."""
    _get_project_or_404(db, project_id)
    stmt = (
        select(Chunk, Document.filename)
        .join(Document, Document.id == Chunk.document_id)
        .where(Document.project_id == project_id)
        .order_by(Document.id, Chunk.position)
    )
    return [
        ChunkRead(
            id=chunk.id,
            document_id=chunk.document_id,
            document_name=filename,
            position=chunk.position,
            location=chunk.location,
            text=chunk.text,
        )
        for chunk, filename in db.execute(stmt).all()
    ]