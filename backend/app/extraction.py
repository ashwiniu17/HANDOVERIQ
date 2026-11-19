"""Turn an uploaded file into plain-text chunks, each with a human-readable location.

Supported: .txt, .csv, .pdf, .docx. Anything else, or any file that cannot be
read, raises ExtractionError with a short code and a user-friendly message.
"""

import csv
import io
import zipfile
from dataclasses import dataclass

ALLOWED_TYPES = ("txt", "csv", "pdf", "docx")

MAX_CHARS = 1200          # a chunk never grows beyond this
MIN_CHARS = 500           # at a blank line, a chunk of at least this size is closed
MAX_DOC_CHARS = 300_000   # extracted text limit per document
MAX_PDF_PAGES = 300


class ExtractionError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class ExtractedChunk:
    location: str
    text: str


@dataclass
class ExtractionResult:
    file_type: str
    chunks: list[ExtractedChunk]

    @property
    def char_count(self) -> int:
        return sum(len(chunk.text) for chunk in self.chunks)


def clean_filename(raw: str) -> str:
    """Keep only the file name (no folders) and drop control characters."""
    name = raw.replace("\\", "/").split("/")[-1]
    return "".join(ch for ch in name if ch.isprintable()).strip()


def _corrupt(what: str) -> ExtractionError:
    return ExtractionError(
        "corrupt_file", f"This file could not be read as a valid {what}. It may be damaged."
    )


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------
def _label(prefix: str, first: int, last: int) -> str:
    return f"{prefix} {first}" if first == last else f"{prefix}s {first}-{last}"


def _group(items: list[tuple[int, str]]) -> list[tuple[int, int, str]]:
    """Group numbered lines into chunks of at most MAX_CHARS.

    An empty line is a paragraph break: once the chunk holds MIN_CHARS or more,
    a break closes it. Returns (first_number, last_number, text) per chunk.
    """
    chunks: list[tuple[int, int, str]] = []
    buffer: list[tuple[int, str]] = []
    size = 0

    def flush() -> None:
        nonlocal buffer, size
        text = "\n".join(line for _, line in buffer).strip()
        if text:
            numbers = [number for number, line in buffer if line.strip()]
            chunks.append((numbers[0], numbers[-1], text))
        buffer = []
        size = 0

    for number, raw_line in items:
        line = raw_line.rstrip()
        if not line.strip():
            if size >= MIN_CHARS:
                flush()
            elif buffer:
                buffer.append((number, ""))
            continue
        if len(line) > MAX_CHARS:
            flush()
            for start in range(0, len(line), MAX_CHARS):
                chunks.append((number, number, line[start : start + MAX_CHARS]))
            continue
        if buffer and size + len(line) + 1 > MAX_CHARS:
            flush()
        buffer.append((number, line))
        size += len(line) + 1
    flush()
    return chunks


def _chunks_from_items(items: list[tuple[int, str]], prefix: str) -> list[ExtractedChunk]:
    return [
        ExtractedChunk(_label(prefix, first, last), text)
        for first, last, text in _group(items)
    ]


# ---------------------------------------------------------------------------
# One extractor per file type
# ---------------------------------------------------------------------------
def _decode(data: bytes) -> str:
    if b"\x00" in data[:8192]:
        raise _corrupt("text file")
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise _corrupt("text file")


def _extract_txt(data: bytes) -> list[ExtractedChunk]:
    text = _decode(data)
    items = list(enumerate(text.splitlines(), start=1))
    return _chunks_from_items(items, "line")


def _extract_csv(data: bytes) -> list[ExtractedChunk]:
    text = _decode(data)
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    try:
        rows = list(csv.reader(io.StringIO(text), dialect))
    except csv.Error:
        raise _corrupt("CSV file") from None

    numbered = [
        (number, [cell.strip() for cell in row])
        for number, row in enumerate(rows, start=1)
        if any(cell.strip() for cell in row)
    ]
    if len(numbered) < 2:
        raise ExtractionError(
            "no_text", "This CSV file needs a header row and at least one data row."
        )

    header = numbered[0][1]
    items: list[tuple[int, str]] = []
    for number, cells in numbered[1:]:
        parts = []
        for index, value in enumerate(cells):
            if not value:
                continue
            name = header[index] if index < len(header) and header[index] else f"column {index + 1}"
            parts.append(f"{name}: {value}")
        if parts:
            items.append((number, f"Row {number}: " + "; ".join(parts)))
    return _chunks_from_items(items, "row")


def _extract_pdf(data: bytes) -> list[ExtractedChunk]:
    if b"%PDF-" not in data[:1024]:
        raise _corrupt("PDF")
    import pymupdf  # imported here so a problem never stops the whole server starting

    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception:
        raise _corrupt("PDF") from None

    chunks: list[ExtractedChunk] = []
    try:
        if document.needs_pass:
            raise ExtractionError(
                "encrypted_pdf", "This PDF is password-protected. Remove the password and try again."
            )
        if document.page_count > MAX_PDF_PAGES:
            raise ExtractionError(
                "document_too_long", f"This PDF has more than {MAX_PDF_PAGES} pages."
            )
        for page_index in range(document.page_count):
            text = document.load_page(page_index).get_text()
            parts = _group(list(enumerate(text.splitlines(), start=1)))
            for part_number, (_, _, part_text) in enumerate(parts, start=1):
                location = f"page {page_index + 1}"
                if len(parts) > 1:
                    location += f" (part {part_number} of {len(parts)})"
                chunks.append(ExtractedChunk(location, part_text))
    except ExtractionError:
        raise
    except Exception:
        raise _corrupt("PDF") from None
    finally:
        document.close()
    return chunks


def _extract_docx(data: bytes) -> list[ExtractedChunk]:
    from docx import Document as DocxDocument  # imported here, as with pymupdf

    try:
        if not zipfile.is_zipfile(io.BytesIO(data)):
            raise _corrupt("Word document")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if "word/document.xml" not in archive.namelist():
                raise _corrupt("Word document")
        document = DocxDocument(io.BytesIO(data))
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        tables = document.tables
    except ExtractionError:
        raise
    except Exception:
        raise _corrupt("Word document") from None

    chunks = _chunks_from_items(list(enumerate(paragraphs, start=1)), "paragraph")

    for table_number, table in enumerate(tables, start=1):
        items: list[tuple[int, str]] = []
        for row_number, row in enumerate(table.rows, start=1):
            cells: list[str] = []
            for cell in row.cells:
                value = cell.text.strip()
                if value and (not cells or cells[-1] != value):  # merged cells repeat
                    cells.append(value)
            if cells:
                items.append((row_number, " | ".join(cells)))
        chunks.extend(_chunks_from_items(items, f"table {table_number}, row"))
    return chunks


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def extract(filename: str, data: bytes) -> ExtractionResult:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_TYPES:
        raise ExtractionError(
            "unsupported_file_type",
            "Unsupported file type. Upload a .pdf, .docx, .txt or .csv file.",
        )
    if not data:
        raise ExtractionError("empty_file", "The uploaded file is empty.")

    extractors = {
        "txt": _extract_txt,
        "csv": _extract_csv,
        "pdf": _extract_pdf,
        "docx": _extract_docx,
    }
    chunks = extractors[extension](data)

    if not chunks:
        raise ExtractionError(
            "no_text",
            "No readable text was found in this file. Scanned or image-only documents are not supported.",
        )
    result = ExtractionResult(file_type=extension, chunks=chunks)
    if result.char_count > MAX_DOC_CHARS:
        raise ExtractionError(
            "document_too_long",
            f"This document has more than {MAX_DOC_CHARS:,} characters of text. Split it into smaller files.",
        )
    return result