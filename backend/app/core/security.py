"""Password hashing and session tokens."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from .config import settings

# Argon2id with the library's recommended defaults. The automated tests use
# deliberately cheap settings so that hundreds of sign-ups run quickly; the
# real application never does.
_hasher = (
    PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    if settings.environment == "test"
    else PasswordHasher()
)
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


# Verified against when the e-mail is unknown, so that "no such user" and
# "wrong password" take the same time and cannot be told apart by timing.
DUMMY_PASSWORD_HASH = _hasher.hash("not-a-real-password")


def create_access_token(user_id: int, token_version: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Return the token's claims, or None if it is invalid or expired."""
    try:
        claims = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if not str(claims.get("sub", "")).isdigit() or not isinstance(claims.get("ver"), int):
        return None
    return claims
