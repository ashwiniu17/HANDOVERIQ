"""Nobody may see or change a project they were not given access to."""
import pytest

from .conftest import API, NOTES, make_project, put_document, upload_notes


def test_strangers_cannot_see_a_project_in_any_way(owner, stranger, project):
    pid = project["id"]
    upload = upload_notes(owner, pid)
    owner.post(f"{API}/projects/{pid}/handover")
    owner.post(f"{API}/projects/{pid}/reports", json={})

    assert stranger.get(f"{API}/projects").json() == []
    assert stranger.get(f"{API}/dashboard").json()["stats"]["total_projects"] == 0

    requests = [
        ("get", f"/projects/{pid}"),
        ("patch", f"/projects/{pid}"),
        ("delete", f"/projects/{pid}"),
        ("get", f"/projects/{pid}/members"),
        ("post", f"/projects/{pid}/members"),
        ("get", f"/projects/{pid}/activity"),
        ("get", f"/projects/{pid}/documents"),
        ("post", f"/projects/{pid}/documents"),
        ("get", f"/projects/{pid}/documents/{upload['id']}/download"),
        ("get", f"/projects/{pid}/documents/{upload['id']}/text"),
        ("delete", f"/projects/{pid}/documents/{upload['id']}"),
        ("post", f"/projects/{pid}/documents/{upload['id']}/analyze"),
        ("get", f"/projects/{pid}/handover"),
        ("post", f"/projects/{pid}/handover"),
        ("put", f"/projects/{pid}/handover/sections/overview"),
        ("get", f"/projects/{pid}/knowledge"),
        ("get", f"/projects/{pid}/analysis-runs"),
        ("get", f"/projects/{pid}/reports"),
        ("post", f"/projects/{pid}/reports"),
        ("get", f"/projects/{pid}/reports/1"),
        ("get", f"/projects/{pid}/reports/1/export"),
    ]
    for method, path in requests:
        kwargs = {"json": {"content": "x"}} if method in {"patch", "put", "post"} and "documents" not in path else {}
        response = getattr(stranger, method)(f"{API}{path}", **kwargs)
        assert response.status_code == 404, f"{method.upper()} {path} -> {response.status_code}: {response.text[:120]}"
        assert response.json()["error"]["code"] == "project_not_found"

    # ...and the owner's data is untouched.
    assert owner.get(f"{API}/projects/{pid}").json()["name"] == "Atlas Migration"


def test_existence_of_a_project_is_not_revealed(stranger):
    missing = stranger.get(f"{API}/projects/424242")
    assert missing.status_code == 404


def test_incoming_member_is_read_only(owner, incoming, team):
    pid = team["id"]
    owner.post(f"{API}/projects/{pid}/handover")
    upload = upload_notes(owner, pid)

    assert incoming.get(f"{API}/projects/{pid}").json()["my_role"] == "incoming"
    assert incoming.get(f"{API}/projects/{pid}/handover").status_code == 200
    assert incoming.get(f"{API}/projects/{pid}/documents").status_code == 200
    assert incoming.get(f"{API}/projects/{pid}/documents/{upload['id']}/download").status_code == 200

    forbidden = [
        ("patch", f"/projects/{pid}", {"name": "Hacked"}),
        ("put", f"/projects/{pid}/handover/sections/overview", {"content": "x"}),
        ("post", f"/projects/{pid}/handover/submit-review", None),
        ("post", f"/projects/{pid}/handover/complete", None),
        ("delete", f"/projects/{pid}/documents/{upload['id']}", None),
        ("post", f"/projects/{pid}/knowledge/apply", {}),
        ("post", f"/projects/{pid}/reports", {}),
        ("post", f"/projects/{pid}/members", {"email": "x@example.com", "role": "collaborator"}),
        ("delete", f"/projects/{pid}", None),
    ]
    for method, path, body in forbidden:
        response = getattr(incoming, method)(f"{API}{path}", **({"json": body} if body is not None else {}))
        assert response.status_code == 403, f"{method.upper()} {path} -> {response.status_code}"
        assert response.json()["error"]["code"] == "forbidden"

    upload_attempt = incoming.post(f"{API}/projects/{pid}/documents", files={"file": ("a.txt", NOTES, "text/plain")})
    assert upload_attempt.status_code == 403


def test_outgoing_and_collaborator_can_edit_but_not_manage(owner, outgoing, collab, team):
    pid = team["id"]
    for editor in (outgoing, collab):
        assert editor.patch(f"{API}/projects/{pid}", json={"description": "edited"}).status_code == 200
        assert editor.post(f"{API}/projects/{pid}/handover").status_code in (201, 409)
        assert editor.post(f"{API}/projects/{pid}/members", json={"email": "x@example.com", "role": "collaborator"}).status_code == 403
        assert editor.delete(f"{API}/projects/{pid}").status_code == 403
        assert editor.post(f"{API}/projects/{pid}/handover/reopen").status_code == 403
    assert outgoing.post(f"{API}/projects/{pid}/documents", files={"file": ("a.txt", NOTES, "text/plain")}).status_code == 201


def test_member_projects_appear_in_their_list_with_their_role(owner, incoming, team):
    projects = incoming.get(f"{API}/projects").json()
    assert [(p["id"], p["my_role"]) for p in projects] == [(team["id"], "incoming")]
    assert incoming.get(f"{API}/dashboard").json()["stats"]["total_projects"] == 1


def test_removed_member_loses_access_immediately(owner, incoming, team):
    pid = team["id"]
    members = owner.get(f"{API}/projects/{pid}/members").json()
    member = next(m for m in members if m["email"] == "incoming@example.com")
    assert owner.delete(f"{API}/projects/{pid}/members/{member['id']}").status_code == 204
    assert incoming.get(f"{API}/projects/{pid}").status_code == 404
    assert incoming.get(f"{API}/projects").json() == []


def test_deleted_project_disappears_for_members_too(owner, incoming, team):
    owner.delete(f"{API}/projects/{team['id']}")
    assert incoming.get(f"{API}/projects/{team['id']}").status_code == 404
    assert incoming.get(f"{API}/projects").json() == []


def test_members_of_one_project_cannot_reach_another(owner, incoming, team):
    other = make_project(owner, name="Secret project")
    assert incoming.get(f"{API}/projects/{other['id']}").status_code == 404
