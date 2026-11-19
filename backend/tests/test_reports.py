import pymupdf

from .conftest import API, upload_notes


def start(owner, pid, overview="A billing platform for **monthly** invoices."):
    owner.post(f"{API}/projects/{pid}/handover")
    owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": overview})
    owner.put(
        f"{API}/projects/{pid}/handover/sections/pending_tasks",
        json={"content": "- Finish the invoice export\n- Migrate the `legacy_users` table\n- Handle “curly” quotes → arrows"},
    )


def test_report_requires_a_handover(owner, project):
    response = owner.post(f"{API}/projects/{project['id']}/reports", json={})
    assert response.status_code == 409 and response.json()["error"]["code"] == "handover_required"


def test_reports_are_versioned_snapshots_that_never_change(owner, project):
    pid = project["id"]
    start(owner, pid)
    first = owner.post(f"{API}/projects/{pid}/reports", json={"title": "Week 1"}).json()
    assert first["version"] == 1 and first["title"] == "Week 1" and first["created_by_name"] == "Olivia Owner"

    owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": "Rewritten overview."})
    second = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    assert second["version"] == 2 and second["title"] == "Atlas Migration handover report"

    detail_one = owner.get(f"{API}/projects/{pid}/reports/{first['id']}").json()
    detail_two = owner.get(f"{API}/projects/{pid}/reports/{second['id']}").json()
    overview = lambda d: next(s for s in d["snapshot"]["sections"] if s["section_type"] == "overview")["content"]
    assert "monthly" in overview(detail_one)  # frozen
    assert overview(detail_two) == "Rewritten overview."

    history = owner.get(f"{API}/projects/{pid}/reports").json()
    assert [r["version"] for r in history] == [2, 1]  # newest first


def test_snapshot_contains_people_and_documents(owner, team):
    pid = team["id"]
    start(owner, pid)
    upload_notes(owner, pid)
    report = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    snap = owner.get(f"{API}/projects/{pid}/reports/{report['id']}").json()["snapshot"]
    assert snap["outgoing_member"]["email"] == "outgoing@example.com"
    assert snap["incoming_member"]["name"] == "Ines Incoming"
    assert [d["filename"] for d in snap["documents"]] == ["notes.txt"]
    assert len(snap["sections"]) == 9


def test_markdown_export(owner, project):
    pid = project["id"]
    start(owner, pid)
    report = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    response = owner.get(f"{API}/projects/{pid}/reports/{report['id']}/export", params={"format": "md"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert "attachment" in response.headers["content-disposition"]
    text = response.text
    assert text.startswith("# Atlas Migration handover report")
    assert "## Project overview" in text and "monthly" in text
    assert "## Pending tasks" in text and "- Finish the invoice export" in text
    assert "_Nothing recorded._" in text  # empty sections are stated, not hidden


def test_pdf_export_is_a_real_readable_pdf(owner, project):
    pid = project["id"]
    start(owner, pid)
    report = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    response = owner.get(f"{API}/projects/{pid}/reports/{report['id']}/export")  # pdf is the default
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    assert ".pdf" in response.headers["content-disposition"]

    document = pymupdf.open(stream=response.content, filetype="pdf")
    text = "\n".join(page.get_text() for page in document)
    assert "Atlas Migration handover report" in text
    assert "A billing platform for monthly invoices." in text  # **bold** markers are rendered, not printed
    assert "Finish the invoice export" in text
    assert "legacy_users" in text
    assert "Pending tasks" in text and "Future recommendations" in text
    assert "->" in text  # the arrow outside the PDF font's range was replaced, not lost as a box


def test_pdf_handles_text_that_looks_like_markup(owner, project):
    pid = project["id"]
    start(owner, pid, overview="Use <b>tags</b> & ampersands <font color=red>safely</font> in text.")
    report = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    response = owner.get(f"{API}/projects/{pid}/reports/{report['id']}/export")
    assert response.status_code == 200
    text = "\n".join(p.get_text() for p in pymupdf.open(stream=response.content, filetype="pdf"))
    assert "<b>tags</b> & ampersands" in text


def test_export_validation_and_unknown_report(owner, project):
    pid = project["id"]
    start(owner, pid)
    report = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    assert owner.get(f"{API}/projects/{pid}/reports/{report['id']}/export", params={"format": "docx"}).status_code == 422
    assert owner.get(f"{API}/projects/{pid}/reports/999999").status_code == 404
    assert owner.get(f"{API}/projects/{pid}/reports/999999/export").status_code == 404


def test_incoming_member_can_read_and_export_but_not_create(owner, incoming, team):
    pid = team["id"]
    start(owner, pid)
    report = owner.post(f"{API}/projects/{pid}/reports", json={}).json()
    assert incoming.get(f"{API}/projects/{pid}/reports").status_code == 200
    assert incoming.get(f"{API}/projects/{pid}/reports/{report['id']}/export").status_code == 200
    assert incoming.post(f"{API}/projects/{pid}/reports", json={}).status_code == 403


def test_report_of_another_project_is_not_reachable(owner, project):
    other = owner.post(f"{API}/projects", json={"name": "Other"}).json()
    start(owner, other["id"])
    report = owner.post(f"{API}/projects/{other['id']}/reports", json={}).json()
    assert owner.get(f"{API}/projects/{project['id']}/reports/{report['id']}").status_code == 404
