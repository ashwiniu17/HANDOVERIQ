
from fastapi import APIRouter
from sqlalchemy import select

from ..errors import AppError
from ..models import Chunk, Document
from .projects import DbSession, ProjectId, _get_project_or_404

router = APIRouter(prefix="/api/projects", tags=["demo"])

DEMO_FILENAME = "HANDOVERIQ-Demo-Project-Notes.txt"

DEMO_TEXT = """HANDOVERIQ DEMO PROJECT

PROJECT OVERVIEW
HANDOVERIQ is a knowledge handover platform designed to help teams transfer project information when employees change roles or leave a project.

PROJECT OBJECTIVE
Create a reliable and evidence-based handover process. The incoming team member should understand project progress, important decisions, pending tasks, risks and ownership.

COMPLETED WORK
1. Project dashboard and project creation workflow implemented.
2. Backend project management APIs implemented.
3. Document upload and text extraction implemented.
4. PDF, DOCX, TXT and CSV document formats supported.

PENDING TASKS
1. Complete the handover report review interface.
2. Verify all project decisions with their original documents.
3. Confirm ownership of remaining development tasks.
4. Conduct final end-to-end testing.

TEAM OWNERSHIP
Outgoing member: Alex
Incoming member: Sam
The incoming member must review all project documentation before accepting responsibility.

IMPORTANT DECISIONS
The project uses Next.js for the frontend and FastAPI for the backend.
SQLite is currently used for database storage.
Uploaded documents are extracted and divided into searchable chunks.

RISKS AND BLOCKERS
The completion status of pending tasks has not been independently verified.
The project delivery deadline needs confirmation.
Final deployment and production configuration need review.

NEXT STEPS
1. Review the uploaded project documentation.
2. Confirm pending task owners.
3. Verify project deadlines.
4. Review risks and unresolved issues.
5. Approve the handover after verification.

NOTE
This is fictional demonstration data. It must not be treated as verified information about a real project.
"""


@router.post("/{project_id}/demo-data")
def add_demo_data(project_id: ProjectId, db: DbSession):
    _get_project_or_404(db, project_id)

    existing = db.scalar(
        select(Document).where(
            Document.project_id == project_id,
            Document.filename == DEMO_FILENAME,
        )
    )

    if existing:
        raise AppError(
            409,
            "demo_data_exists",
            "Demo data has already been added to this project.",
        )

    document = Document(
        project_id=project_id,
        filename=DEMO_FILENAME,
        file_type="txt",
        size_bytes=len(DEMO_TEXT.encode("utf-8")),
        char_count=len(DEMO_TEXT),
        chunk_count=1,
    )

    db.add(document)
    db.flush()

    chunk = Chunk(
        document_id=document.id,
        position=1,
        location="Lines 1–30",
        text=DEMO_TEXT,
    )

    db.add(chunk)
    db.commit()
    db.refresh(document)

    return {
        "message": "Demo data added successfully.",
        "document": {
            "id": document.id,
            "project_id": document.project_id,
            "filename": document.filename,
            "file_type": document.file_type,
            "size_bytes": document.size_bytes,
            "char_count": document.char_count,
            "chunk_count": document.chunk_count,
            "created_at": document.created_at,
        },
    }
