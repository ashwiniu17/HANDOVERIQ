from __future__ import annotations

from fastapi import APIRouter, Request, Response

from ...core.config import settings
from ...core.rate_limit import login_limiter
from ...core.security import create_access_token
from ...schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
from ...services import auth as auth_service
from ..deps import CurrentUser, DbSession

router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,  # JavaScript on the page can never read it
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.cookie_name,
        domain=settings.cookie_domain,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


def auth_response(user, response: Response) -> AuthResponse:
    token = create_access_token(user.id, user.token_version)
    set_session_cookie(response, token)
    return AuthResponse(user=UserOut.model_validate(user), access_token=token)


@router.post("/register", response_model=AuthResponse, status_code=201, summary="Create an account")
def register(data: RegisterRequest, response: Response, db: DbSession):
    user = auth_service.register_user(db, data.email, data.full_name, data.password)
    return auth_response(user, response)


@router.post("/login", response_model=AuthResponse, summary="Sign in")
def login(data: LoginRequest, request: Request, response: Response, db: DbSession):
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}|{auth_service.normalize_email(data.email)}"
    login_limiter.check(key)
    try:
        user = auth_service.authenticate(db, data.email, data.password)
    except Exception:
        login_limiter.record_failure(key)
        raise
    login_limiter.reset(key)
    return auth_response(user, response)


@router.post("/logout", status_code=204, summary="Sign out")
def logout(response: Response):
    clear_session_cookie(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut, summary="The signed-in user")
def me(user: CurrentUser):
    return user
