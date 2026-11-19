from .conftest import API, make_user_client, new_client, register


def test_list_starts_with_the_owner(owner, project):
    members = owner.get(f"{API}/projects/{project['id']}/members").json()
    assert len(members) == 1
    assert members[0]["is_owner"] and members[0]["role"] == "owner" and members[0]["id"] is None


def test_add_member_with_an_account_links_immediately(owner, incoming, project):
    response = owner.post(f"{API}/projects/{project['id']}/members", json={"email": "INCOMING@example.com", "role": "incoming"})
    assert response.status_code == 201
    body = response.json()
    assert body["has_account"] is True
    assert body["name"] == "Ines Incoming"
    assert body["email"] == "incoming@example.com"


def test_invited_person_without_an_account_is_linked_on_registration(owner, project):
    response = owner.post(
        f"{API}/projects/{project['id']}/members",
        json={"email": "newbie@example.com", "name": "Nina Newbie", "role": "incoming"},
    )
    assert response.json()["has_account"] is False

    newbie = new_client()
    register(newbie, "newbie@example.com", "Nina Newbie")
    assert [p["id"] for p in newbie.get(f"{API}/projects").json()] == [project["id"]]
    assert newbie.get(f"{API}/projects/{project['id']}").json()["my_role"] == "incoming"
    members = owner.get(f"{API}/projects/{project['id']}/members").json()
    assert members[1]["has_account"] is True


def test_duplicate_member_and_taken_roles_are_rejected(owner, outgoing, incoming, project):
    pid = project["id"]
    assert owner.post(f"{API}/projects/{pid}/members", json={"email": "outgoing@example.com", "role": "outgoing"}).status_code == 201
    again = owner.post(f"{API}/projects/{pid}/members", json={"email": "outgoing@example.com", "role": "collaborator"})
    assert again.status_code == 409 and again.json()["error"]["code"] == "member_exists"

    second_outgoing = owner.post(f"{API}/projects/{pid}/members", json={"email": "incoming@example.com", "role": "outgoing"})
    assert second_outgoing.status_code == 409 and second_outgoing.json()["error"]["code"] == "role_taken"


def test_invalid_member_input(owner, project):
    pid = project["id"]
    assert owner.post(f"{API}/projects/{pid}/members", json={"email": "nonsense", "role": "incoming"}).status_code == 422
    assert owner.post(f"{API}/projects/{pid}/members", json={"email": "a@example.com", "role": "owner"}).status_code == 422
    assert owner.post(f"{API}/projects/{pid}/members", json={"email": "a@example.com"}).status_code == 422


def test_change_role_and_remove(owner, collab, project):
    pid = project["id"]
    member = owner.post(f"{API}/projects/{pid}/members", json={"email": "collab@example.com", "role": "collaborator"}).json()
    changed = owner.patch(f"{API}/projects/{pid}/members/{member['id']}", json={"role": "incoming"})
    assert changed.status_code == 200 and changed.json()["role"] == "incoming"
    assert owner.delete(f"{API}/projects/{pid}/members/{member['id']}").status_code == 204
    assert owner.delete(f"{API}/projects/{pid}/members/{member['id']}").status_code == 404


def test_cannot_manage_members_of_another_project(owner, project):
    other_owner = make_user_client("other@example.com", "Other Owner")
    other_project = other_owner.post(f"{API}/projects", json={"name": "Other"}).json()
    member = other_owner.post(
        f"{API}/projects/{other_project['id']}/members", json={"email": "x@example.com", "role": "collaborator"}
    ).json()
    # Our owner uses their own project id with the other project's member id.
    assert owner.delete(f"{API}/projects/{project['id']}/members/{member['id']}").status_code == 404
