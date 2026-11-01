from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

IS_SQLITE = settings.database_url.startswith("sqlite")

# SQLite only: FastAPI handles requests on different threads, and SQLite's
# Python driver refuses that by default.
connect_args = {"check_same_thread": False} if IS_SQLITE else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,  # quietly replaces dead connections
)

if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
        # SQLite ignores foreign keys unless you switch them on for every connection.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# expire_on_commit=False keeps an object's values readable after db.commit(),
# so we can return it from an endpoint without an extra database query.
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Every table class in models.py inherits from this."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency: gives one session per request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create any tables that don't exist yet. Existing tables are left alone."""
    # Importing models registers the table definitions with Base.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)