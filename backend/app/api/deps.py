from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Path, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.errors import AppError
from ..core.security import decode_access_token
from ..db.session import get_db
from ..domain import Permission
from ..models import User
from ..services.access import ProjectAccess, get_access

# Shows an "Authorize" button in the Swagger UI. The website itself uses the cookie.
bearer_scheme = HTTPBearer(auto_error=False, description="The access_token returned by /auth/login.")

DbSession = Annotated[Session, Depends(get_db)]

NOT_AUTHENTICATED = AppError(401, "not_authenticated", "Sign in to continue.")


def get_current_user(
    request: Request,
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> User:
    token = credentials.credentials if credentials else request.cookies.get(settings.cookie_name)
    if not token:
        raise NOT_AUTHENTICATED
    claims = decode_access_token(token)
    if claims is None:
        raise NOT_AUTHENTICATED
    user = db.get(User, int(claims["sub"]))
    # A changed password raises token_version and so invalidates older sessions.
    if user is None or not user.is_active or user.token_version != claims["ver"]:
        raise NOT_AUTHENTICATED
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

ProjectId = Annotated[int, Path(ge=1, le=2_147_483_647)]


def require_project(permission: Permission):
    """Dependency factory: resolves {project_id} and checks the caller's permission."""

    def dependency(project_id: ProjectId, user: CurrentUser, db: DbSession) -> ProjectAccess:
        return get_access(db, user, project_id, permission)

    return dependency


ViewAccess = Annotated[ProjectAccess, Depends(require_project(Permission.view))]
EditAccess = Annotated[ProjectAccess, Depends(require_project(Permission.edit))]
ManageAccess = Annotated[ProjectAccess, Depends(require_project(Permission.manage))]
