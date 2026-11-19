"""Turn an uploaded file into plain text."""
from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass

import pymupdf
from docx import Document as DocxDocument

from ..core.config import settings

MAX_PDF_PAGES = 400
# A .docx is a zip file; refuse ones that would unpack to something enormous.
MAX_DOCX_UNCOMPRESSED_BYTES = 120 * 1024 * 1024


class ExtractionError(Exception):
    """The file is valid enough to store, but its text cannot be read."""


@dataclass
class ExtractedText:
    text: str
    page_count: int | None = None


def _clean(text: str) -> str:
    text = text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    cleaned = "\n".join(lines).strip()
    # Collapse runs of blank lines.
    while "\n\n\n" in cleaned:
        cleaned = cleaned.replace("\n\n\n", "\n\n")
    return cleaned


def _extract_plain(data: bytes) -> ExtractedText:
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = data.decode("utf-16")
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("cp1252", errors="replace")
    return ExtractedText(_clean(text))


def _extract_pdf(data: bytes) -> ExtractedText:
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - the library raises several types
        raise ExtractionError("This PDF is damaged or not a real PDF file.") from exc
    try:
        if document.needs_pass:
            raise ExtractionError("This PDF is password protected. Remove the password and upload it again.")
        pages = document.page_count
        if pages > MAX_PDF_PAGES:
            raise ExtractionError(f"This PDF has {pages} pages; the limit is {MAX_PDF_PAGES}.")
        parts = [page.get_text("text") for page in document]
    except ExtractionError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ExtractionError("The text of this PDF could not be read.") from exc
    finally:
        document.close()
    return ExtractedText(_clean("\n\n".join(parts)), page_count=pages)


def _extract_docx(data: bytes) -> ExtractedText:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if sum(info.file_size for info in archive.infolist()) > MAX_DOCX_UNCOMPRESSED_BYTES:
                raise ExtractionError("This Word file expands to an unsafe size and was not opened.")
        document = DocxDocument(io.BytesIO(data))
    except ExtractionError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ExtractionError("This Word file is damaged or not a real .docx file.") from exc

    parts = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return ExtractedText(_clean("\n".join(parts)))


def extract_text(file_type: str, data: bytes) -> ExtractedText:
    if file_type == "pdf":
        result = _extract_pdf(data)
    elif file_type == "docx":
        result = _extract_docx(data)
    else:
        result = _extract_plain(data)

    if not result.text:
        raise ExtractionError(
            "No readable text was found. Scanned pages and images need OCR, which is not supported yet."
        )
    if len(result.text) > settings.max_extracted_chars:
        raise ExtractionError(
            f"This file contains more than {settings.max_extracted_chars:,} characters of text. Split it into smaller files."
        )
    return result
