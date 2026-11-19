from .conftest import API


def sections(handover: dict) -> dict:
    return {s["section_type"]: s for s in handover["sections"]}


def fill_all(client, pid):
    for section_type in sections(client.get(f"{API}/projects/{pid}/handover").json()):
        response = client.put(
            f"{API}/projects/{pid}/handover/sections/{section_type}",
            json={"content": f"Content for {section_type}.", "is_complete": True},
        )
        assert response.status_code == 200, response.text


def test_handover_does_not_exist_until_started(owner, project):
    response = owner.get(f"{API}/projects/{project['id']}/handover")
    assert response.status_code == 404 and response.json()["error"]["code"] == "handover_not_found"


def test_start_handover_creates_all_nine_sections(owner, project):
    response = owner.post(f"{API}/projects/{project['id']}/handover")
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft" and body["progress"] == 0 and body["total_sections"] == 9
    assert [s["section_type"] for s in body["sections"]] == [
        "overview", "technical", "completed_tasks", "pending_tasks", "decisions",
        "dependencies", "known_issues", "setup", "recommendations",
    ]
    assert body["sections"][0]["title"] == "Project overview"
    again = owner.post(f"{API}/projects/{project['id']}/handover")
    assert again.status_code == 409 and again.json()["error"]["code"] == "handover_exists"


def test_edit_section_and_progress(owner, project):
    pid = project["id"]
    owner.post(f"{API}/projects/{pid}/handover")
    response = owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": "  A billing platform.  "})
    assert sections(response.json())["overview"]["content"] == "A billing platform."
    assert response.json()["progress"] == 0

    done = owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"is_complete": True}).json()
    assert done["completed_sections"] == 1 and done["progress"] == 11
    assert owner.get(f"{API}/projects/{pid}").json()["handover_progress"] == 11


def test_cannot_complete_an_empty_section(owner, project):
    pid = project["id"]
    owner.post(f"{API}/projects/{pid}/handover")
    response = owner.put(f"{API}/projects/{pid}/handover/sections/known_issues", json={"is_complete": True})
    assert response.status_code == 422 and response.json()["error"]["code"] == "section_empty"
    # nothing was changed
    assert sections(owner.get(f"{API}/projects/{pid}/handover").json())["known_issues"]["is_complete"] is False


def test_editing_a_completed_section_asks_for_another_review(owner, project):
    pid = project["id"]
    owner.post(f"{API}/projects/{pid}/handover")
    owner.put(f"{API}/projects/{pid}/handover/sections/setup", json={"content": "Run make dev.", "is_complete": True})
    edited = owner.put(f"{API}/projects/{pid}/handover/sections/setup", json={"content": "Run make dev && make seed."})
    assert sections(edited.json())["setup"]["is_complete"] is False
    same = owner.put(f"{API}/projects/{pid}/handover/sections/setup", json={"content": "Run make dev && make seed.", "is_complete": True})
    again = owner.put(f"{API}/projects/{pid}/handover/sections/setup", json={"content": "Run make dev && make seed."})
    assert sections(again.json())["setup"]["is_complete"] is True  # unchanged text keeps its status


def test_section_validation(owner, project):
    pid = project["id"]
    owner.post(f"{API}/projects/{pid}/handover")
    assert owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={}).status_code == 422
    assert owner.put(f"{API}/projects/{pid}/handover/sections/nonsense", json={"content": "x"}).status_code == 422
    assert owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": "x" * 50_001}).status_code == 422


def test_full_lifecycle_review_complete_lock_reopen(owner, project):
    pid = project["id"]
    owner.post(f"{API}/projects/{pid}/handover")

    blocked = owner.post(f"{API}/projects/{pid}/handover/complete")
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "handover_incomplete"
    assert "Project overview" in blocked.json()["error"]["details"]["incomplete_sections"]

    fill_all(owner, pid)
    assert owner.post(f"{API}/projects/{pid}/handover/submit-review").json()["status"] == "in_review"
    assert owner.post(f"{API}/projects/{pid}/handover/submit-review").status_code == 409

    done = owner.post(f"{API}/projects/{pid}/handover/complete").json()
    assert done["status"] == "completed" and done["progress"] == 100
    assert done["completed_by_name"] == "Olivia Owner" and done["completed_at"]
    assert owner.post(f"{API}/projects/{pid}/handover/complete").status_code == 409

    locked = owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": "changed"})
    assert locked.status_code == 409 and locked.json()["error"]["code"] == "handover_locked"

    reopened = owner.post(f"{API}/projects/{pid}/handover/reopen").json()
    assert reopened["status"] == "draft" and reopened["completed_at"] is None
    assert owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": "changed"}).status_code == 200


def test_incoming_member_acknowledges_a_completed_handover(owner, incoming, team):
    pid = team["id"]
    owner.post(f"{API}/projects/{pid}/handover")

    too_early = incoming.post(f"{API}/projects/{pid}/handover/acknowledge")
    assert too_early.status_code == 409

    fill_all(owner, pid)
    owner.post(f"{API}/projects/{pid}/handover/complete")

    assert owner.post(f"{API}/projects/{pid}/handover/acknowledge").status_code == 403  # not the incoming member
    done = incoming.post(f"{API}/projects/{pid}/handover/acknowledge")
    assert done.status_code == 200 and done.json()["acknowledged_by_name"] == "Ines Incoming"
    assert incoming.post(f"{API}/projects/{pid}/handover/acknowledge").status_code == 409

    # Reopening clears the acknowledgement: the content may change.
    owner.post(f"{API}/projects/{pid}/handover/reopen")
    assert owner.get(f"{API}/projects/{pid}/handover").json()["acknowledged_at"] is None


def test_activity_feed_records_the_workflow(owner, project):
    pid = project["id"]
    owner.post(f"{API}/projects/{pid}/handover")
    owner.put(f"{API}/projects/{pid}/handover/sections/overview", json={"content": "Hello"})
    feed = owner.get(f"{API}/projects/{pid}/activity").json()
    actions = [a["action"] for a in feed]
    assert actions[:2] == ["handover.section_updated", "handover.created"]
    assert "project.created" in actions
    assert all(a["actor_name"] == "Olivia Owner" for a in feed)
