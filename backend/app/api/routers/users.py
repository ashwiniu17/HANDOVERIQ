from __future__ import annotations

from fastapi import APIRouter, Response

from ...schemas.auth import AuthResponse, PasswordChange, ProfileUpdate, UserOut
from ...services import auth as auth_service
from ..deps import CurrentUser, DbSession
from .auth import auth_response

router = APIRouter(prefix="/users", tags=["Users"])


@router.patch("/me", response_model=UserOut, summary="Update your profile")
def update_profile(data: ProfileUpdate, user: CurrentUser, db: DbSession):
    user.full_name = data.full_name
    db.commit()
    return user


@router.post("/me/password", response_model=AuthResponse, summary="Change your password")
def change_password(data: PasswordChange, response: Response, user: CurrentUser, db: DbSession):
    auth_service.change_password(db, user, data.current_password, data.new_password)
    # Other sessions are now invalid; this one continues with a fresh token.
    return auth_response(user, response)
