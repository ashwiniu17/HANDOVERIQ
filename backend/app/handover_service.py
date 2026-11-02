
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Chunk, Document, Handover, Project


# Report sections and their accepted document heading names.
SECTION_RULES = [
    (
        "Project Overview",
        (
            "PROJECT OVERVIEW",
            "PROJECT OBJECTIVE",
            "OVERVIEW",
            "BACKGROUND",
        ),
    ),
    (
        "Completed Work",
        (
            "COMPLETED WORK",
            "COMPLETED",
            "ACHIEVEMENTS",
        ),
    ),
    (
        "Pending Tasks",
        (
            "PENDING TASKS",
            "PENDING WORK",
            "TODO",
            "TASKS",
        ),
    ),
    (
        "Important Decisions",
        (
            "IMPORTANT DECISIONS",
            "DECISIONS",
            "KEY DECISIONS",
        ),
    ),
    (
        "Risks and Blockers",
        (
            "RISKS AND BLOCKERS",
            "RISKS",
            "BLOCKERS",
            "CHALLENGES",
        ),
    ),
    (
        "Team Ownership",
        (
            "TEAM OWNERSHIP",
            "TEAM",
            "OWNERSHIP",
            "RESPONSIBILITIES",
        ),
    ),
    (
        "Next Steps",
        (
            "NEXT STEPS",
            "ACTION ITEMS",
            "FOLLOW-UP",
        ),
    ),
    (
        "Additional Information",
        (
            "NOTE",
            "NOTES",
            "ADDITIONAL INFORMATION",
            "DISCLAIMER",
        ),
    ),
]


def get_project_chunks(db: Session, project_id: int) -> list[dict]:
    """Return only chunks belonging to the requested project."""
    rows = db.execute(
        select(Chunk, Document.filename)
        .join(Document, Document.id == Chunk.document_id)
        .where(Document.project_id == project_id)
        .order_by(Document.id, Chunk.position)
    ).all()

    return [
        {
            "chunk_id": chunk.id,
            "document_id": chunk.document_id,
            "document_name": filename,
            "position": chunk.position,
            "location": chunk.location,
            "text": chunk.text,
        }
        for chunk, filename in rows
    ]


def validate_citations(report: dict, chunks: list[dict]) -> dict:
    """Validate citation IDs against the project's actual document chunks."""
    valid_chunks = {
        chunk["chunk_id"]: chunk
        for chunk in chunks
    }

    for section in report.get("sections", []):
        for claim in section.get("claims", []):
            valid_ids = []
            source_details = []

            citations = claim.get("citations", [])

            if not isinstance(citations, list):
                citations = []

            for chunk_id in citations:
                if (
                    isinstance(chunk_id, int)
                    and not isinstance(chunk_id, bool)
                    and chunk_id in valid_chunks
                ):
                    valid_ids.append(chunk_id)
                    source = valid_chunks[chunk_id]

                    source_details.append({
                        "chunk_id": chunk_id,
                        "document_name": source["document_name"],
                        "location": source["location"],
                    })

            claim["citations"] = valid_ids
            claim["sources"] = source_details
            claim["status"] = (
                "SUPPORTED" if valid_ids else "UNSUPPORTED"
            )

    return report


def normalize_heading(line: str) -> str:
    """Normalize a possible document heading."""
    return re.sub(r"[^A-Z0-9 ]", "", line.upper()).strip()


def identify_section(line: str) -> str | None:
    """Match a document heading to a known handover report section."""
    heading = normalize_heading(line)

    for section_name, keywords in SECTION_RULES:
        for keyword in keywords:
            if heading == normalize_heading(keyword):
                return section_name

    return None


def split_content_into_claims(text: str) -> list[str]:
    """
    Split extracted text into readable individual claims.

    Handles numbered lists, bullet lists and ordinary paragraphs.
    """
    claims = []
    current_paragraph = []

    def flush_paragraph():
        if current_paragraph:
            value = " ".join(current_paragraph).strip()
            if value:
                claims.append(value)
            current_paragraph.clear()

    for raw_line in text.splitlines():
        line = raw_line.strip()

        if not line:
            flush_paragraph()
            continue

        # Remove common numbered-list and bullet prefixes.
        match = re.match(r"^(?:\d+[.)]\s*|[-*•]\s+)(.+)$", line)

        if match:
            flush_paragraph()
            value = match.group(1).strip()
            if value:
                claims.append(value)
        else:
            current_paragraph.append(line)

    flush_paragraph()
    return claims


def generate_demo_report(project: Project, chunks: list[dict]) -> dict:
    """
    Generate a structured deterministic report from extracted documents.

    This is document extraction, not AI-generated summarization.
    """
    if not chunks:
        return {
            "title": f"Handover Report - {project.name}",
            "mode": "DEMO",
            "notice": (
                "Demo mode: no documents have been uploaded yet."
            ),
            "summary": (
                "No source documents are available. "
                "Upload documents to generate a handover."
            ),
            "sections": [],
            "missing_information": [
                "No documents were uploaded. Project progress and pending work cannot be verified."
            ],
            "contradictions": [
                "No contradiction assessment was possible because there are no source documents."
            ],
        }

    section_claims = defaultdict(list)
    grouped_documents = defaultdict(list)
    uncategorized_claims = []

    for chunk in chunks:
        filename = chunk["document_name"]
        grouped_documents[filename].append(chunk)

        current_section = None

        for raw_line in chunk["text"].splitlines():
            line = raw_line.strip()

            if not line:
                continue

            # Recognize headings before processing their content.
            matched_section = identify_section(line)

            if matched_section:
                current_section = matched_section
                continue

            # Ignore only the main document title.
            # NOTE and PROJECT OBJECTIVE are handled as headings above.
            if normalize_heading(line) == "HANDOVERIQ DEMO PROJECT":
                continue

            claims = split_content_into_claims(line)

            for claim_text in claims:
                claim = {
                    "text": claim_text[:1200],
                    "citations": [chunk["chunk_id"]],
                }

                if current_section:
                    section_claims[current_section].append(claim)
                else:
                    uncategorized_claims.append(claim)

    # Put content without a recognized heading into Additional Information.
    if uncategorized_claims:
        section_claims["Additional Information"].extend(
            uncategorized_claims
        )

    sections = []

    section_order = [
        "Project Overview",
        "Completed Work",
        "Pending Tasks",
        "Important Decisions",
        "Risks and Blockers",
        "Team Ownership",
        "Next Steps",
        "Additional Information",
    ]

    for section_name in section_order:
        claims = section_claims.get(section_name, [])

        if claims:
            sections.append({
                "name": section_name,
                "claims": claims,
            })

    missing_information = [
        "Project completion status has not been independently verified.",
        "Pending tasks and their owners need confirmation.",
        "Deadlines and next review dates need confirmation.",
        "Risks and blockers need confirmation from the project team.",
    ]

    return {
        "title": f"Handover Report - {project.name}",
        "mode": "DEMO",
        "notice": (
            "This report was generated using deterministic document "
            "extraction and heading-based organization. It is not an "
            "AI-generated summary. Review every claim before approval."
        ),
        "summary": (
            f"This report organizes extracted information from "
            f"{len(grouped_documents)} uploaded document(s) into "
            f"{len(sections)} report section(s). "
            "Each claim links to its original source chunk."
        ),
        "sections": sections,
        "missing_information": missing_information,
        "contradictions": [
            "Automatic contradiction detection is not implemented in demo mode. No contradiction assessment has been performed."
        ],
    }


def build_report(db: Session, project_id: int) -> tuple[dict, str]:
    """Build a report using the currently available demo provider."""
    project = db.get(Project, project_id)

    if project is None:
        raise ValueError("Project not found.")

    chunks = get_project_chunks(db, project_id)

    report = generate_demo_report(project, chunks)
    report = validate_citations(report, chunks)

    return report, "demo-extraction"


def save_report(db: Session, project_id: int) -> Handover:
    """Create or replace the project's report and reset approval."""
    report, model_name = build_report(db, project_id)

    existing = db.scalar(
        select(Handover).where(
            Handover.project_id == project_id
        )
    )

    report_json = json.dumps(
        report,
        ensure_ascii=False,
    )

    if existing is None:
        existing = Handover(
            project_id=project_id,
            report_json=report_json,
            model=model_name,
        )
        db.add(existing)
    else:
        existing.report_json = report_json
        existing.model = model_name
        existing.approved_at = None
        existing.generated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(existing)

    return existing


def read_report(handover: Handover) -> dict[str, Any]:
    """Convert the stored report JSON into a Python dictionary."""
    return json.loads(handover.report_json)
