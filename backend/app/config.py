import os
from pathlib import Path

from dotenv import load_dotenv

# The backend/ folder (the parent of the "app" folder this file lives in).
BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env if it exists. Real environment variables (for example on
# Render) still win, because load_dotenv does not override them by default.
load_dotenv(BASE_DIR / ".env")


def _parse_origins(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    def __init__(self) -> None:
        self.anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "").strip()
        self.anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5").strip()
        self.database_url: str = os.getenv(
            "DATABASE_URL", f"sqlite:///{(BASE_DIR / 'handoveriq.db').as_posix()}"
        )
        self.frontend_origins: list[str] = _parse_origins(
            os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        )
        try:
            self.max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
        except ValueError:
            self.max_upload_mb = 10


settings = Settings()