from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.errors import AppError
from ..core.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from ..models import ProjectMember, User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def link_pending_memberships(db: Session, user: User) -> int:
    """Attach project invitations sent to this e-mail before the account existed."""
    result = db.execute(
        update(ProjectMember)
        .where(ProjectMember.email == user.email, ProjectMember.user_id.is_(None))
        .values(user_id=user.id)
    )
    return result.rowcount or 0


def register_user(db: Session, email: str, full_name: str, password: str) -> User:
    email = normalize_email(email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise AppError(409, "email_taken", "An account with this e-mail address already exists. Sign in instead.")
    user = User(email=email, full_name=full_name, password_hash=hash_password(password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # two sign-ups with the same e-mail at the same moment
        db.rollback()
        raise AppError(409, "email_taken", "An account with this e-mail address already exists. Sign in instead.")
    link_pending_memberships(db, user)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return user


INVALID_LOGIN = AppError(401, "invalid_credentials", "The e-mail or password is not correct.")


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None:
        # Spend the same time as a real check, then give the same answer.
        verify_password(password, DUMMY_PASSWORD_HASH)
        raise INVALID_LOGIN
    if not verify_password(password, user.password_hash):
        raise INVALID_LOGIN
    if not user.is_active:
        raise AppError(403, "account_disabled", "This account has been disabled.")
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AppError(422, "wrong_password", "The current password is not correct.", [
            {"field": "current_password", "message": "The current password is not correct."}
        ])
    user.password_hash = hash_password(new_password)
    user.token_version += 1  # signs out every other session
    db.commit()
