import os
from pathlib import Path

from dotenv import load_dotenv

# The backend/ folder (the parent of the "app" folder this file lives in).
BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env if it exists. Real environment variables (for example on
# Render) still win, because load_dotenv does not override them by default.
load_dotenv(BASE_DIR / ".env")

DEFAULT_DATABASE_URL = f"sqlite:///{(BASE_DIR / 'handoveriq.db').as_posix()}"


def _parse_origins(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def _normalize_database_url(raw: str) -> str:
    """Make the database URL safe and predictable.

    - Empty value          -> the default SQLite file in backend/
    - Relative SQLite path -> resolved inside backend/, so it never depends on
                              which folder the server was started from
    - postgres:// or postgresql:// -> postgresql+psycopg:// (the driver we installed)
    """
    url = raw.strip()
    if not url:
        return DEFAULT_DATABASE_URL

    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]

    sqlite_prefix = "sqlite:///"
    # "sqlite:////" (four slashes) is an absolute Unix path, so leave it alone.
    if url.startswith(sqlite_prefix) and not url.startswith("sqlite:////"):
        path_part = url[len(sqlite_prefix):]
        if (
            path_part
            and not path_part.startswith(":memory:")
            and not Path(path_part).is_absolute()
        ):
            url = sqlite_prefix + (BASE_DIR / path_part).resolve().as_posix()

    return url


class Settings:
    def __init__(self) -> None:
        self.anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "").strip()
        self.anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5").strip()
        self.database_url: str = _normalize_database_url(
            os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
        )
        self.frontend_origins: list[str] = _parse_origins(
            os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        )
        try:
            self.max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
        except ValueError:
            self.max_upload_mb = 10


settings = Settings()