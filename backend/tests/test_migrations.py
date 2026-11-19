"""The database migrations must build exactly what the models describe."""
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from app import models  # noqa: F401
from app.db.base import Base
from app.db.migrate import alembic_config, run_migrations

TABLES = {
    "users", "projects", "project_members", "documents", "document_files", "handovers",
    "handover_sections", "analysis_runs", "knowledge_items", "reports", "activities",
}


@pytest.fixture()
def sqlite_url():
    directory = tempfile.mkdtemp(prefix="handoveriq-migration-")
    return "sqlite:///" + (Path(directory) / "m.db").as_posix()


def test_migration_builds_every_table(sqlite_url):
    run_migrations(sqlite_url)
    engine = create_engine(sqlite_url)
    assert TABLES <= set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0001"


def test_migration_matches_the_models(sqlite_url):
    run_migrations(sqlite_url)
    with create_engine(sqlite_url).connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []


def test_running_migrations_twice_is_harmless(sqlite_url):
    run_migrations(sqlite_url)
    run_migrations(sqlite_url)


def test_downgrade_removes_everything_and_upgrade_restores_it(sqlite_url):
    run_migrations(sqlite_url)
    command.downgrade(alembic_config(sqlite_url), "base")
    assert TABLES.isdisjoint(set(inspect(create_engine(sqlite_url)).get_table_names()))
    run_migrations(sqlite_url)
    assert TABLES <= set(inspect(create_engine(sqlite_url)).get_table_names())


def test_database_rejects_invalid_values_not_just_the_api(sqlite_url):
    """CHECK constraints and foreign keys are enforced by the database itself."""
    from sqlalchemy.exc import IntegrityError

    run_migrations(sqlite_url)
    engine = create_engine(sqlite_url)
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text(
            "INSERT INTO users (email, full_name, password_hash, is_active, token_version, created_at, updated_at) "
            "VALUES ('a@example.com', 'A', 'x', 1, 0, '2026-01-01', '2026-01-01')"
        ))
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(text(
                "INSERT INTO projects (owner_id, name, status, created_at, updated_at) "
                "VALUES (1, 'P', 'banana', '2026-01-01', '2026-01-01')"
            ))
