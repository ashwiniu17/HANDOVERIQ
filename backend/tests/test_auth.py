import pytest
from sqlalchemy import select

from app.core.security import hash_password, verify_password
from app.db.session import SessionLocal
from app.models import User

from .conftest import API, CSRF_HEADERS, PASSWORD, make_project, new_client, register


def test_register_creates_account_and_signs_in(client=None):
    c = new_client()
    body = register(c, "Ann@Example.com", "Ann Lee")
    assert body["user"]["email"] == "ann@example.com"  # stored lower-case
    assert body["user"]["full_name"] == "Ann Lee"
    assert body["token_type"] == "bearer" and body["access_token"]

    cookie = c.cookies.get("handoveriq_session")
    assert cookie == body["access_token"]
    assert c.get(f"{API}/auth/me").json()["email"] == "ann@example.com"


def test_session_cookie_is_httponly():
    c = new_client()
    response = c.post(f"{API}/auth/register", json={"email": "a@example.com", "full_name": "A", "password": PASSWORD})
    header = response.headers["set-cookie"].lower()
    assert "httponly" in header
    assert "samesite=lax" in header


def test_password_is_hashed_with_argon2_never_stored_in_plain_text():
    register(new_client(), "a@example.com")
    with SessionLocal() as db:
        stored = db.scalar(select(User.password_hash))
    assert stored.startswith("$argon2id$")
    assert PASSWORD not in stored
    assert verify_password(PASSWORD, stored)


def test_duplicate_email_is_rejected_ignoring_case():
    register(new_client(), "a@example.com")
    response = new_client().post(f"{API}/auth/register", json={"email": "A@EXAMPLE.COM", "full_name": "B", "password": PASSWORD})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


@pytest.mark.parametrize(
    "payload, field",
    [
        ({"email": "not-an-email", "full_name": "A", "password": PASSWORD}, "email"),
        ({"email": "a@example.com", "full_name": "", "password": PASSWORD}, "full_name"),
        ({"email": "a@example.com", "full_name": "A", "password": "short"}, "password"),
        ({"email": "a@example.com", "full_name": "A", "password": "password123"}, "password"),
        ({"email": "a@example.com", "full_name": "A", "password": "x" * 200}, "password"),
    ],
)
def test_registration_validation(payload, field):
    response = new_client().post(f"{API}/auth/register", json=payload)
    assert response.status_code == 422
    fields = {d["field"] for d in response.json()["error"]["details"]}
    assert field in fields


def test_login_and_wrong_password_give_the_same_vague_error():
    register(new_client(), "a@example.com")
    c = new_client()
    ok = c.post(f"{API}/auth/login", json={"email": "A@example.com", "password": PASSWORD})
    assert ok.status_code == 200

    wrong = new_client().post(f"{API}/auth/login", json={"email": "a@example.com", "password": "nope-nope-nope"})
    unknown = new_client().post(f"{API}/auth/login", json={"email": "ghost@example.com", "password": "nope-nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()  # cannot tell which e-mails exist


def test_repeated_failed_logins_are_throttled():
    register(new_client(), "a@example.com")
    c = new_client()
    for _ in range(5):
        assert c.post(f"{API}/auth/login", json={"email": "a@example.com", "password": "wrong-wrong"}).status_code == 401
    blocked = c.post(f"{API}/auth/login", json={"email": "a@example.com", "password": PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_attempts"


def test_me_requires_authentication():
    response = new_client().get(f"{API}/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_tampered_token_is_rejected():
    c = new_client()
    token = register(c, "a@example.com")["access_token"]
    other = new_client()
    other.cookies.set("handoveriq_session", token[:-3] + "abc")
    assert other.get(f"{API}/auth/me").status_code == 401


def test_logout_ends_the_session():
    c = new_client()
    register(c, "a@example.com")
    assert c.post(f"{API}/auth/logout").status_code == 204
    assert c.get(f"{API}/auth/me").status_code == 401


def test_bearer_token_works_without_the_cookie():
    token = register(new_client(), "a@example.com")["access_token"]
    api_client = new_client()  # no cookie
    response = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_state_changing_requests_need_the_csrf_header():
    c = new_client()
    register(c, "a@example.com")
    without = c.post(f"{API}/projects", json={"name": "X"}, headers={"X-Requested-With": ""})
    assert without.status_code == 403
    assert without.json()["error"]["code"] == "csrf_failed"
    # Reading is never blocked, and a request with its own bearer token is exempt.
    assert c.get(f"{API}/projects", headers={"X-Requested-With": ""}).status_code == 200
    token = c.cookies.get("handoveriq_session")
    exempt = new_client().post(
        f"{API}/projects", json={"name": "X"}, headers={"X-Requested-With": "", "Authorization": f"Bearer {token}"}
    )
    assert exempt.status_code == 201


def test_changing_password_signs_out_other_sessions():
    first = new_client()
    register(first, "a@example.com")
    second = new_client()
    assert second.post(f"{API}/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 200

    response = first.post(f"{API}/users/me/password", json={"current_password": PASSWORD, "new_password": "another-long-pass"})
    assert response.status_code == 200
    assert first.get(f"{API}/auth/me").status_code == 200  # this session continues
    assert second.get(f"{API}/auth/me").status_code == 401  # the other is signed out
    assert new_client().post(f"{API}/auth/login", json={"email": "a@example.com", "password": "another-long-pass"}).status_code == 200


def test_changing_password_needs_the_current_one():
    c = new_client()
    register(c, "a@example.com")
    response = c.post(f"{API}/users/me/password", json={"current_password": "wrong-wrong", "new_password": "another-long-pass"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "wrong_password"


def test_update_profile():
    c = new_client()
    register(c, "a@example.com", "Old Name")
    response = c.patch(f"{API}/users/me", json={"full_name": "New Name"})
    assert response.status_code == 200
    assert c.get(f"{API}/auth/me").json()["full_name"] == "New Name"


def test_protected_routes_reject_anonymous_visitors():
    c = new_client()
    for method, path in [
        ("get", "/projects"), ("post", "/projects"), ("get", "/dashboard"), ("get", "/projects/1"),
        ("get", "/projects/1/documents"), ("get", "/projects/1/handover"), ("get", "/ai/status"),
    ]:
        response = getattr(c, method)(f"{API}{path}", **({"json": {}} if method == "post" else {}))
        assert response.status_code == 401, f"{method} {path} -> {response.status_code}"
