"""Application settings, read once from environment variables (and backend/.env)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]

# Real environment variables always win over the .env file.
load_dotenv(BACKEND_DIR / ".env")

DEV_SECRET_KEY = "dev-only-insecure-secret-change-me-before-deploying"


def _str(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _origins(raw: str) -> list[str]:
    # Browsers send origins without a trailing slash, so strip it.
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


def normalize_database_url(url: str) -> str:
    """Make a database URL usable by SQLAlchemy + psycopg 3.

    - "postgres://" and "postgresql://" (what Neon, Render and Heroku hand out)
      become "postgresql+psycopg://".
    - A relative SQLite path becomes an absolute path inside the backend folder,
      so the database is the same file no matter where the server is started.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
        path = url[len("sqlite:///"):]
        if path and path != ":memory:" and not Path(path).is_absolute():
            url = "sqlite:///" + (BACKEND_DIR / path).resolve().as_posix()
    return url


@dataclass
class Settings:
    environment: str = "development"
    database_url: str = "sqlite:///./handoveriq.db"
    auto_migrate: bool = True

    secret_key: str = DEV_SECRET_KEY
    access_token_expire_minutes: int = 720
    cookie_name: str = "handoveriq_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    frontend_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])
    enable_docs: bool = True
    log_level: str = "INFO"

    max_upload_mb: int = 10
    max_documents_per_project: int = 30
    max_extracted_chars: int = 600_000

    login_max_attempts: int = 8
    login_window_seconds: int = 900

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    ai_timeout_seconds: int = 120
    ai_max_input_chars: int = 150_000
    ai_max_output_tokens: int = 8_000

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @classmethod
    def from_env(cls) -> "Settings":
        environment = _str("ENVIRONMENT", "development").lower()
        is_prod = environment == "production"
        samesite = _str("COOKIE_SAMESITE", "lax").lower()
        return cls(
            environment=environment,
            database_url=normalize_database_url(_str("DATABASE_URL", "sqlite:///./handoveriq.db")),
            auto_migrate=_bool("AUTO_MIGRATE", True),
            secret_key=_str("SECRET_KEY", DEV_SECRET_KEY),
            access_token_expire_minutes=_int("ACCESS_TOKEN_EXPIRE_MINUTES", 720),
            cookie_name=_str("COOKIE_NAME", "handoveriq_session"),
            cookie_secure=_bool("COOKIE_SECURE", is_prod),
            cookie_samesite=samesite,
            cookie_domain=_str("COOKIE_DOMAIN") or None,
            frontend_origins=_origins(_str("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")),
            enable_docs=_bool("ENABLE_DOCS", True),
            log_level=_str("LOG_LEVEL", "INFO").upper(),
            max_upload_mb=_int("MAX_UPLOAD_MB", 10),
            max_documents_per_project=_int("MAX_DOCUMENTS_PER_PROJECT", 30),
            max_extracted_chars=_int("MAX_EXTRACTED_CHARS", 600_000),
            login_max_attempts=_int("LOGIN_MAX_ATTEMPTS", 8),
            login_window_seconds=_int("LOGIN_WINDOW_SECONDS", 900),
            anthropic_api_key=_str("ANTHROPIC_API_KEY"),
            anthropic_model=_str("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
            ai_timeout_seconds=_int("AI_TIMEOUT_SECONDS", 120),
            ai_max_input_chars=_int("AI_MAX_INPUT_CHARS", 150_000),
            ai_max_output_tokens=_int("AI_MAX_OUTPUT_TOKENS", 8_000),
        )

    def validate(self) -> None:
        """Refuse to start with an unsafe production configuration."""
        problems: list[str] = []
        if self.cookie_samesite not in {"lax", "strict", "none"}:
            problems.append("COOKIE_SAMESITE must be lax, strict or none.")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            problems.append("COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers reject it otherwise).")
        if self.is_production:
            if self.secret_key == DEV_SECRET_KEY or len(self.secret_key) < 32:
                problems.append("SECRET_KEY must be set to a random value of at least 32 characters in production.")
            if self.database_url.startswith("sqlite"):
                problems.append("DATABASE_URL must point to PostgreSQL in production (SQLite is for local development).")
            if not self.cookie_secure:
                problems.append("COOKIE_SECURE must be true in production.")
        if problems:
            raise RuntimeError("Invalid configuration:\n- " + "\n- ".join(problems))


settings = Settings.from_env()
