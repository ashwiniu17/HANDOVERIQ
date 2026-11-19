import pytest
from fastapi.testclient import TestClient

from app.core.config import DEV_SECRET_KEY, Settings, normalize_database_url
from app.main import app

from .conftest import API, CSRF_HEADERS, new_client


def test_security_headers_are_present():
    response = new_client().get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert response.headers["x-request-id"]


def test_cors_allows_the_frontend_origin_with_credentials():
    response = new_client().options(
        f"{API}/projects",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-requested-with",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_refuses_other_origins():
    response = new_client().options(
        f"{API}/projects",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in response.headers


def test_csrf_rejection_still_carries_cors_headers_for_the_real_frontend():
    response = TestClient(app).post(f"{API}/projects", json={}, headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 403
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_unexpected_errors_never_leak_details():
    @app.get("/api/_test_boom")
    def boom():
        raise RuntimeError("secret database password is hunter2")

    try:
        response = TestClient(app, raise_server_exceptions=False).get("/api/_test_boom")
    finally:
        app.router.routes[:] = [r for r in app.router.routes if getattr(r, "path", "") != "/api/_test_boom"]
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "hunter2" not in response.text


def test_error_format_is_consistent():
    for response in (new_client().get("/api/nope"), new_client().get(f"{API}/projects")):
        error = response.json()["error"]
        assert set(error) >= {"code", "message"}


def test_openapi_docs_describe_the_api():
    spec = new_client().get("/api/openapi.json").json()
    assert spec["info"]["title"] == "HANDOVERIQ API"
    assert "/api/v1/auth/login" in spec["paths"]
    assert "HTTPBearer" in spec["components"]["securitySchemes"]
    assert new_client().get("/api/docs").status_code == 200


# ---- configuration safety --------------------------------------------------

def test_production_refuses_to_start_with_unsafe_settings():
    unsafe = Settings(environment="production", secret_key=DEV_SECRET_KEY, database_url="sqlite:///x.db", cookie_secure=False)
    with pytest.raises(RuntimeError) as error:
        unsafe.validate()
    message = str(error.value)
    assert "SECRET_KEY" in message and "PostgreSQL" in message and "COOKIE_SECURE" in message


def test_production_accepts_safe_settings():
    Settings(
        environment="production", secret_key="x" * 40, database_url="postgresql+psycopg://u:p@h/db", cookie_secure=True
    ).validate()


def test_samesite_none_requires_secure_cookies():
    with pytest.raises(RuntimeError):
        Settings(cookie_samesite="none", cookie_secure=False).validate()
    with pytest.raises(RuntimeError):
        Settings(cookie_samesite="sideways").validate()


@pytest.mark.parametrize(
    "given, expected_start",
    [
        ("postgres://u:p@h:5432/db?sslmode=require", "postgresql+psycopg://u:p@h:5432/db"),
        ("postgresql://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgresql+psycopg://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
    ],
)
def test_database_urls_are_normalised_for_psycopg(given, expected_start):
    assert normalize_database_url(given).startswith(expected_start)


def test_relative_sqlite_paths_become_absolute():
    url = normalize_database_url("sqlite:///./app.db")
    assert url.startswith("sqlite:////") and url.endswith("/backend/app.db")


def test_frontend_origins_ignore_trailing_slashes(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://a.example.com/, https://b.example.com")
    assert Settings.from_env().frontend_origins == ["https://a.example.com", "https://b.example.com"]


def test_health_endpoint(owner):
    body = new_client().get("/api/health").json()
    assert body == {"status": "ok", "service": "handoveriq-backend", "database": "ok", "ai_configured": False}
