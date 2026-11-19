from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from ..core.config import settings

IS_SQLITE = settings.database_url.startswith("sqlite")

engine_options: dict = {"pool_pre_ping": True}
if IS_SQLITE:
    # FastAPI handles requests in several threads; SQLite needs permission for that.
    engine_options["connect_args"] = {"check_same_thread": False}
else:
    # Hosted PostgreSQL closes idle connections, so recycle before that happens.
    engine_options["pool_recycle"] = 300

engine = create_engine(settings.database_url, **engine_options)

if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _record):
        # SQLite ignores foreign keys unless asked, which would break cascades.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """One database session per request; rolled back if anything fails."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_database() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 - any failure means "not healthy"
        return False
