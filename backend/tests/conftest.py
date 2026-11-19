"""Shared test setup.

The tests use their own database and delete every row in it after each test.
By default that is a throwaway SQLite file in your temp folder, so real data is
never touched. To test against PostgreSQL, set TEST_DATABASE_URL to an EMPTY,
disposable database (never your real one).
"""
import os
import tempfile
from pathlib import Path

# Must be set BEFORE the app is imported: settings are read once, at import time.
_temp_dir = tempfile.mkdtemp(prefix="handoveriq-tests-")
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or (
    "sqlite:///" + (Path(_temp_dir) / "test.db").as_posix()
)
os.environ["AUTO_MIGRATE"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256-signing"
os.environ["ANTHROPIC_API_KEY"] = ""  # no test ever calls the real AI service
os.environ["LOGIN_MAX_ATTEMPTS"] = "5"
os.environ["LOG_LEVEL"] = "WARNING"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from app.core.rate_limit import login_limiter  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Activity, AnalysisRun, Document, DocumentFile, Handover, HandoverSection,
    KnowledgeItem, Project, ProjectMember, Report, User,
)

CSRF_HEADERS = {"X-Requested-With": "handoveriq"}
API = "/api/v1"
PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def _app_lifespan():
    # Entering the app's lifespan runs the database migrations, so every test
    # run also proves the migrations build a working database.
    with TestClient(app):
        yield


@pytest.fixture(autouse=True)
def _clean_state():
    login_limiter.clear()
    yield
    app.dependency_overrides.clear()
    with SessionLocal() as db:
        for model in (
            Activity, KnowledgeItem, AnalysisRun, Report, HandoverSection, Handover,
            DocumentFile, Document, ProjectMember, Project, User,
        ):
            db.execute(delete(model))
        db.commit()


def new_client(**kwargs) -> TestClient:
    """A browser-like client with its own cookie jar."""
    return TestClient(app, headers=CSRF_HEADERS, **kwargs)


def register(client: TestClient, email: str, name: str = "Test User", password: str = PASSWORD) -> dict:
    response = client.post(f"{API}/auth/register", json={"email": email, "full_name": name, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


def make_user_client(email: str, name: str) -> TestClient:
    client = new_client()
    register(client, email, name)
    return client


def make_project(client: TestClient, **overrides) -> dict:
    payload = {"name": "Atlas Migration", "description": "Move billing to the new platform."}
    payload.update(overrides)
    response = client.post(f"{API}/projects", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def owner() -> TestClient:
    return make_user_client("owner@example.com", "Olivia Owner")


@pytest.fixture()
def outgoing() -> TestClient:
    return make_user_client("outgoing@example.com", "Omar Outgoing")


@pytest.fixture()
def incoming() -> TestClient:
    return make_user_client("incoming@example.com", "Ines Incoming")


@pytest.fixture()
def collab() -> TestClient:
    return make_user_client("collab@example.com", "Cleo Collaborator")


@pytest.fixture()
def stranger() -> TestClient:
    return make_user_client("stranger@example.com", "Sam Stranger")


@pytest.fixture()
def project(owner) -> dict:
    return make_project(owner)


@pytest.fixture()
def team(owner, outgoing, incoming, collab) -> dict:
    """A project whose owner has added an outgoing, incoming and collaborator member."""
    project = make_project(owner)
    for email, role in (
        ("outgoing@example.com", "outgoing"),
        ("incoming@example.com", "incoming"),
        ("collab@example.com", "collaborator"),
    ):
        response = owner.post(f"{API}/projects/{project['id']}/members", json={"email": email, "role": role})
        assert response.status_code == 201, response.text
    return project


def put_document(client: TestClient, project_id: int, filename: str, content: bytes, expect: int = 201):
    response = client.post(
        f"{API}/projects/{project_id}/documents",
        files={"file": (filename, content, "application/octet-stream")},
    )
    assert response.status_code == expect, response.text
    return response.json()


NOTES = (
    b"Billing migration notes\n\n"
    b"The service runs on Python 3.12 with PostgreSQL 16.\n"
    b"We decided to use Stripe webhooks because polling was too slow.\n"
    b"Pending: finish the invoice export before the 30th of June.\n"
    b"Known issue: the nightly sync fails when the VPN is down.\n"
)


def upload_notes(client: TestClient, project_id: int, filename: str = "notes.txt") -> dict:
    return put_document(client, project_id, filename, NOTES)
