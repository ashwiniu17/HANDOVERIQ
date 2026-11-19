"""Run Alembic database migrations from inside the application."""
from __future__ import annotations

from alembic import command
from alembic.config import Config

from ..core.config import BACKEND_DIR


def alembic_config(database_url: str | None = None) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.attributes["programmatic"] = True
    if database_url:
        config.attributes["database_url"] = database_url
    return config


def run_migrations(database_url: str | None = None) -> None:
    """Bring the database up to the latest schema ("alembic upgrade head")."""
    command.upgrade(alembic_config(database_url), "head")
