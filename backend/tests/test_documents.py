import io
import zipfile

import pymupdf
from docx import Document as DocxDocument

from app.core.config import settings
from app.services import extraction

from .conftest import API, NOTES, put_document, upload_notes


def make_pdf(text: str = "Billing service handover notes") -> bytes:
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), text)
    data = document.tobytes()
    document.close()
    return data


def make_docx(text: str = "The deadline is the 30th.") -> bytes:
    document = DocxDocument()
    document.add_paragraph(text)
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Owner"
    table.rows[0].cells[1].text = "Alice"
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_upload_txt_is_processed(owner, project):
    body = upload_notes(owner, project["id"])
    assert body["filename"] == "notes.txt" and body["file_type"] == "txt"
    assert body["processing_status"] == "processed"
    assert body["char_count"] > 100
    assert body["analysis_status"] == "not_analyzed"
    assert body["uploaded_by_name"] == "Olivia Owner"


def test_upload_markdown(owner, project):
    body = put_document(owner, project["id"], "README.md", b"# Title\n\nSome **bold** text about setup.")
    assert body["file_type"] == "md" and body["processing_status"] == "processed"


def test_upload_pdf_extracts_text(owner, project):
    body = put_document(owner, project["id"], "spec.pdf", make_pdf())
    assert body["processing_status"] == "processed" and body["page_count"] == 1
    preview = owner.get(f"{API}/projects/{project['id']}/documents/{body['id']}/text").json()
    assert "Billing service handover notes" in preview["text"]


def test_upload_docx_extracts_paragraphs_and_tables(owner, project):
    body = put_document(owner, project["id"], "plan.docx", make_docx())
    assert body["processing_status"] == "processed"
    text = owner.get(f"{API}/projects/{project['id']}/documents/{body['id']}/text").json()["text"]
    assert "The deadline is the 30th." in text and "Owner | Alice" in text


def test_utf16_and_cp1252_text_files_are_decoded(owner, project):
    utf16 = put_document(owner, project["id"], "a.txt", "Café résumé notes".encode("utf-16"))
    cp1252 = put_document(owner, project["id"], "b.txt", "Café résumé other".encode("cp1252"))
    for doc in (utf16, cp1252):
        text = owner.get(f"{API}/projects/{project['id']}/documents/{doc['id']}/text").json()["text"]
        assert "Café résumé" in text


def test_unsupported_types_are_rejected(owner, project):
    for name in ("data.csv", "image.png", "run.exe", "noextension"):
        response = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": (name, b"hello world", "text/plain")})
        assert response.status_code == 422, name
        assert response.json()["error"]["code"] == "unsupported_file_type"


def test_file_content_must_match_its_extension(owner, project):
    fake_pdf = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("fake.pdf", b"just text", "application/pdf")})
    fake_docx = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("fake.docx", b"just text", "application/zip")})
    binary_txt = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("bin.txt", b"abc\x00\x01\x02def", "text/plain")})
    for response in (fake_pdf, fake_docx, binary_txt):
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_file"


def test_corrupt_but_plausible_files_are_stored_as_failed_with_a_reason(owner, project):
    body = put_document(owner, project["id"], "broken.pdf", b"%PDF-1.4 this is not really a pdf")
    assert body["processing_status"] == "failed"
    assert "damaged" in body["processing_error"]
    broken_docx = put_document(owner, project["id"], "broken.docx", b"PK\x03\x04garbage")
    assert broken_docx["processing_status"] == "failed"


def test_pdf_without_text_explains_ocr_is_missing(owner, project):
    blank = pymupdf.open()
    blank.new_page()
    data = blank.tobytes()
    body = put_document(owner, project["id"], "scan.pdf", data)
    assert body["processing_status"] == "failed"
    assert "OCR" in body["processing_error"]


def test_password_protected_pdf_is_reported(owner, project):
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "secret")
    data = document.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="pw", owner_pw="pw")
    body = put_document(owner, project["id"], "locked.pdf", data)
    assert body["processing_status"] == "failed"
    assert "password" in body["processing_error"].lower()


def test_zip_bomb_docx_is_not_opened(owner, project, monkeypatch):
    monkeypatch.setattr(extraction, "MAX_DOCX_UNCOMPRESSED_BYTES", 1024)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", b"0" * 200_000)
    body = put_document(owner, project["id"], "bomb.docx", buffer.getvalue())
    assert body["processing_status"] == "failed" and "unsafe" in body["processing_error"]


def test_empty_file_and_oversize_file(owner, project, monkeypatch):
    empty = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("empty.txt", b"   \n", "text/plain")})
    assert empty.status_code == 422 and empty.json()["error"]["code"] == "empty_file"

    monkeypatch.setattr(settings, "max_upload_mb", 1)
    big = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("big.txt", b"a" * (1024 * 1024 + 5), "text/plain")})
    assert big.status_code == 413 and big.json()["error"]["code"] == "file_too_large"


def test_duplicate_content_is_rejected_even_with_another_name(owner, project):
    upload_notes(owner, project["id"], "notes.txt")
    again = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("renamed.txt", NOTES, "text/plain")})
    assert again.status_code == 409 and again.json()["error"]["code"] == "duplicate_document"


def test_the_same_file_may_be_uploaded_to_different_projects(owner, project):
    other = owner.post(f"{API}/projects", json={"name": "Other"}).json()
    upload_notes(owner, project["id"])
    upload_notes(owner, other["id"])


def test_path_tricks_in_file_names_are_neutralised(owner, project):
    body = put_document(owner, project["id"], "../../etc/passwd.txt", b"harmless text here")
    assert body["filename"] == "passwd.txt"
    body = put_document(owner, project["id"], "C:\\Users\\x\\secret.txt", b"another harmless text")
    assert body["filename"] == "secret.txt"


def test_document_limit_per_project(owner, project, monkeypatch):
    monkeypatch.setattr(settings, "max_documents_per_project", 2)
    put_document(owner, project["id"], "a.txt", b"first document text")
    put_document(owner, project["id"], "b.txt", b"second document text")
    response = owner.post(f"{API}/projects/{project['id']}/documents", files={"file": ("c.txt", b"third document text", "text/plain")})
    assert response.status_code == 409 and response.json()["error"]["code"] == "document_limit"


def test_download_returns_the_original_bytes_safely(owner, project):
    pdf = make_pdf()
    doc = put_document(owner, project["id"], "Spec ü.pdf", pdf)
    response = owner.get(f"{API}/projects/{project['id']}/documents/{doc['id']}/download")
    assert response.status_code == 200
    assert response.content == pdf
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("attachment;")
    assert "filename*=UTF-8''Spec%20%C3%BC.pdf" in response.headers["content-disposition"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_list_and_delete(owner, project):
    one = upload_notes(owner, project["id"])
    listed = owner.get(f"{API}/projects/{project['id']}/documents").json()
    assert [d["id"] for d in listed] == [one["id"]]
    assert owner.get(f"{API}/projects/{project['id']}").json()["document_count"] == 1

    assert owner.delete(f"{API}/projects/{project['id']}/documents/{one['id']}").status_code == 204
    assert owner.get(f"{API}/projects/{project['id']}/documents").json() == []
    assert owner.get(f"{API}/projects/{project['id']}/documents/{one['id']}/download").status_code == 404


def test_document_of_another_project_is_not_reachable(owner, project):
    other = owner.post(f"{API}/projects", json={"name": "Other"}).json()
    doc = upload_notes(owner, other["id"])
    response = owner.get(f"{API}/projects/{project['id']}/documents/{doc['id']}/download")
    assert response.status_code == 404 and response.json()["error"]["code"] == "document_not_found"
