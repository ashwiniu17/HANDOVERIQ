from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Project

from .conftest import API, make_project


def test_create_project(owner):
    response = owner.post(f"{API}/projects", json={"name": "  Atlas  ", "description": "Billing"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Atlas"
    assert body["status"] == "active"
    assert body["my_role"] == "owner"
    assert body["owner"]["full_name"] == "Olivia Owner"
    assert body["document_count"] == 0 and body["handover_status"] is None and body["handover_progress"] == 0


def test_project_validation(owner):
    response = owner.post(f"{API}/projects", json={"name": "", "status": "nonsense", "extra": 1})
    assert response.status_code == 422
    fields = {d["field"] for d in response.json()["error"]["details"]}
    assert {"name", "status", "extra"} <= fields


def test_list_search_and_filter(owner):
    make_project(owner, name="Atlas Billing")
    make_project(owner, name="Borealis Search", description="elastic cluster")
    make_project(owner, name="Cobalt", status="completed")

    assert len(owner.get(f"{API}/projects").json()) == 3
    assert [p["name"] for p in owner.get(f"{API}/projects", params={"search": "elastic"}).json()] == ["Borealis Search"]
    assert [p["name"] for p in owner.get(f"{API}/projects", params={"search": "ATLAS"}).json()] == ["Atlas Billing"]
    assert [p["name"] for p in owner.get(f"{API}/projects", params={"status": "completed"}).json()] == ["Cobalt"]
    assert owner.get(f"{API}/projects", params={"status": "bogus"}).status_code == 422


def test_get_update_project(owner, project):
    assert owner.get(f"{API}/projects/{project['id']}").json()["name"] == "Atlas Migration"
    response = owner.patch(f"{API}/projects/{project['id']}", json={"name": "Atlas v2", "status": "on_hold", "description": ""})
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["status"], body["description"]) == ("Atlas v2", "on_hold", None)


def test_partial_update_keeps_other_fields(owner, project):
    owner.patch(f"{API}/projects/{project['id']}", json={"status": "completed"})
    body = owner.get(f"{API}/projects/{project['id']}").json()
    assert body["status"] == "completed"
    assert body["name"] == "Atlas Migration"


def test_unknown_project_is_404_with_standard_error(owner):
    response = owner.get(f"{API}/projects/999999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"
    assert owner.get(f"{API}/projects/0").status_code == 422
    assert owner.get(f"{API}/projects/99999999999").status_code == 422


def test_delete_is_a_soft_delete(owner, project):
    assert owner.delete(f"{API}/projects/{project['id']}").status_code == 204
    assert owner.get(f"{API}/projects/{project['id']}").status_code == 404
    assert owner.get(f"{API}/projects").json() == []
    with SessionLocal() as db:
        row = db.scalar(select(Project).where(Project.id == project["id"]))
        assert row is not None and row.deleted_at is not None  # kept in the database
