from .conftest import API, make_project


def fill_and_complete(client, pid):
    client.post(f"{API}/projects/{pid}/handover")
    for section_type in ("overview", "technical", "completed_tasks", "pending_tasks", "decisions", "dependencies", "known_issues", "setup", "recommendations"):
        client.put(f"{API}/projects/{pid}/handover/sections/{section_type}", json={"content": "x", "is_complete": True})
    assert client.post(f"{API}/projects/{pid}/handover/complete").status_code == 200


def test_empty_dashboard(owner):
    body = owner.get(f"{API}/dashboard").json()
    assert body["stats"] == {"total_projects": 0, "active_projects": 0, "completed_handovers": 0, "pending_handovers": 0}
    assert body["recent_projects"] == [] and body["recent_activity"] == []


def test_dashboard_numbers_come_from_real_data(owner):
    a = make_project(owner, name="A")
    b = make_project(owner, name="B")
    c = make_project(owner, name="C", status="completed")
    make_project(owner, name="D", status="on_hold")

    fill_and_complete(owner, a["id"])           # completed handover
    owner.post(f"{API}/projects/{b['id']}/handover")  # pending (draft)
    owner.post(f"{API}/projects/{c['id']}/handover")
    owner.post(f"{API}/projects/{c['id']}/handover/submit-review")  # pending (in review)

    stats = owner.get(f"{API}/dashboard").json()["stats"]
    assert stats == {"total_projects": 4, "active_projects": 2, "completed_handovers": 1, "pending_handovers": 2}


def test_recent_projects_and_activity(owner):
    for name in "ABCDEFG":
        make_project(owner, name=f"Project {name}")
    body = owner.get(f"{API}/dashboard").json()
    assert len(body["recent_projects"]) == 5
    assert body["recent_projects"][0]["name"] == "Project G"
    assert body["recent_activity"][0]["message"].startswith("Created the project")
    assert body["recent_activity"][0]["project_name"] == "Project G"


def test_deleted_projects_disappear_from_the_dashboard(owner):
    p = make_project(owner, name="Gone")
    owner.delete(f"{API}/projects/{p['id']}")
    body = owner.get(f"{API}/dashboard").json()
    assert body["stats"]["total_projects"] == 0 and body["recent_activity"] == []


def test_dashboard_only_counts_what_the_user_can_see(owner, stranger, team):
    make_project(stranger, name="Theirs")
    assert owner.get(f"{API}/dashboard").json()["stats"]["total_projects"] == 1
    assert stranger.get(f"{API}/dashboard").json()["stats"]["total_projects"] == 1
    names = [a["project_name"] for a in stranger.get(f"{API}/dashboard").json()["recent_activity"]]
    assert names == ["Theirs"]
